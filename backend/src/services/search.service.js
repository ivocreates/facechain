const fs = require("fs/promises");
const { PipelineError } = require("./image.service");

/**
 * search.service.js
 *
 * Genuine reverse-image / visual web search for the uploaded photo.
 * This finds pages and images on the public web that match or closely
 * resemble the upload — the same job Google Lens / Cloud Vision Web
 * Detection perform. It is NOT a biometric people-search (PimEyes /
 * Clearview style); embeddings never leave this process.
 *
 * Providers (first configured wins unless SEARCH_PROVIDER is set):
 *   - google_vision  GOOGLE_VISION_API_KEY   Cloud Vision WEB_DETECTION
 *   - serpapi        SERPAPI_KEY             Google Lens via SerpAPI
 *   - bing           BING_VISUAL_SEARCH_KEY  Bing Visual Search
 */

const MAX_CANDIDATES = 12;

function detectProvider() {
  const forced = (process.env.SEARCH_PROVIDER || "auto").toLowerCase();
  const available = {
    google_vision: Boolean(process.env.GOOGLE_VISION_API_KEY?.trim()),
    serpapi: Boolean(process.env.SERPAPI_KEY?.trim()),
    bing: Boolean(process.env.BING_VISUAL_SEARCH_KEY?.trim()),
  };
  if (forced !== "auto") {
    if (!available[forced]) {
      throw new PipelineError(
        "NO_SEARCH_PROVIDER",
        `SEARCH_PROVIDER=${forced} is set but its API key is missing.`
      );
    }
    return forced;
  }
  if (available.google_vision) return "google_vision";
  if (available.serpapi) return "serpapi";
  if (available.bing) return "bing";
  return null;
}

function getSearchStatus() {
  const provider = (() => {
    try {
      return detectProvider();
    } catch {
      return null;
    }
  })();
  return {
    configured: Boolean(provider),
    provider,
    hint: provider
      ? null
      : "Set GOOGLE_VISION_API_KEY, SERPAPI_KEY, or BING_VISUAL_SEARCH_KEY for reverse-image search.",
  };
}

async function findAppearances(imagePath) {
  const provider = detectProvider();
  if (!provider) {
    throw new PipelineError(
      "NO_SEARCH_PROVIDER",
      "No reverse-image search provider is configured. Add GOOGLE_VISION_API_KEY (Cloud Vision Web Detection), SERPAPI_KEY (Google Lens), or BING_VISUAL_SEARCH_KEY — or paste a content URL to verify a specific page."
    );
  }

  let raw;
  if (provider === "google_vision") raw = await googleVisionWebDetection(imagePath);
  else if (provider === "serpapi") raw = await serpApiGoogleLens(imagePath);
  else if (provider === "bing") raw = await bingVisualSearch(imagePath);
  else {
    throw new PipelineError("NO_SEARCH_PROVIDER", `Unknown search provider: ${provider}`);
  }

  const candidates = dedupeCandidates(raw.candidates).slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) {
    throw new PipelineError(
      "SEARCH_NO_RESULTS",
      "Reverse-image search returned no matching pages or images for this photo."
    );
  }

  return {
    provider: raw.provider,
    guessLabel: raw.guessLabel || "",
    webEntities: raw.webEntities || [],
    candidates,
  };
}

async function googleVisionWebDetection(imagePath) {
  const key = process.env.GOOGLE_VISION_API_KEY;
  const imageBytes = await fs.readFile(imagePath);
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBytes.toString("base64") },
          features: [{ type: "WEB_DETECTION", maxResults: 20 }],
        },
      ],
    }),
  });

  const body = await res.json();
  if (!res.ok || body.error) {
    const msg = body.error?.message || `Vision API HTTP ${res.status}`;
    throw new PipelineError("SEARCH_FAILED", `Google Vision web detection failed: ${msg}`);
  }

  const web = body.responses?.[0]?.webDetection || {};
  const candidates = [];

  for (const page of web.pagesWithMatchingImages || []) {
    const full = page.fullMatchingImages || [];
    const partial = page.partialMatchingImages || [];
    const imageUrl = (full[0] || partial[0])?.url || null;
    candidates.push({
      url: page.url,
      imageUrl,
      title: stripHtml(page.pageTitle || ""),
      source: "pagesWithMatchingImages",
      matchKind: full.length ? "full" : "partial",
    });
  }

  for (const img of web.fullMatchingImages || []) {
    candidates.push({
      url: img.url,
      imageUrl: img.url,
      title: "",
      source: "fullMatchingImages",
      matchKind: "full",
    });
  }

  for (const img of web.partialMatchingImages || []) {
    candidates.push({
      url: img.url,
      imageUrl: img.url,
      title: "",
      source: "partialMatchingImages",
      matchKind: "partial",
    });
  }

  for (const img of web.visuallySimilarImages || []) {
    candidates.push({
      url: img.url,
      imageUrl: img.url,
      title: "",
      source: "visuallySimilarImages",
      matchKind: "similar",
    });
  }

  return {
    provider: "google_vision",
    guessLabel: web.bestGuessLabels?.[0]?.label || "",
    webEntities: (web.webEntities || [])
      .filter((e) => e.description)
      .slice(0, 8)
      .map((e) => ({ description: e.description, score: e.score })),
    candidates,
  };
}

async function serpApiGoogleLens(imagePath) {
  const key = process.env.SERPAPI_KEY;
  const hostedUrl = await hostImageTemporarily(imagePath);

  const params = new URLSearchParams({
    engine: "google_lens",
    url: hostedUrl,
    api_key: key,
    hl: "en",
  });

  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new PipelineError(
      "SEARCH_FAILED",
      `Google Lens (SerpAPI) failed: ${body.error || `HTTP ${res.status}`}`
    );
  }

  const candidates = [];
  for (const match of body.visual_matches || []) {
    candidates.push({
      url: match.link,
      imageUrl: match.image || match.thumbnail,
      title: match.title || "",
      source: "google_lens",
      matchKind: match.source || "visual_match",
    });
  }

  return {
    provider: "serpapi_google_lens",
    guessLabel: body.knowledge_graph?.title || body.search_information?.query_displayed || "",
    webEntities: [],
    candidates,
  };
}

async function bingVisualSearch(imagePath) {
  const key = process.env.BING_VISUAL_SEARCH_KEY;
  const imageBytes = await fs.readFile(imagePath);
  const form = new FormData();
  form.append("image", new Blob([imageBytes], { type: "image/jpeg" }), "query.jpg");

  const res = await fetch("https://api.bing.microsoft.com/v7.0/images/visualsearch", {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key },
    body: form,
  });

  const body = await res.json();
  if (!res.ok || body.errors) {
    const msg = body.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new PipelineError("SEARCH_FAILED", `Bing Visual Search failed: ${msg}`);
  }

  const candidates = [];
  const tags = body.tags || [];
  for (const tag of tags) {
    for (const action of tag.actions || []) {
      const actionType = action.actionType || "";
      const values =
        action.data?.value ||
        action.data?.webSearchUrl ||
        [];

      if (Array.isArray(action.data?.value)) {
        for (const item of action.data.value) {
          const pageUrl = item.hostPageUrl || item.webSearchUrl || item.contentUrl;
          if (!pageUrl) continue;
          candidates.push({
            url: pageUrl,
            imageUrl: item.contentUrl || item.thumbnailUrl,
            title: item.name || item.hostPageDisplayUrl || "",
            source: `bing:${actionType}`,
            matchKind: actionType,
          });
        }
      }
    }
  }

  return {
    provider: "bing_visual_search",
    guessLabel: tags[0]?.displayName || "",
    webEntities: [],
    candidates,
  };
}

/**
 * SerpAPI Google Lens needs a publicly fetchable image URL. We upload to
 * a short-lived anonymous host only for that provider — Vision and Bing
 * take the bytes directly and never need this.
 */
async function hostImageTemporarily(imagePath) {
  const imageBytes = await fs.readFile(imagePath);
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("time", "1h");
  form.append("fileToUpload", new Blob([imageBytes], { type: "image/jpeg" }), "query.jpg");

  const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
    method: "POST",
    body: form,
  });
  const url = (await res.text()).trim();
  if (!res.ok || !url.startsWith("http")) {
    throw new PipelineError(
      "SEARCH_FAILED",
      "Could not host the image temporarily for Google Lens. Prefer GOOGLE_VISION_API_KEY, which sends bytes directly to Google."
    );
  }
  return url;
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    if (!c?.url) continue;
    let key;
    try {
      key = new URL(c.url).href.split("#")[0];
    } catch {
      key = c.url;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, url: key });
  }
  return out;
}

function stripHtml(s) {
  return String(s)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  findAppearances,
  getSearchStatus,
  detectProvider,
  MAX_CANDIDATES,
};

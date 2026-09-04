const os = require("os");
const fs = require("fs/promises");
const faceService = require("./face.service");
const imageService = require("./image.service");
const searchService = require("./search.service");
const { hashBuffer } = require("./hash.service");
const { PipelineError } = imageService;

const MAX_TO_SCORE = 6;

/**
 * Discovers where the uploaded photo appears online (reverse-image search),
 * downloads each candidate, and ranks them by face-embedding similarity to
 * the reference. The highest-scoring candidate is the "best match".
 *
 * A user-supplied candidateUrl is always included (and tried first) so a
 * specific page can still be verified without a search API key.
 */
async function verifyAgainstWeb(referenceImagePath, options = {}, emit = async () => {}) {
  const referenceFace = await faceService.detectSingleFace(referenceImagePath);

  const candidates = [];
  let searchMeta = { provider: null, guessLabel: "", webEntities: [], candidates: [] };

  if (options.candidateUrl) {
    candidates.push({
      url: options.candidateUrl,
      imageUrl: options.imageUrl || options.candidateUrl,
      title: options.title || "",
      source: "user",
      matchKind: "supplied",
      platform: options.platform || inferPlatform(options.candidateUrl),
    });
  }

  const searchConfigured = searchService.getSearchStatus().configured;
  if (searchConfigured) {
    await emit("reverseSearch", { status: "running" });
    searchMeta = await searchService.findAppearances(referenceImagePath);
    for (const c of searchMeta.candidates) {
      candidates.push({
        ...c,
        platform: inferPlatform(c.url),
      });
    }
    await emit("reverseSearch", {
      status: "ok",
      provider: searchMeta.provider,
      guessLabel: searchMeta.guessLabel,
      resultCount: searchMeta.candidates.length,
    });
  } else if (!options.candidateUrl) {
    throw new PipelineError(
      "NO_SEARCH_PROVIDER",
      searchService.getSearchStatus().hint +
        " Alternatively, paste the URL of the content you want to verify."
    );
  } else {
    await emit("reverseSearch", {
      status: "skipped",
      reason: "no search API key — verifying the supplied URL only",
    });
  }

  const unique = uniqueByUrl(candidates).slice(0, MAX_TO_SCORE);
  if (unique.length === 0) {
    throw new PipelineError("SEARCH_NO_RESULTS", "No candidate URLs to compare.");
  }

  const scored = [];
  for (const candidate of unique) {
    await emit("matchVerification", {
      status: "running",
      url: candidate.url,
      title: candidate.title,
      source: candidate.source,
    });
    const result = await scoreCandidate(referenceFace, candidate);
    if (result) scored.push(result);
  }

  scored.sort((a, b) => b.similarityScore - a.similarityScore);

  if (scored.length === 0) {
    throw new PipelineError(
      "SEARCH_NO_VERIFIABLE_MATCH",
      "Search found pages, but none of them had a downloadable image with a detectable face."
    );
  }

  const best = scored[0];
  await emit("matchVerification", {
    status: "ok",
    similarityScore: best.similarityScore,
    matchStatus: best.matchStatus,
    compared: scored.length,
  });

  return {
    best,
    candidates: scored,
    search: {
      provider: searchMeta.provider,
      guessLabel: searchMeta.guessLabel,
      webEntities: searchMeta.webEntities,
      discovered: searchMeta.candidates.length,
    },
  };
}

async function scoreCandidate(referenceFace, candidate) {
  const tmpDir = os.tmpdir();
  let candidatePath = null;
  try {
    candidatePath = await imageService.downloadCandidateImage(candidate.imageUrl || candidate.url, tmpDir);
    const faces = await faceService.detectFaces(candidatePath);
    if (faces.length === 0) return null;

    const ranked = faces
      .map((f) => ({
        f,
        score: faceService.similarityScore(referenceFace.descriptor, f.descriptor),
      }))
      .sort((a, b) => b.score - a.score);

    const top = ranked[0];
    const isMatch = faceService.isLikelyMatch(referenceFace.descriptor, top.f.descriptor);
    const imageFingerprint = hashBuffer(await fs.readFile(candidatePath));

    return {
      url: candidate.url,
      title: candidate.title || "",
      platform: candidate.platform || inferPlatform(candidate.url),
      source: candidate.source,
      matchKind: candidate.matchKind,
      similarityScore: top.score,
      matchStatus: isMatch ? "high-confidence candidate" : "low-confidence / likely no match",
      facesFound: faces.length,
      imageFingerprint,
    };
  } catch {
    return null;
  } finally {
    await imageService.cleanup(candidatePath);
  }
}

function uniqueByUrl(candidates) {
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    let key;
    try {
      key = new URL(c.url).href.split("#")[0];
    } catch {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, url: key });
  }
  return out;
}

function inferPlatform(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

module.exports = { verifyAgainstWeb, verifyCandidate: verifyAgainstWeb };

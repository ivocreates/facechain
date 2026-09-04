const sharp = require("sharp");
const fs = require("fs/promises");
const path = require("path");

const MAX_DIMENSION = 1600;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,text/html;q=0.8,*/*;q=0.5",
};

async function validateAndNormalize(filePath, mimetype, sizeBytes) {
  if (mimetype && !ALLOWED_MIME.has(mimetype)) {
    throw new PipelineError("UNSUPPORTED_FORMAT", "Unsupported image format. Use JPEG, PNG or WebP.");
  }
  if (sizeBytes > MAX_BYTES) {
    throw new PipelineError("FILE_TOO_LARGE", "Image file is too large (max 10MB).");
  }

  let image;
  try {
    image = sharp(filePath);
    const meta = await image.metadata();
    if (!meta.width || !meta.height) {
      throw new Error("no dimensions");
    }
  } catch {
    throw new PipelineError("UNPROCESSABLE_IMAGE", "Image could not be processed.");
  }

  const normalizedPath = filePath + ".norm.jpg";
  await sharp(filePath)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toFile(normalizedPath);

  return normalizedPath;
}

/**
 * Fetch a candidate URL. If it is an image, return it; if it is an HTML
 * page, pull og:image / twitter:image and download that instead.
 */
async function downloadCandidateImage(imageUrl, destDir) {
  const { buffer, contentType, finalUrl } = await fetchBuffer(imageUrl);

  if (looksLikeImage(buffer, contentType)) {
    return writeJpeg(buffer, destDir);
  }

  if (isHtml(buffer, contentType)) {
    const og = extractPageImage(buffer.toString("utf8"), finalUrl);
    if (!og) {
      throw new PipelineError(
        "CANDIDATE_UNAVAILABLE",
        "Candidate page did not expose an image we could download."
      );
    }
    const nested = await fetchBuffer(og);
    if (!looksLikeImage(nested.buffer, nested.contentType)) {
      throw new PipelineError("CANDIDATE_UNAVAILABLE", "Candidate page image could not be decoded.");
    }
    return writeJpeg(nested.buffer, destDir);
  }

  // Some CDNs omit content-type; try decoding anyway.
  try {
    return await writeJpeg(buffer, destDir);
  } catch {
    throw new PipelineError("CANDIDATE_UNAVAILABLE", "Candidate URL did not return an image.");
  }
}

async function fetchBuffer(url, timeoutMs = 12000) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new PipelineError("CANDIDATE_UNAVAILABLE", "Candidate URL is not valid.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new PipelineError("CANDIDATE_UNAVAILABLE", "Candidate URL must be http(s).");
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: FETCH_HEADERS,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new PipelineError(
        "CANDIDATE_UNAVAILABLE",
        `Candidate image could not be downloaded (HTTP ${res.status}).`
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      throw new PipelineError("CANDIDATE_UNAVAILABLE", "Candidate image is too large.");
    }
    return {
      buffer,
      contentType: res.headers.get("content-type") || "",
      finalUrl: res.url || url,
    };
  } catch (err) {
    if (err instanceof PipelineError) throw err;
    throw new PipelineError("CANDIDATE_UNAVAILABLE", "Candidate image could not be downloaded.");
  } finally {
    clearTimeout(timer);
  }
}

async function writeJpeg(buffer, destDir) {
  const destPath = path.join(destDir, `candidate-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`);
  await sharp(buffer).rotate().jpeg({ quality: 92 }).toFile(destPath);
  return destPath;
}

function looksLikeImage(buffer, contentType) {
  const type = (contentType || "").split(";")[0].trim().toLowerCase();
  if (type.startsWith("image/") && type !== "image/svg+xml") return true;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)
    return true;
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP")
    return true;
  return false;
}

function isHtml(buffer, contentType) {
  const type = (contentType || "").split(";")[0].trim().toLowerCase();
  if (type.includes("html")) return true;
  const head = buffer.subarray(0, 200).toString("utf8").trim().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

function extractPageImage(html, pageUrl) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return resolveUrl(pageUrl, decodeHtml(m[1]));
  }
  return null;
}

function resolveUrl(base, maybeRelative) {
  try {
    return new URL(maybeRelative, base).href;
  } catch {
    return maybeRelative;
  }
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function cleanup(...paths) {
  await Promise.all(
    paths.map((p) =>
      p
        ? fs.unlink(p).catch(() => {
            /* already gone */
          })
        : Promise.resolve()
    )
  );
}

class PipelineError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

module.exports = {
  validateAndNormalize,
  downloadCandidateImage,
  cleanup,
  PipelineError,
  extractPageImage,
};

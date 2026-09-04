/**
 * canonicalize.js
 *
 * Produces a deterministic, stable string representation of the content
 * metadata that will be fingerprinted and registered on-chain. Because
 * SHA-256 is sensitive to every byte, key order and formatting must be
 * fixed — otherwise the same logical content could hash differently on
 * different runs.
 *
 * We deliberately keep this to STABLE fields only. Volatile fields (e.g.
 * "fetched at" wall-clock time from a live page) must not leak into the
 * canonical form, or re-verification would never match.
 */

/**
 * @param {object} content
 * @param {string} content.sourceUrl        Canonical URL of the verified content
 * @param {string} [content.platform]       Platform / domain label
 * @param {string} [content.title]          Post/page title, if available
 * @param {string} [content.imageFingerprint] Perceptual/content hash of the image itself
 * @param {number} [content.similarityScore]  Face similarity score (0-100), rounded
 * @returns {string} canonical JSON string, stable key order
 */
function canonicalizeContent(content) {
  const {
    sourceUrl,
    platform = "unknown",
    title = "",
    imageFingerprint = "",
    similarityScore = null,
  } = content;

  if (!sourceUrl || typeof sourceUrl !== "string") {
    throw new Error("canonicalizeContent: sourceUrl is required");
  }

  // Fixed key order — never derive this by iterating an object, since
  // property enumeration order is not something we want to depend on.
  const canonical = {
    sourceUrl: normalizeUrl(sourceUrl),
    platform: platform.trim().toLowerCase(),
    title: title.trim(),
    imageFingerprint,
    similarityScore:
      typeof similarityScore === "number" ? Math.round(similarityScore * 10) / 10 : null,
  };

  // JSON.stringify on an object with a fixed, explicit key order produces
  // a deterministic string as long as we always build it this way.
  return JSON.stringify(canonical);
}

/**
 * Strips fragments/tracking noise so the same logical URL always
 * canonicalizes the same way (best-effort, not exhaustive).
 */
function normalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    // Strip common tracking params
    const stripParams = ["utm_source", "utm_medium", "utm_campaign", "igshid", "fbclid"];
    stripParams.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}

module.exports = { canonicalizeContent, normalizeUrl };

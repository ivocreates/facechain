const crypto = require("crypto");
const { canonicalizeContent } = require("../utils/canonicalize");

/**
 * hash.service.js
 * Generates the SHA-256 content fingerprint that gets registered on-chain.
 */

/**
 * @param {object} content  see canonicalize.js for shape
 * @returns {{ canonical: string, hashHex: string, hashBytes32: string }}
 */
function fingerprintContent(content) {
  const canonical = canonicalizeContent(content);
  const hashHex = crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
  return {
    canonical,
    hashHex, // 64 hex chars, no 0x prefix — human-readable fingerprint
    hashBytes32: "0x" + hashHex, // ready to pass to the Solidity bytes32 param
  };
}

/**
 * Hash raw binary data (e.g. a downloaded candidate image) for use as the
 * `imageFingerprint` field fed into canonicalization. This is separate from
 * the final content fingerprint — it's a component of it.
 */
function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

module.exports = { fingerprintContent, hashBuffer };

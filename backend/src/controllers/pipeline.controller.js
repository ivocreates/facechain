const imageService = require("../services/image.service");
const faceService = require("../services/face.service");
const verificationService = require("../services/verification.service");
const hashService = require("../services/hash.service");
const blockchainService = require("../services/blockchain.service");
const searchService = require("../services/search.service");
const { PipelineError } = imageService;

async function runPipeline(req, res, { stream = false } = {}) {
  const stages = {};
  let uploadedPath = null;
  let normalizedPath = null;
  let closed = false;

  const writeEvent = (event, data) => {
    if (!stream || closed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const emit = async (key, payload) => {
    if (payload && payload.status) stages[key] = payload;
    writeEvent("stage", { key, ...payload });
  };

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") res.flushHeaders();
    req.on("close", () => {
      closed = true;
    });
  }

  try {
    if (!req.file) {
      throw new PipelineError("NO_IMAGE", "Please upload an image.");
    }

    uploadedPath = req.file.path;

    await emit("upload", { status: "running" });
    normalizedPath = await imageService.validateAndNormalize(
      uploadedPath,
      req.file.mimetype,
      req.file.size
    );
    await emit("upload", { status: "ok" });

    await emit("faceDetection", { status: "running" });
    const referenceFace = await faceService.detectSingleFace(normalizedPath);
    await emit("faceDetection", { status: "ok", confidence: referenceFace.confidence });
    await emit("faceEncoding", {
      status: "ok",
      dimensions: referenceFace.descriptor.length,
    });

    const verification = await verificationService.verifyAgainstWeb(
      normalizedPath,
      {
        candidateUrl: req.body.candidateUrl,
        title: req.body.title,
        platform: req.body.platform,
        imageUrl: req.body.imageUrl,
      },
      emit
    );

    const best = verification.best;

    await emit("fingerprint", { status: "running" });
    const fingerprint = hashService.fingerprintContent({
      sourceUrl: best.url,
      platform: best.platform,
      title: best.title,
      imageFingerprint: best.imageFingerprint,
      similarityScore: best.similarityScore,
    });
    await emit("fingerprint", { status: "ok", algorithm: "SHA-256", hash: fingerprint.hashHex });
    await emit("blockchain", { status: "awaiting-wallet" });

    const payload = {
      success: true,
      needsWalletTx: true,
      face: {
        detected: true,
        confidence: referenceFace.confidence,
      },
      search: verification.search,
      match: {
        url: best.url,
        platform: best.platform,
        title: best.title,
        similarityScore: best.similarityScore,
        matchStatus: best.matchStatus,
        source: best.source,
        facesFound: best.facesFound,
      },
      candidates: verification.candidates.map((c) => ({
        url: c.url,
        platform: c.platform,
        title: c.title,
        similarityScore: c.similarityScore,
        matchStatus: c.matchStatus,
        source: c.source,
      })),
      fingerprint: {
        algorithm: "SHA-256",
        hash: fingerprint.hashHex,
        hashBytes32: fingerprint.hashBytes32,
        canonicalContent: fingerprint.canonical,
      },
      stages,
    };

    if (stream) {
      writeEvent("result", payload);
      res.end();
      return;
    }

    return res.json(payload);
  } catch (err) {
    const code = err instanceof PipelineError ? err.code : "INTERNAL_ERROR";
    const message =
      err instanceof PipelineError ? err.message : "Something went wrong while running the pipeline.";
    console.error(`[pipeline error] ${code}:`, err);
    const body = { success: false, code, message, stages };
    if (stream) {
      writeEvent("error", body);
      res.end();
      return;
    }
    return res.status(err instanceof PipelineError ? 400 : 500).json(body);
  } finally {
    await imageService.cleanup(uploadedPath, normalizedPath);
  }
}

async function getStatus(_req, res) {
  const [chain, models] = await Promise.all([
    blockchainService.getStatus(),
    faceModelsStatus(),
  ]);
  res.json({
    ok: true,
    search: searchService.getSearchStatus(),
    chain,
    models,
  });
}

async function faceModelsStatus() {
  try {
    await faceService.loadModels();
    return { loaded: true };
  } catch (err) {
    return { loaded: false, error: err.message };
  }
}

module.exports = { runPipeline, getStatus };

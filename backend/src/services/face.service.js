const path = require("path");
const { Canvas, Image, ImageData } = require("canvas");
const faceapi = require("face-api.js");
const { PipelineError } = require("./image.service");

// face-api.js was built for the browser; this monkey-patch lets it run
// under Node using the `canvas` package instead of DOM APIs.
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODELS_DIR = path.join(__dirname, "../../models");
let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  const fs = require("fs");
  if (!fs.existsSync(path.join(MODELS_DIR, "ssd_mobilenetv1_model-weights_manifest.json"))) {
    throw new PipelineError(
      "MODELS_MISSING",
      "Face models are not installed. From backend/, run: npm run download-models"
    );
  }
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR),
    faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR),
    faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR),
  ]);
  modelsLoaded = true;
}

/**
 * Detects faces and computes a 128-d embedding for each face found.
 * @returns {Promise<Array<{ box: object, descriptor: Float32Array, confidence: number }>>}
 */
async function detectFaces(imagePath) {
  await loadModels();
  const img = await require("canvas").loadImage(imagePath);

  const detections = await faceapi
    .detectAllFaces(img)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections.map((d) => ({
    box: d.detection.box,
    confidence: d.detection.score,
    descriptor: d.descriptor, // Float32Array(128) — never persisted, never sent on-chain
  }));
}

/**
 * Enforces the demo constraint: exactly one face in the uploaded image.
 */
async function detectSingleFace(imagePath) {
  const faces = await detectFaces(imagePath);

  if (faces.length === 0) {
    throw new PipelineError("NO_FACE", "No face detected. Please upload a clearer image.");
  }
  if (faces.length > 1) {
    throw new PipelineError(
      "MULTIPLE_FACES",
      "Multiple faces detected. Please upload an image containing one face."
    );
  }
  return faces[0];
}

/**
 * Euclidean distance between two 128-d descriptors, converted into a
 * 0-100 "similarity" score. Lower distance = more similar.
 * face-api.js descriptors: distance < ~0.6 is generally considered a
 * plausible match, but this is probabilistic — never treat it as proof
 * of identity. Always surface the raw score to the user.
 */
function similarityScore(descriptorA, descriptorB) {
  const distance = faceapi.euclideanDistance(descriptorA, descriptorB);
  const clamped = Math.max(0, Math.min(1, distance / 1.2));
  return Math.round((1 - clamped) * 1000) / 10; // 0.0 - 100.0
}

const MATCH_THRESHOLD_DISTANCE = 0.6; // face-api.js convention; document as probabilistic

function isLikelyMatch(descriptorA, descriptorB) {
  return faceapi.euclideanDistance(descriptorA, descriptorB) < MATCH_THRESHOLD_DISTANCE;
}

module.exports = {
  loadModels,
  detectFaces,
  detectSingleFace,
  similarityScore,
  isLikelyMatch,
  MATCH_THRESHOLD_DISTANCE,
};

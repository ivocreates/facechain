/**
 * Downloads the face-api.js (justadudewhohacks) model weights required by
 * face.service.js into backend/models/. Run once via `npm run download-models`.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const MODELS_DIR = path.join(__dirname, "../models");
const BASE_URL =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const FILES = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model-shard1",
  "ssd_mobilenetv1_model-shard2",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model-shard1",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2",
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (currentUrl) => {
      https
        .get(currentUrl, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            file.close();
            fs.unlink(dest, () => {});
            return download(response.headers.location, dest).then(resolve, reject);
          }
          if (response.statusCode !== 200) {
            file.close();
            fs.unlink(dest, () => {});
            reject(new Error(`Failed to fetch ${url}: ${response.statusCode}`));
            return;
          }
          response.pipe(file);
          file.on("finish", () => file.close(resolve));
        })
        .on("error", (err) => {
          file.close();
          fs.unlink(dest, () => {});
          reject(err);
        });
    };
    get(url);
  });
}

async function main() {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  for (const filename of FILES) {
    const dest = path.join(MODELS_DIR, filename);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`Skipping ${filename} (already present)`);
      continue;
    }
    console.log(`Downloading ${filename}...`);
    await download(`${BASE_URL}/${filename}`, dest);
  }
  console.log("All model files downloaded to backend/models/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

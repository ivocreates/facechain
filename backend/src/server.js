require("dotenv").config({ path: require("path").join(__dirname, "../.env"), override: true });
const express = require("express");
const cors = require("cors");
const pipelineRoutes = require("./routes/pipeline.routes");
const faceService = require("./services/face.service");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/pipeline", pipelineRoutes);

app.use((err, req, res, next) => {
  console.error("[unhandled error]", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`FaceChain backend listening on http://localhost:${PORT}`);
  const vision = Boolean(process.env.GOOGLE_VISION_API_KEY);
  console.log(`Reverse search: ${vision ? "google_vision" : "not configured"}`);
  faceService
    .loadModels()
    .then(() => console.log("Face models loaded"))
    .catch((err) => console.warn("Face models not loaded yet:", err.message));
});

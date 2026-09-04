const express = require("express");
const multer = require("multer");
const path = require("path");
const { runPipeline, getStatus } = require("../controllers/pipeline.controller");

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, "../../uploads"),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get("/status", getStatus);
router.post("/run", upload.single("image"), (req, res) => runPipeline(req, res, { stream: false }));
router.post("/run/stream", upload.single("image"), (req, res) => runPipeline(req, res, { stream: true }));

module.exports = router;

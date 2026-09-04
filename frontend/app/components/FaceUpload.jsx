"use client";

import { useRef, useState } from "react";

export default function FaceUpload({ onSubmit, submitting, searchConfigured, statusLoaded, walletConnected }) {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!file || !searchConfigured || !walletConnected) return;
    onSubmit({ file });
  }

  const canRun = Boolean(file) && searchConfigured && walletConnected && !submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="mb-2 block font-display text-sm text-parchment/70">
          Reference face
        </label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={[
            "flex cursor-pointer items-center gap-4 rounded border border-dashed p-4 transition-colors",
            dragActive ? "border-seal bg-seal/5" : "hairline hover:border-seal/50",
          ].join(" ")}
        >
          {preview ? (
            <img src={preview} alt="Preview" className="h-16 w-16 rounded object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed hairline text-parchment/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c1.5-4 4.5-6 7-6s5.5 2 7 6" />
              </svg>
            </div>
          )}
          <div className="text-sm">
            <p className="text-parchment/80">
              {file ? file.name : "Drop an image, or click to browse"}
            </p>
            <p className="mt-0.5 font-mono text-xs text-parchment/40">JPEG, PNG or WebP · one face</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <p className="font-mono text-[11px] text-parchment/40">
        Google Vision will reverse-search the web for this photo, then your connected wallet signs the Sepolia registration (MetaMask popup).
      </p>

      {statusLoaded && !searchConfigured && (
        <p className="rounded border border-signal-warn/40 bg-signal-warn/[0.06] p-3 text-sm text-signal-warn">
          Reverse-image search is not live yet. Save <span className="font-mono">GOOGLE_VISION_API_KEY</span> in <span className="font-mono">backend/.env</span> and restart the backend.
        </p>
      )}

      {statusLoaded && searchConfigured && !walletConnected && (
        <p className="rounded border border-signal-warn/40 bg-signal-warn/[0.06] p-3 text-sm text-signal-warn">
          Connect your wallet (top right). You will get a popup to switch to Sepolia, then another to confirm the transaction.
        </p>
      )}

      <button
        type="submit"
        disabled={!canRun}
        className="w-full rounded bg-seal py-3 font-display text-sm text-ink-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {submitting ? "Running pipeline…" : "Search, match & register"}
      </button>
    </form>
  );
}

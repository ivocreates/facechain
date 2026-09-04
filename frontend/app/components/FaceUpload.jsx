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
        <label className="mb-3 block font-mono text-[11px] uppercase tracking-[0.14em] text-parchment/70">
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
            "flex cursor-pointer items-center gap-4 rounded-[3px] border border-dashed border-parchment/30 bg-ink-950/30 p-4 transition-colors duration-200",
            dragActive ? "border-seal bg-seal/10" : "hover:border-seal/70",
          ].join(" ")}
        >
          {preview ? (
            <img src={preview} alt="Preview" className="h-16 w-16 rounded-[2px] object-cover ring-1 ring-white/10" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-[2px] border border-dashed border-parchment/25 bg-ink-950/30 text-parchment/40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c1.5-4 4.5-6 7-6s5.5 2 7 6" />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-base font-medium text-parchment/90">
              {file ? file.name : "Drop an image, or click to browse"}
            </p>
            <p className="mt-1 font-mono text-[11px] text-parchment/45">JPEG, PNG or WebP · one face</p>
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

      <p className="font-mono text-[11px] leading-relaxed text-parchment/45">
        Google Vision will reverse-search the web for this photo, then your connected wallet signs the Sepolia registration (MetaMask popup).
      </p>

      {statusLoaded && !searchConfigured && (
        <p className="rounded-[3px] border border-signal-warn/60 bg-signal-warn/10 p-3 text-sm text-signal-warn">
          Reverse-image search is not live yet. Save <span className="font-mono">GOOGLE_VISION_API_KEY</span> in <span className="font-mono">backend/.env</span> and restart the backend.
        </p>
      )}

      {statusLoaded && searchConfigured && !walletConnected && (
        <p className="rounded-[3px] border border-signal-warn/60 bg-signal-warn/10 p-3 text-sm text-signal-warn">
          Connect your wallet (top right). You will get a popup to switch to Sepolia, then another to confirm the transaction.
        </p>
      )}

      <button
        type="submit"
        disabled={!canRun}
        className="w-full rounded-[3px] border border-seal-bright bg-seal py-3.5 font-display text-sm font-medium text-ink-950 shadow-[inset_1px_1px_0_rgba(255,255,255,0.45),inset_-1px_-1px_0_rgba(0,0,0,0.18)] transition-colors hover:bg-seal-bright disabled:cursor-not-allowed disabled:opacity-35"
      >
        {submitting ? "Running pipeline…" : "Search, match & register"}
      </button>
    </form>
  );
}

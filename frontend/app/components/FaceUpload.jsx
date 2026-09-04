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
    <form onSubmit={handleSubmit} className="space-y-5">
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
            "scan-frame flex cursor-pointer items-center gap-4 rounded-md border border-dashed border-parchment/35 bg-black/15 p-4 transition-colors duration-200",
            dragActive || submitting ? "scan-frame--active border-goa-teal bg-goa-teal/10" : "hover:border-goa-teal/80 hover:bg-goa-teal/5",
          ].join(" ")}
        >
          {preview ? (
            <img src={preview} alt="Preview" className="h-16 w-16 rounded-[3px] object-cover ring-1 ring-goa-teal/70" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-[3px] border border-dashed border-goa-teal/60 bg-goa-teal/10 text-goa-teal">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c1.5-4 4.5-6 7-6s5.5 2 7 6" />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-base font-semibold text-parchment/95">
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
        className="w-full rounded-md border border-goa-terracotta bg-goa-terracotta py-3.5 font-display text-base font-semibold text-parchment shadow-[inset_0_1px_0_rgba(243,232,208,0.28)] transition-colors hover:bg-goa-gold hover:text-ink-950 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {submitting ? "Running pipeline…" : "Search, match & register"}
      </button>
    </form>
  );
}

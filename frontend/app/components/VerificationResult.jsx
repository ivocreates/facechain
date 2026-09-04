"use client";

export default function VerificationResult({ verification }) {
  if (!verification) return null;
  const { localHash, onChainHash, verified, submitter, timestamp, sourceUrl } = verification;

  return (
    <div
      className={[
        "rounded-[3px] border p-5 shadow-[inset_1px_1px_0_rgba(255,255,255,0.08),inset_-1px_-1px_0_rgba(0,0,0,0.2)]",
        verified ? "border-signal-ok/60 bg-signal-ok/10" : "border-signal-bad/60 bg-signal-bad/10",
      ].join(" ")}
    >
      <p className="font-display text-sm text-parchment/60">Integrity check</p>
      <p className="mt-1 font-mono text-[11px] text-parchment/40">
        Re-fetched from the contract and compared byte-for-byte with the local SHA-256
      </p>

      <div className="mt-4 space-y-3">
        <HashRow label="Local fingerprint" value={localHash} />
        <HashRow label="On-chain fingerprint" value={onChainHash} />
        {sourceUrl && <HashRow label="On-chain source URL" value={sourceUrl} />}
        {submitter && <HashRow label="Submitter" value={submitter} />}
        {timestamp ? (
          <HashRow label="On-chain timestamp" value={new Date(timestamp * 1000).toISOString()} />
        ) : null}
      </div>

      <div
        className={[
          "mt-5 flex items-center gap-2 border-t pt-4 font-display text-base",
          verified ? "border-signal-ok/20 text-signal-ok" : "border-signal-bad/20 text-signal-bad",
        ].join(" ")}
      >
        <span>{verified ? "✓" : "✕"}</span>
        <span>
          {verified
            ? "Tamper-proof: on-chain hash matches local fingerprint"
            : "Verification failed — fingerprints do not match"}
        </span>
      </div>
    </div>
  );
}

function HashRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-parchment/40">{label}</p>
      <p className="mt-0.5 break-all font-mono text-[12px] text-parchment/80">{value}</p>
    </div>
  );
}

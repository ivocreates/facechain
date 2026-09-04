"use client";

const STAGES = [
  { key: "upload", label: "Intake" },
  { key: "faceDetection", label: "Face detection" },
  { key: "faceEncoding", label: "Face encoding" },
  { key: "reverseSearch", label: "Reverse-image search" },
  { key: "matchVerification", label: "Face match" },
  { key: "fingerprint", label: "Fingerprint" },
  { key: "blockchain", label: "On-chain register" },
  { key: "verification", label: "Re-verification" },
];

function isDone(entry) {
  return entry?.status === "ok" || entry?.status === "skipped" || entry?.status === "success";
}

export default function Pipeline({ stages, activeStage, error }) {
  return (
    <ol className="relative">
      {STAGES.map((stage, i) => {
        const entry = stages?.[stage.key];
        const awaitingWallet = entry?.status === "awaiting-wallet";
        const status = isDone(entry)
          ? "done"
          : activeStage === stage.key || awaitingWallet
          ? "active"
          : "pending";
        const failed = error && activeStage === stage.key;

        return (
          <li key={stage.key} className="relative pl-10 pb-8 last:pb-0">
            {i < STAGES.length - 1 && (
              <span className="absolute left-[15px] top-7 bottom-0 w-px stage-line" />
            )}
            <span
              className={[
                "absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs",
                failed
                  ? "border-signal-bad text-signal-bad"
                  : status === "done"
                  ? "border-seal bg-seal text-ink-950"
                  : status === "active"
                  ? "border-seal text-seal pulse-soft"
                  : "border-ink-500 text-ink-500",
              ].join(" ")}
            >
              {status === "done" ? "✓" : i + 1}
            </span>
            <div>
              <p
                className={[
                  "font-display text-[15px]",
                  status === "pending" ? "text-parchment/40" : "text-parchment",
                ].join(" ")}
              >
                {stage.label}
              </p>
              {status === "active" && !failed && (
                <p className="mt-0.5 font-mono text-[11px] text-seal/80">
                  {awaitingWallet ? "approve in your wallet…" : "processing…"}
                </p>
              )}
              {failed && (
                <p className="mt-0.5 font-mono text-[11px] text-signal-bad">{error}</p>
              )}
              {status === "done" && stageDetail(stage.key, stages)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function stageDetail(key, stages) {
  const s = stages[key];
  if (!s) return null;
  if (key === "reverseSearch") {
    if (s.status === "skipped") {
      return <p className="mt-0.5 font-mono text-[11px] text-parchment/50">{s.reason}</p>;
    }
    return (
      <p className="mt-0.5 font-mono text-[11px] text-parchment/50">
        {s.provider}
        {s.resultCount != null ? ` · ${s.resultCount} hits` : ""}
        {s.guessLabel ? ` · ${s.guessLabel}` : ""}
      </p>
    );
  }
  if (key === "matchVerification") {
    return (
      <p className="mt-0.5 font-mono text-[11px] text-parchment/50">
        similarity {s.similarityScore}% — {s.matchStatus}
      </p>
    );
  }
  if (key === "fingerprint") {
    return <p className="mt-0.5 truncate font-mono text-[11px] text-parchment/50">{s.hash}</p>;
  }
  if (key === "blockchain") {
    return (
      <p className="mt-0.5 font-mono text-[11px] text-parchment/50">
        record #{s.recordId}
        {s.blockNumber ? ` · block ${s.blockNumber}` : ""}
        {s.alreadyRegistered ? " · already on chain" : ""}
      </p>
    );
  }
  if (key === "verification") {
    return (
      <p className={"mt-0.5 font-mono text-[11px] " + (s.verified ? "text-signal-ok" : "text-signal-bad")}>
        {s.verified ? "hashes match" : "hash mismatch"}
      </p>
    );
  }
  return null;
}

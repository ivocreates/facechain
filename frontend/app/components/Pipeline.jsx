"use client";

const STAGES = [
  { key: "upload", label: "Face scan", tone: "teal" },
  { key: "faceDetection", label: "Face identification", tone: "teal" },
  { key: "faceEncoding", label: "Face encoding", tone: "teal" },
  { key: "reverseSearch", label: "Web / social search", tone: "terracotta" },
  { key: "matchVerification", label: "Match discovered", tone: "terracotta" },
  { key: "fingerprint", label: "Data fingerprint", tone: "gold" },
  { key: "blockchain", label: "Blockchain record", tone: "gold" },
  { key: "verification", label: "Verified", tone: "olive" },
];

const TONE_CLASSES = {
  teal: {
    active: "border-goa-teal bg-goa-teal/15 text-goa-teal",
    done: "border-goa-teal bg-goa-teal text-parchment",
    detail: "text-goa-teal",
  },
  terracotta: {
    active: "border-goa-terracotta bg-goa-terracotta/15 text-goa-terracotta",
    done: "border-goa-terracotta bg-goa-terracotta text-parchment",
    detail: "text-goa-terracotta",
  },
  gold: {
    active: "border-goa-gold bg-goa-gold/15 text-goa-gold",
    done: "border-goa-gold bg-goa-gold text-ink-950",
    detail: "text-goa-gold",
  },
  olive: {
    active: "border-goa-olive bg-goa-olive/15 text-goa-olive",
    done: "border-goa-olive bg-goa-olive text-parchment",
    detail: "text-goa-olive",
  },
};

function isDone(entry) {
  return entry?.status === "ok" || entry?.status === "skipped" || entry?.status === "success";
}

export default function Pipeline({ stages, activeStage, error }) {
  return (
    <ol className="relative">
      {STAGES.map((stage, i) => {
        const tone = TONE_CLASSES[stage.tone];
        const entry = stages?.[stage.key];
        const awaitingWallet = entry?.status === "awaiting-wallet";
        const status = isDone(entry)
          ? "done"
          : activeStage === stage.key || awaitingWallet
          ? "active"
          : "pending";
        const failed = error && activeStage === stage.key;

        return (
          <li key={stage.key} className="relative pl-11 pb-7 last:pb-0">
            {i < STAGES.length - 1 && (
              <span className="absolute left-[16px] top-8 bottom-0 w-px stage-line" />
            )}
            <span
              className={[
                "absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border font-mono text-[11px]",
                failed
                  ? "border-signal-bad bg-signal-bad/15 text-signal-bad"
                  : status === "done"
                  ? tone.done
                  : status === "active"
                  ? tone.active + " pulse-soft"
                  : "border-parchment/20 text-parchment/35",
              ].join(" ")}
            >
              {status === "done" ? "✓" : i + 1}
            </span>
            <div>
              <p
                className={[
                  "font-display text-lg leading-none",
                  status === "pending" ? "text-parchment/40" : "text-parchment/95",
                ].join(" ")}
              >
                {stage.label}
              </p>
              {status === "active" && !failed && (
                <p className={"mt-1 font-mono text-[10px] uppercase tracking-[0.1em] " + tone.detail}>
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

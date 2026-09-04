"use client";

import { useEffect, useState } from "react";

export default function VerificationResult({ verification, blockchain, fingerprint }) {
  const [stampVisible, setStampVisible] = useState(false);

  useEffect(() => {
    setStampVisible(false);
    if (!verification?.verified) return undefined;

    const stampTimer = window.setTimeout(() => setStampVisible(true), 450);
    return () => window.clearTimeout(stampTimer);
  }, [verification?.verified, verification?.onChainHash]);

  if (!verification) return null;
  const { localHash, onChainHash, verified, submitter, timestamp, sourceUrl } = verification;
  const date = timestamp ? new Date(timestamp * 1000) : null;
  const formattedTimestamp = date
    ? `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)} UTC`
    : "Pending";

  if (!verified) {
    return (
      <div className="rounded-[3px] border border-signal-bad/60 bg-signal-bad/10 p-5 text-signal-bad">
        <p className="font-display text-lg">Verification failed</p>
        <p className="mt-1 font-mono text-[11px]">The local and on-chain fingerprints do not match.</p>
      </div>
    );
  }

  return (
    <section className="archival-certificate">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-950/25 pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-950/65">
            HH Goa - Digital Archive
          </p>
          <h2 className="mt-1 font-display text-2xl text-ink-950">Authenticated record</h2>
        </div>
        <span className="border border-ink-950/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-950/80">
          Registry copy
        </span>
      </header>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_210px]">
        <dl className="order-2 space-y-3 text-sm sm:order-1">
          <RecordRow label="Source" value={sourceUrl ? "Discovered web content" : "Registered web content"} />
          <RecordRow label="Match" value="Face identification" />
          <RecordRow label="Fingerprint" value={`SHA-256: ${shortHash(fingerprint || localHash)}`} />
          <RecordRow label="Blockchain" value={blockchain?.network || "Sepolia"} />
          <RecordRow label="Block" value={blockchain?.blockNumber ? `#${blockchain.blockNumber}` : "Confirmed"} />
          <RecordRow label="Transaction" value={shortHash(blockchain?.transactionHash)} mono />
          <RecordRow label="Timestamp" value={formattedTimestamp} />
        </dl>

        <div className="order-1 flex flex-col items-center sm:order-2">
          <div className={"archive-stamp " + (stampVisible ? "archive-stamp--placed" : "archive-stamp--waiting")}>
            <div className="archive-stamp__inner">
              <span className="archive-stamp__ornament">+</span>
              <span className="archive-stamp__mark">&#10003;</span>
              <span className="archive-stamp__label">On-chain</span>
              <span className="archive-stamp__label">Verified</span>
              <span className="archive-stamp__ornament">+</span>
            </div>
            <span className="archive-stamp__top">HH Goa</span>
            <span className="archive-stamp__bottom">Authenticated Record</span>
          </div>
          <p className={"mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-950/70 " + (stampVisible ? "stamp-status--visible" : "stamp-status--waiting")}>
            Verified on-chain
          </p>
        </div>
      </div>

      <p className={"stamp-details mt-6 border-t border-ink-950/25 pt-3 font-mono text-[10px] leading-relaxed text-ink-950/65 " + (stampVisible ? "stamp-details--visible" : "")}>
        LOCAL {shortHash(localHash)} / CHAIN {shortHash(onChainHash)}
        {submitter ? ` / SIGNED ${shortHash(submitter)}` : ""}
      </p>
    </section>
  );
}

function RecordRow({ label, value, mono }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-b border-ink-950/15 pb-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-950/60">{label}</dt>
      <dd className={(mono ? "font-mono " : "") + "min-w-0 break-all text-right text-[13px] text-ink-950/85"}>{value || "N/A"}</dd>
    </div>
  );
}

function shortHash(value) {
  if (!value) return "N/A";
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

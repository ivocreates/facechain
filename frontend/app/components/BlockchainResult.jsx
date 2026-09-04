"use client";

const EXPLORER_BASE = "https://sepolia.etherscan.io";

export default function BlockchainResult({ blockchain, fingerprint, canonical }) {
  if (!blockchain) return null;
  const isLocal = blockchain.chainId === 31337;
  const isSepolia = blockchain.chainId === 11155111;
  const label = isLocal ? "Local chain (Anvil)" : isSepolia ? "Ethereum Sepolia" : blockchain.network;
  const statusLabel = blockchain.alreadyRegistered ? "already registered" : blockchain.status;

  return (
    <div className="rounded border hairline bg-ink-800/50 p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm text-parchment/60">{label}</p>
        <span className="rounded-full border border-signal-ok/30 bg-signal-ok/10 px-2 py-0.5 font-mono text-[10px] text-signal-ok">
          {statusLabel}
        </span>
      </div>

      <dl className="mt-4 space-y-2.5 text-sm">
        <Row label="Contract" value={blockchain.contractAddress} mono />
        <Row label="Record ID" value={`#${blockchain.recordId}`} mono />
        {blockchain.blockNumber != null && (
          <Row label="Block" value={String(blockchain.blockNumber)} mono />
        )}
        {blockchain.transactionHash && (
          <Row label="Transaction" value={blockchain.transactionHash} mono truncate />
        )}
        <Row label="SHA-256" value={fingerprint} mono truncate />
        {blockchain.submitter && <Row label="Signed by" value={blockchain.submitter} mono truncate />}
      </dl>

      {canonical && (
        <details className="mt-4">
          <summary className="cursor-pointer font-mono text-[11px] text-parchment/40">
            Canonical payload
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-ink-950/60 p-3 font-mono text-[11px] text-parchment/70">
            {canonical}
          </pre>
        </details>
      )}

      {isSepolia && blockchain.transactionHash && (
        <a
          href={`${EXPLORER_BASE}/tx/${blockchain.transactionHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded border border-seal/40 px-3 py-1.5 font-mono text-xs text-seal transition-colors hover:bg-seal/10"
        >
          View on Sepolia Etherscan ↗
        </a>
      )}
      {isSepolia && blockchain.contractAddress && (
        <a
          href={`${EXPLORER_BASE}/address/${blockchain.contractAddress}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 ml-3 inline-flex items-center gap-1.5 font-mono text-xs text-parchment/40 hover:text-seal"
        >
          Contract ↗
        </a>
      )}
    </div>
  );
}

function Row({ label, value, mono, truncate }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-parchment/40">{label}</dt>
      <dd
        className={[
          "text-right text-parchment/80",
          mono ? "font-mono text-[12px]" : "",
          truncate ? "max-w-[220px] truncate" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

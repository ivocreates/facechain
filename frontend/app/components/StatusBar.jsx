"use client";

export default function StatusBar({ status, account }) {
  if (!status) {
    return (
      <div className="rounded border hairline bg-ink-800/40 px-4 py-3 font-mono text-[11px] text-parchment/40">
        Checking backend…
      </div>
    );
  }

  if (status.ok === false && !status.search) {
    return (
      <div className="rounded border border-signal-bad/40 bg-signal-bad/[0.06] px-4 py-3 text-sm text-signal-bad">
        Backend is not reachable at the API base URL. Start it with <span className="font-mono">npm run dev</span> in{" "}
        <span className="font-mono">backend/</span>.
      </div>
    );
  }

  const searchOk = status.search?.configured;
  const chainOk = status.chain?.configured && status.chain?.deployed;
  const modelsOk = status.models?.loaded;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Pill
        ok={modelsOk}
        label="Face models"
        detail={modelsOk ? "loaded" : "run npm run download-models"}
      />
      <Pill
        ok={searchOk}
        label="Reverse search"
        detail={searchOk ? status.search.provider : "API key optional if you paste a URL"}
      />
      <Pill
        ok={chainOk}
        label="Registry"
        detail={
          chainOk
            ? `${status.chain.network} · ${short(status.chain.contractAddress)} · ${status.chain.totalRecords ?? 0} records`
            : status.chain?.error || "contract not deployed"
        }
      />
      <Pill
        ok={Boolean(account)}
        label="Wallet"
        detail={account ? short(account) : "connect to sign the tx"}
      />
    </div>
  );
}

function Pill({ ok, label, detail }) {
  return (
    <div className="rounded border hairline bg-ink-800/40 px-3 py-2.5">
      <p className="flex items-center gap-2 font-display text-xs text-parchment/70">
        <span className={ok ? "text-signal-ok" : "text-signal-warn"}>{ok ? "●" : "○"}</span>
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-[11px] text-parchment/40">{detail}</p>
    </div>
  );
}

function short(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

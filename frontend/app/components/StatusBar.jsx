"use client";

export default function StatusBar({ status, account }) {
  if (!status) {
    return (
      <div className="panel-surface px-4 py-3 font-mono text-[11px] text-parchment/55">
        Checking backend…
      </div>
    );
  }

  if (status.ok === false && !status.search) {
    return (
      <div className="rounded-md border border-signal-bad/50 bg-signal-bad/10 px-4 py-3 text-sm text-signal-bad">
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
    <div className="panel-surface px-3.5 py-3">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-parchment/70">
        <span className={ok ? "text-signal-ok" : "text-signal-warn"}>{ok ? "●" : "○"}</span>
        {label}
      </p>
      <p className="mt-1.5 truncate font-mono text-[11px] text-parchment/50">{detail}</p>
    </div>
  );
}

function short(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

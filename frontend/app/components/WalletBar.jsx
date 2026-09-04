"use client";

import { useEffect, useState } from "react";
import { connectWallet, hasInjectedWallet } from "../lib/wallet";

export default function WalletBar({ account, onConnected, onDisconnected }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    setInstalled(hasInjectedWallet());
    if (!window.ethereum) return undefined;

    window.ethereum
      .request?.({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts?.[0]) onConnected(accounts[0]);
      })
      .catch(() => {});

    const onAccounts = (accounts) => {
      if (!accounts?.length) onDisconnected();
      else onConnected(accounts[0]);
    };
    const onChain = () => {
      window.location.reload();
    };
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [onConnected, onDisconnected]);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const { address } = await connectWallet();
      onConnected(address);
    } catch (err) {
      setError(err.message || "Could not connect wallet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {account ? (
        <button
          type="button"
          onClick={onDisconnected}
          className="rounded-md border border-goa-gold/70 bg-goa-gold/10 px-3 py-1.5 font-mono text-xs text-parchment hover:bg-goa-gold/20"
        >
          {short(account)}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy || !installed}
          className="rounded-md border border-goa-gold bg-goa-gold px-3 py-1.5 font-display text-sm font-semibold text-ink-950 hover:bg-parchment disabled:opacity-30"
        >
          {busy ? "Connecting…" : "Connect wallet"}
        </button>
      )}
      {!installed && (
        <p className="font-mono text-[10px] text-signal-warn">Install MetaMask to sign the Sepolia tx</p>
      )}
      {error && <p className="max-w-[240px] text-right font-mono text-[10px] text-signal-bad">{error}</p>}
    </div>
  );
}

function short(addr) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

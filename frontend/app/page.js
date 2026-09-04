"use client";

import { useCallback, useEffect, useState } from "react";
import FaceUpload from "./components/FaceUpload";
import Pipeline from "./components/Pipeline";
import SearchResult from "./components/SearchResult";
import BlockchainResult from "./components/BlockchainResult";
import VerificationResult from "./components/VerificationResult";
import StatusBar from "./components/StatusBar";
import WalletBar from "./components/WalletBar";
import { registerWithWallet } from "./lib/wallet";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

const STAGE_ORDER = [
  "upload",
  "faceDetection",
  "faceEncoding",
  "reverseSearch",
  "matchVerification",
  "fingerprint",
  "blockchain",
  "verification",
];

export default function Home() {
  const [submitting, setSubmitting] = useState(false);
  const [stages, setStages] = useState({});
  const [activeStage, setActiveStage] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [account, setAccount] = useState(null);

  const onConnected = useCallback((address) => setAccount(address), []);
  const onDisconnected = useCallback(() => setAccount(null), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/pipeline/status`);
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setStatus({ ok: false });
      }
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleSubmit({ file }) {
    if (!account) {
      setError("Connect your wallet first. MetaMask will pop up to confirm the Sepolia transaction.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);
    setStages({});
    setActiveStage("upload");

    const form = new FormData();
    form.append("image", file);

    try {
      const res = await fetch(`${API_BASE}/api/pipeline/run/stream`, {
        method: "POST",
        body: form,
      });

      if (!res.ok && !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Pipeline failed.");
        return;
      }

      let pipelineData = null;
      await consumeSSE(res, (event, data) => {
        if (event === "stage") {
          const { key, ...rest } = data;
          setActiveStage(key);
          setStages((prev) => ({ ...prev, [key]: rest }));
        }
        if (event === "result") {
          pipelineData = data;
          setStages(data.stages || {});
        }
        if (event === "error") {
          setError(data.message || "Pipeline failed.");
          setStages(data.stages || {});
          setActiveStage(firstIncompleteStage(data.stages || {}));
        }
      });

      if (!pipelineData?.success) return;

      setActiveStage("blockchain");
      setStages((prev) => ({ ...prev, blockchain: { status: "awaiting-wallet" } }));

      const chain = await registerWithWallet({
        contractAddress: status?.chain?.contractAddress,
        hashBytes32: pipelineData.fingerprint.hashBytes32,
        sourceUrl: pipelineData.match.url,
      });

      const merged = {
        ...pipelineData,
        blockchain: chain,
        verification: chain.verification,
        stages: {
          ...pipelineData.stages,
          blockchain: { status: "ok", ...chain },
          verification: {
            status: "ok",
            localHash: chain.verification.localHash,
            onChainHash: chain.verification.onChainHash,
            verified: chain.verification.verified,
          },
        },
      };
      setStages(merged.stages);
      setActiveStage(null);
      setResult(merged);
    } catch (err) {
      const message =
        err?.message || "Could not reach the backend. Is it running on " + API_BASE + "?";
      setError(message);
      setActiveStage("blockchain");
    } finally {
      setSubmitting(false);
      fetch(`${API_BASE}/api/pipeline/status`)
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => {});
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-9">
      <header className="panel-surface mb-4 flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="case-file-label text-goa-gold">HH Goa / Investigation Registry</p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-parchment">FaceChain</h1>
          <p className="mt-1 text-sm text-parchment/65">
            Provenance research for visual content, secured on-chain.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <span className="font-mono text-[11px] text-seal">Sepolia / 11155111</span>
          <WalletBar account={account} onConnected={onConnected} onDisconnected={onDisconnected} />
        </div>
      </header>

      <StatusBar status={status} account={account} />

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section className="panel-surface p-5 sm:p-6">
            <div className="mb-6 flex items-center justify-between border-b hairline pb-3">
              <div>
                <p className="case-file-label text-goa-teal">Case intake</p>
                <p className="mt-1 font-display text-2xl text-parchment">Open a verification record</p>
              </div>
              <span className="rounded-full border border-goa-teal/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-goa-teal">Ready</span>
            </div>
            <FaceUpload
              onSubmit={handleSubmit}
              submitting={submitting}
              searchConfigured={Boolean(status?.search?.configured)}
              statusLoaded={Boolean(status?.search)}
              walletConnected={Boolean(account)}
            />
          </section>

          {error && (
            <div className="rounded-[3px] border border-signal-bad/60 bg-signal-bad/10 p-4 text-sm text-signal-bad">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <SearchResult
                match={result.match}
                candidates={result.candidates}
                search={result.search}
              />
              <BlockchainResult
                blockchain={result.blockchain}
                fingerprint={result.fingerprint?.hash}
                canonical={result.fingerprint?.canonicalContent}
              />
              <VerificationResult
                verification={result.verification}
                blockchain={result.blockchain}
                fingerprint={result.fingerprint?.hash}
              />
            </div>
          )}
        </div>

        <aside className="panel-surface sticky top-5 self-start p-5">
          <p className="case-file-label text-goa-gold">Chain of custody</p>
          <p className="mb-6 mt-1 border-b hairline pb-3 font-display text-2xl text-parchment">Pipeline</p>
          <Pipeline stages={stages} activeStage={activeStage} error={error} />
        </aside>
      </div>
    </main>
  );
}

async function consumeSSE(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const part of parts) {
      if (!part.trim()) continue;
      let event = "message";
      const dataLines = [];
      for (const line of part.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;
      try {
        onEvent(event, JSON.parse(dataLines.join("\n")));
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}

function firstIncompleteStage(stages) {
  return (
    STAGE_ORDER.find((key) => {
      const s = stages[key]?.status;
      return s !== "ok" && s !== "skipped";
    }) || null
  );
}

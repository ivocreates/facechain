"use client";

export default function SearchResult({ match, candidates, search }) {
  if (!match) return null;
  const score = match.similarityScore;
  const scoreColor =
    score >= 75 ? "text-signal-ok" : score >= 50 ? "text-seal" : "text-signal-bad";
  const others = (candidates || []).filter((c) => c.url !== match.url);

  return (
    <div className="rounded border hairline bg-ink-800/50 p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm text-parchment/60">Best match</p>
        {search?.provider && (
          <span className="font-mono text-[10px] text-parchment/35">{search.provider}</span>
        )}
      </div>

      {search?.guessLabel && (
        <p className="mt-2 font-mono text-[11px] text-parchment/45">
          web guess: {search.guessLabel}
          {search.discovered != null ? ` · ${search.discovered} pages found` : ""}
        </p>
      )}

      <div className="mt-3 flex items-end gap-3">
        <span className={"font-display text-4xl " + scoreColor}>{score}%</span>
        <span className="mb-1 font-mono text-xs text-parchment/40">face similarity</span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-parchment/40">{match.matchStatus}</p>

      <dl className="mt-4 space-y-2 border-t hairline pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-parchment/40">Source</dt>
          <dd className="truncate text-right text-parchment/80">
            <a href={match.url} target="_blank" rel="noreferrer" className="hover:text-seal">
              {match.url}
            </a>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-parchment/40">Platform</dt>
          <dd className="text-parchment/80">{match.platform}</dd>
        </div>
        {match.title && (
          <div className="flex justify-between gap-4">
            <dt className="text-parchment/40">Title</dt>
            <dd className="truncate text-right text-parchment/80">{match.title}</dd>
          </div>
        )}
      </dl>

      {others.length > 0 && (
        <div className="mt-4 border-t hairline pt-4">
          <p className="mb-2 font-mono text-[11px] text-parchment/40">Other scored candidates</p>
          <ul className="space-y-2">
            {others.slice(0, 5).map((c) => (
              <li key={c.url} className="flex items-center justify-between gap-3 text-xs">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-parchment/70 hover:text-seal"
                >
                  {c.title || c.platform || c.url}
                </a>
                <span className="shrink-0 font-mono text-parchment/40">{c.similarityScore}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

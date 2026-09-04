# FaceChain — Face Identification & Blockchain Content Verification

## 1. Problem statement

Content provenance is hard to prove after the fact. Once an image or post
exists online, there's no lightweight, tamper-evident way to say "this exact
piece of content, at this fingerprint, was reviewed and registered at this
time" — and to re-check that claim later without trusting a database that
could quietly be edited.

## 2. Objective

Given a reference face photo, the system:

1. Detects and encodes the reference face.
2. Runs a genuine reverse-image / visual web search (Google Cloud Vision
   Web Detection, Google Lens via SerpAPI, or Bing Visual Search) to find
   pages where that image appears.
3. Downloads candidates, scores each by face-embedding similarity, and
   picks the best match.
4. Builds a canonical, deterministic fingerprint of that content.
5. Registers the fingerprint's SHA-256 hash on Ethereum Sepolia (or local
   Anvil).
6. Re-fetches the on-chain record and re-verifies the local hash against it.

Paste a content URL instead (or as well) if you want to pin a specific page,
or if no search API key is configured.

This is reverse-image search of the uploaded photo — the same class of
tool as Google Lens — not a biometric people-search database. Face
embeddings never leave backend memory and are never written on-chain.

## 3. Architecture

```
 USER
  │
  ▼
 NEXT.JS FRONTEND  (upload, live pipeline, results)
  │  POST /api/pipeline/run/stream
  ▼
 EXPRESS BACKEND
  │
  ├─ image.service        validate / normalize upload, fetch candidate URLs
  ├─ face.service         face detection + 128-d embedding (face-api.js)
  ├─ search.service       reverse-image search (Vision / Lens / Bing)
  ├─ verification.service score candidates, pick best face match
  ├─ hash.service         canonicalize + SHA-256 fingerprint
  └─ blockchain.service   ethers.js → ContentRegistry
  │
  ▼
 CONTENT REGISTRY CONTRACT (Solidity, Foundry)
  registerContent() → tx confirmed → getRecord() / verifyContent()
  │
  ▼
 RE-VERIFICATION: local hash vs. on-chain hash → VERIFIED ✓ / FAILED
```

## 4. Tech stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend**: Node.js, Express, Multer, Sharp, `face-api.js` (+ `canvas`),
  `ethers.js`, Node's built-in `crypto`
- **Blockchain**: Solidity, Foundry (Anvil for local dev), Ethereum Sepolia

## 5. Folder structure

```
face-chain-verifier/
├── frontend/           Next.js app (upload UI, pipeline ledger, results)
├── backend/             Express API (face, hash, blockchain services)
├── contracts/           Foundry project: ContentRegistry.sol + tests
├── samples/              Local scratch space for test images (gitignored)
└── README.md
```

## 6. Smart contract

`contracts/src/ContentRegistry.sol` stores, per record: a `bytes32` content
hash, source URL, `block.timestamp`, and the submitting wallet address. It
exposes `registerContent`, `getRecord`, `verifyContent`,
`recordIdForHash`, and `totalRecords`, and emits `ContentRegistered` on
every registration.

**It never stores the raw image, the face embedding, or any biometric data
— only a fingerprint of already-public content.**

### Tests (`contracts/test/ContentRegistry.t.sol`)

12 tests, all passing, including the core tamper-detection case:

```
register(hash A) → verify(hash A) → true
register(hash A) → verify(hash B) → false
```

Run them:

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit   # if lib/forge-std isn't present
forge test -vv
```

This was run in development and confirmed live against a local Anvil chain
(deploy → register → verify true → verify tampered hash false →
`totalRecords()` incremented correctly) using `cast send` / `cast call`, not
just the Foundry test runner.

## 7. Setup instructions

### 7.1 Contracts

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
forge test -vv

# Local (Anvil)
anvil                                   # in one terminal
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key <anvil-account-0-private-key>

# Sepolia (use a dedicated test wallet — see Security section)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $SEPOLIA_RPC_URL --broadcast \
  --private-key $PRIVATE_KEY --verify
```

Note the deployed `ContentRegistry` address — you'll need it for the
backend `.env`. On a fresh Anvil instance the first deployment is
`0x5FbDB2315678afecb367f032d93F642f64180aa3`.

Helper: `bash scripts/setup-local-chain.sh` starts Anvil (if needed) and
deploys the contract.

### 7.2 Backend

```bash
cd backend
cp .env.example .env
# Optional, for reverse-image search (Google Lens-class, not hardcoded):
#   GOOGLE_VISION_API_KEY=...     Cloud Vision WEB_DETECTION (preferred)
#   SERPAPI_KEY=...               Google Lens
#   BING_VISUAL_SEARCH_KEY=...
# Fill RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS (Anvil defaults are in .env.example).
npm install
npm run download-models     # fetches face-api.js model weights into backend/models/
npm run dev
```

> **Native dependency note:** `face-api.js` depends on the `canvas` package,
> which compiles a native Node addon. On most machines `npm install` picks
> up a prebuilt binary automatically. If it tries to build from source and
> fails, install the underlying system libraries first, e.g. on
> Debian/Ubuntu: `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`.

### 7.3 Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Visit `http://localhost:3000`.

## 8. Environment variables

**backend/.env**

| Variable | Description |
|---|---|
| `PORT` | Backend port (default `4000`) |
| `FRONTEND_ORIGIN` | Allowed CORS origin |
| `RPC_URL` | Sepolia (or Anvil) RPC endpoint |
| `PRIVATE_KEY` | **Dedicated test wallet** private key — never your primary wallet |
| `CONTRACT_ADDRESS` | Deployed `ContentRegistry` address |
| `GOOGLE_VISION_API_KEY` | Cloud Vision Web Detection (preferred reverse-image search) |
| `SERPAPI_KEY` | Google Lens via SerpAPI |
| `BING_VISUAL_SEARCH_KEY` | Bing Visual Search |
| `SEARCH_PROVIDER` | `auto` (default), `google_vision`, `serpapi`, or `bing` |

**frontend/.env.local**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE` | Backend URL (default `http://localhost:4000`) |

## 9. How the face pipeline works

1. Upload is validated (format, size, decodability) and normalized
   (EXIF-rotated, resized) with Sharp.
2. `face-api.js` (SSD MobileNet detector + 68-point landmarks + a
   recognition net) detects exactly one face and produces a 128-dimension
   embedding. Zero or multiple faces stop the pipeline with a clear error.
3. Reverse-image search returns pages/images that match the upload. Each
   downloadable candidate is encoded the same way. The highest face-
   similarity score wins.
4. Similarity is the normalized inverse of Euclidean distance between the
   two embeddings, shown as a 0–100% score alongside a plain-language
   `matchStatus` — never presented as certain identity. Face recognition is
   probabilistic; false positives and false negatives are possible.

## 10. How fingerprinting works

`backend/src/utils/canonicalize.js` builds a fixed-key-order JSON object
from stable fields only (normalized URL, platform, title, an image content
hash, rounded similarity score) — explicitly excluding volatile data like
fetch timestamps, so the same logical content always canonicalizes
identically. `hash.service.js` SHA-256s that canonical string. This was
verified directly: the same content with different URL tracking params /
casing / whitespace produces the identical hash.

## 11. How blockchain verification works

`blockchain.service.js` wraps `ethers.js` calls against `ContentRegistry`:
`registerContent` submits and awaits a confirmed transaction, pulling the
assigned `recordId` out of the emitted event rather than assuming it.
`verifyOnChain` re-fetches the stored record and compares its hash against
the locally computed one, byte for byte.

## 12. Limitations

- Reverse-image search needs a provider API key. Without one, paste a
  content URL to still run face-match → fingerprint → chain.
- Face recognition is probabilistic. A high similarity score is not proof
  of identity, and low scores don't rule out a match.
- Candidate images may be behind auth, rate-limited, or otherwise
  unfetchable; the pipeline reports this rather than guessing.
- SHA-256 fingerprints are only as good as the canonicalization step — if
  the underlying content itself changes, the fingerprint will no longer
  match, which is the intended tamper-evidence behavior, not a bug.
- `ContentRegistry.registerContent` reverts on an exact duplicate hash —
  registering the identical content twice is treated as redundant, not an
  update.

## 13. Security & privacy

- Use a **dedicated Sepolia test wallet**, funded from a faucet — never a
  primary wallet.
- `.env` files, private keys, and uploaded images are all gitignored.
- Uploaded images are processed to a temp path and deleted after the
  pipeline completes; nothing biometric is persisted to disk beyond the
  request's lifetime.
- Face embeddings never leave backend memory and are never sent to the
  smart contract — only a content hash, URL, timestamp, and wallet address
  go on-chain.
- All chain writes happen server-side; the frontend never holds a private
  key.

## 14. License

MIT.

#!/usr/bin/env bash
# Start a local Anvil chain and deploy ContentRegistry.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/contracts"

export PRIVATE_KEY="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

if ! curl -sSf -m 1 http://127.0.0.1:8545 >/dev/null 2>&1; then
  echo "Starting Anvil on :8545…"
  anvil --host 127.0.0.1 --port 8545 >/tmp/facechain-anvil.log 2>&1 &
  sleep 1
fi

echo "Deploying ContentRegistry…"
forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast --private-key "$PRIVATE_KEY"

echo
echo "Default Anvil contract address (first deployment): 0x5FbDB2315678afecb367f032d93F642f64180aa3"
echo "Copy that into backend/.env as CONTRACT_ADDRESS if this is a fresh chain."

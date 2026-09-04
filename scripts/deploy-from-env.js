#!/usr/bin/env node
/**
 * Fund the backend/.env wallet on local Anvil (if needed) and deploy
 * ContentRegistry from that wallet. Writes CONTRACT_ADDRESS back to .env.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { ethers } = require(path.join(__dirname, "../backend/node_modules/ethers"));

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, "backend/.env");
const ANVIL_FUNDER =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function loadEnvFile(file) {
  const parsed = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    parsed[t.slice(0, i)] = t.slice(i + 1);
  }
  return parsed;
}

function with0x(key) {
  const k = String(key || "").trim();
  return k.startsWith("0x") ? k : `0x${k}`;
}

function setEnvValue(file, name, value) {
  const src = fs.readFileSync(file, "utf8");
  const re = new RegExp(`^${name}=.*$`, "m");
  const next = re.test(src) ? src.replace(re, `${name}=${value}`) : `${src.trim()}\n${name}=${value}\n`;
  fs.writeFileSync(file, next);
}

async function main() {
  const parsed = loadEnvFile(ENV_PATH);
  const rpcUrl = (parsed.RPC_URL || "http://127.0.0.1:8545").trim();
  const privateKey = with0x(parsed.PRIVATE_KEY);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const network = await provider.getNetwork();

  console.log("Deployer:", wallet.address);
  console.log("Chain ID:", Number(network.chainId));

  if (Number(network.chainId) === 31337) {
    const funder = new ethers.Wallet(ANVIL_FUNDER, provider);
    const bal = await provider.getBalance(wallet.address);
    if (bal < ethers.parseEther("1")) {
      console.log("Funding deployer from Anvil account #0…");
      const tx = await funder.sendTransaction({
        to: wallet.address,
        value: ethers.parseEther("50"),
      });
      await tx.wait();
    }
  }

  const forgeEnv = {
    ...process.env,
    PRIVATE_KEY: privateKey,
    SEPOLIA_RPC_URL: rpcUrl,
  };
  const result = spawnSync(
    "forge",
    ["script", "script/Deploy.s.sol:Deploy", "--rpc-url", rpcUrl, "--broadcast"],
    { cwd: path.join(ROOT, "contracts"), env: forgeEnv, encoding: "utf8" }
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  const broadcastPath = path.join(
    ROOT,
    "contracts/broadcast/Deploy.s.sol",
    String(Number(network.chainId)),
    "run-latest.json"
  );
  const data = JSON.parse(fs.readFileSync(broadcastPath, "utf8"));
  const created = [...data.transactions].reverse().find((t) => t.transactionType === "CREATE");
  if (!created?.contractAddress) {
    throw new Error("Could not find CREATE transaction in Forge broadcast");
  }
  const address = ethers.getAddress(created.contractAddress);
  setEnvValue(ENV_PATH, "CONTRACT_ADDRESS", address);
  console.log("ContentRegistry deployed at:", address);
  console.log("Wrote CONTRACT_ADDRESS to backend/.env");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

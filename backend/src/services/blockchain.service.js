const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const { PipelineError } = require("./image.service");

/**
 * blockchain.service.js
 * All on-chain communication with ContentRegistry lives here. This is the
 * ONLY module that should ever touch a private key.
 */

const CONTRACT_ABI = [
  "function registerContent(bytes32 contentHash, string sourceUrl) external returns (uint256 recordId)",
  "function getRecord(uint256 recordId) external view returns (tuple(uint256 id, bytes32 contentHash, string sourceUrl, uint256 timestamp, address submitter))",
  "function verifyContent(uint256 recordId, bytes32 contentHash) external view returns (bool)",
  "function recordIdForHash(bytes32 contentHash) external view returns (uint256)",
  "function totalRecords() external view returns (uint256)",
  "error DuplicateHash(bytes32 contentHash, uint256 existingRecordId)",
  "event ContentRegistered(uint256 indexed recordId, bytes32 indexed contentHash, string sourceUrl, uint256 timestamp, address indexed submitter)",
];

let provider;
let wallet;
let contract;
let initError = null;

function resetClient() {
  provider = undefined;
  wallet = undefined;
  contract = undefined;
  initError = null;
}

function normalizePrivateKey(raw) {
  const key = String(raw || "").trim();
  if (!key) return key;
  return key.startsWith("0x") ? key : `0x${key}`;
}

function init() {
  if (contract) return;
  const rpcUrl = (process.env.RPC_URL || "").trim();
  const contractAddress = (process.env.CONTRACT_ADDRESS || "").trim();

  if (!rpcUrl || !contractAddress || contractAddress.includes("DEPLOYED")) {
    initError = "missing RPC_URL or CONTRACT_ADDRESS";
    throw new PipelineError(
      "CHAIN_NOT_CONFIGURED",
      "Blockchain is not configured. Set RPC_URL and CONTRACT_ADDRESS (see backend/.env.example)."
    );
  }

  provider = new ethers.JsonRpcProvider(rpcUrl);
  const privateKey = normalizePrivateKey(process.env.PRIVATE_KEY);
  wallet = privateKey ? new ethers.Wallet(privateKey, provider) : null;
  contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet || provider);
  initError = null;
}

function getContract() {
  if (!contract) init();
  return contract;
}

async function getStatus() {
  try {
    init();
  } catch (err) {
    return {
      configured: false,
      deployed: false,
      error: err.message,
    };
  }

  try {
    const network = await provider.getNetwork();
    const address = await contract.getAddress();
    const code = await provider.getCode(address);
    const deployed = code && code !== "0x";
    let totalRecords = null;
    if (deployed) {
      totalRecords = Number(await contract.totalRecords());
    }
    return {
      configured: true,
      deployed,
      network: labelFor(network),
      chainId: Number(network.chainId),
      contractAddress: address,
      wallet: wallet?.address || null,
      walletMode: "browser",
      totalRecords,
      explorerTxBase: Number(network.chainId) === 11155111 ? "https://sepolia.etherscan.io/tx/" : null,
    };
  } catch (err) {
    return {
      configured: true,
      deployed: false,
      error: err.message,
    };
  }
}

/**
 * Registers a content fingerprint on-chain and waits for confirmation.
 * Re-registering the same hash is treated as success: we look up the
 * existing record instead of failing the demo on a duplicate.
 */
async function registerContent(hashBytes32, sourceUrl) {
  const c = getContract();
  const network = await provider.getNetwork();

  const existingId = await c.recordIdForHash(hashBytes32);
  if (existingId && existingId !== 0n) {
    const record = await c.getRecord(existingId);
    return {
      network: labelFor(network),
      chainId: Number(network.chainId),
      contractAddress: await c.getAddress(),
      recordId: existingId.toString(),
      transactionHash: null,
      blockNumber: null,
      status: "already-registered",
      alreadyRegistered: true,
      submitter: record.submitter,
      timestamp: Number(record.timestamp),
    };
  }

  let tx;
  try {
    tx = await c.registerContent(hashBytes32, sourceUrl);
  } catch (err) {
    const duplicateId = await recoverDuplicateId(c, hashBytes32, err);
    if (duplicateId) {
      const record = await c.getRecord(duplicateId);
      return {
        network: labelFor(network),
        chainId: Number(network.chainId),
        contractAddress: await c.getAddress(),
        recordId: duplicateId.toString(),
        transactionHash: null,
        blockNumber: null,
        status: "already-registered",
        alreadyRegistered: true,
        submitter: record.submitter,
        timestamp: Number(record.timestamp),
      };
    }
    throw new PipelineError("CHAIN_TX_FAILED", explainChainError(err));
  }

  const receipt = await tx.wait();
  if (receipt.status !== 1) {
    throw new PipelineError("CHAIN_TX_FAILED", "On-chain registration transaction failed.");
  }

  let recordId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = c.interface.parseLog(log);
      if (parsed && parsed.name === "ContentRegistered") {
        recordId = parsed.args.recordId.toString();
        break;
      }
    } catch {
      /* not our event */
    }
  }

  return {
    network: labelFor(network),
    chainId: Number(network.chainId),
    contractAddress: await c.getAddress(),
    recordId,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: "success",
    alreadyRegistered: false,
  };
}

async function recoverDuplicateId(c, hashBytes32, err) {
  const id = err?.revert?.args?.[1];
  if (id != null) return id.toString();
  try {
    const existing = await c.recordIdForHash(hashBytes32);
    if (existing && existing !== 0n) return existing.toString();
  } catch {
    /* ignore */
  }
  const msg = String(err?.shortMessage || err?.message || "");
  if (/DuplicateHash/i.test(msg)) {
    try {
      const existing = await c.recordIdForHash(hashBytes32);
      if (existing && existing !== 0n) return existing.toString();
    } catch {
      /* ignore */
    }
  }
  return null;
}

function explainChainError(err) {
  const msg = err?.shortMessage || err?.message || "Transaction failed";
  if (/insufficient funds/i.test(msg)) {
    return "The test wallet has no gas. Fund it from a Sepolia faucet, or use local Anvil.";
  }
  if (/could not coalesce|ECONNREFUSED|NETWORK_ERROR/i.test(msg)) {
    return "Could not reach the RPC endpoint. Is Anvil running, or is the Sepolia RPC URL valid?";
  }
  return `On-chain registration failed: ${msg}`;
}

function labelFor(network) {
  if (Number(network.chainId) === 11155111) return "sepolia";
  if (Number(network.chainId) === 31337) return "anvil";
  return network.name === "unknown" ? `chain-${network.chainId}` : network.name;
}

async function verifyOnChain(recordId, localHashBytes32) {
  const c = getContract();
  const record = await c.getRecord(recordId);
  const onChainHash = record.contentHash;
  const matches = onChainHash.toLowerCase() === localHashBytes32.toLowerCase();
  const contractVerified = await c.verifyContent(recordId, localHashBytes32);

  return {
    recordId: record.id.toString(),
    onChainHash,
    localHash: localHashBytes32,
    sourceUrl: record.sourceUrl,
    timestamp: Number(record.timestamp),
    submitter: record.submitter,
    verified: matches && contractVerified,
    contractVerifyContent: contractVerified,
  };
}

async function getTotalRecords() {
  const c = getContract();
  const total = await c.totalRecords();
  return Number(total);
}

function readDeployedAddressFromBroadcast(chainId) {
  try {
    const broadcastPath = path.join(
      __dirname,
      "../../../contracts/broadcast/Deploy.s.sol",
      String(chainId),
      "run-latest.json"
    );
    const data = JSON.parse(fs.readFileSync(broadcastPath, "utf8"));
    const createTx = data.transactions.find((t) => t.transactionType === "CREATE");
    return createTx ? createTx.contractAddress : null;
  } catch {
    return null;
  }
}

module.exports = {
  registerContent,
  verifyOnChain,
  getTotalRecords,
  getStatus,
  resetClient,
  readDeployedAddressFromBroadcast,
};

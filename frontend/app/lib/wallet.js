"use client";

import { BrowserProvider, Contract } from "ethers";

export const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_HEX = "0xaa36a7";

export const REGISTRY_ABI = [
  "function registerContent(bytes32 contentHash, string sourceUrl) external returns (uint256 recordId)",
  "function getRecord(uint256 recordId) external view returns (tuple(uint256 id, bytes32 contentHash, string sourceUrl, uint256 timestamp, address submitter))",
  "function verifyContent(uint256 recordId, bytes32 contentHash) external view returns (bool)",
  "function recordIdForHash(bytes32 contentHash) external view returns (uint256)",
  "event ContentRegistered(uint256 indexed recordId, bytes32 indexed contentHash, string sourceUrl, uint256 timestamp, address indexed submitter)",
];

export function hasInjectedWallet() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("No wallet found. Install MetaMask (or another injected wallet) and try again.");
  }
  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  await ensureSepolia(provider);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  return {
    address: await signer.getAddress(),
    chainId: Number(network.chainId),
  };
}

export async function ensureSepolia(provider) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) === SEPOLIA_CHAIN_ID) return;
  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: SEPOLIA_HEX }]);
  } catch (err) {
    if (err?.code === 4902 || err?.error?.code === 4902) {
      await provider.send("wallet_addEthereumChain", [
        {
          chainId: SEPOLIA_HEX,
          chainName: "Sepolia",
          nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        },
      ]);
      return;
    }
    throw new Error("Please switch your wallet to Ethereum Sepolia and approve the popup.");
  }
}

export async function registerWithWallet({ contractAddress, hashBytes32, sourceUrl }) {
  if (!window.ethereum) {
    throw new Error("No wallet found. Connect MetaMask first.");
  }
  const provider = new BrowserProvider(window.ethereum);
  await ensureSepolia(provider);
  const signer = await provider.getSigner();
  const contract = new Contract(contractAddress, REGISTRY_ABI, signer);
  const network = await provider.getNetwork();

  const existingId = await contract.recordIdForHash(hashBytes32);
  if (existingId && existingId !== 0n) {
    const record = await contract.getRecord(existingId);
    const verified = await contract.verifyContent(existingId, hashBytes32);
    return {
      network: "sepolia",
      chainId: Number(network.chainId),
      contractAddress,
      recordId: existingId.toString(),
      transactionHash: null,
      blockNumber: null,
      status: "already-registered",
      alreadyRegistered: true,
      submitter: record.submitter,
      timestamp: Number(record.timestamp),
      verification: {
        localHash: hashBytes32,
        onChainHash: record.contentHash,
        verified,
        submitter: record.submitter,
        timestamp: Number(record.timestamp),
        sourceUrl: record.sourceUrl,
      },
    };
  }

  let tx;
  try {
    tx = await contract.registerContent(hashBytes32, sourceUrl);
  } catch (err) {
    if (err?.code === 4001 || err?.info?.error?.code === 4001) {
      throw new Error("Wallet popup was rejected. Approve the transaction to register on Sepolia.");
    }
    const msg = err?.shortMessage || err?.reason || err?.message || "Transaction failed";
    throw new Error(msg);
  }

  const receipt = await tx.wait();
  if (receipt.status !== 1) {
    throw new Error("On-chain registration transaction failed.");
  }

  let recordId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "ContentRegistered") {
        recordId = parsed.args.recordId.toString();
        break;
      }
    } catch {
      /* ignore */
    }
  }

  if (!recordId) {
    const lookedUp = await contract.recordIdForHash(hashBytes32);
    recordId = lookedUp && lookedUp !== 0n ? lookedUp.toString() : null;
  }

  const record = await contract.getRecord(recordId);
  const verified = await contract.verifyContent(recordId, hashBytes32);

  return {
    network: "sepolia",
    chainId: Number(network.chainId),
    contractAddress,
    recordId,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: "success",
    alreadyRegistered: false,
    submitter: record.submitter,
    timestamp: Number(record.timestamp),
    verification: {
      localHash: hashBytes32,
      onChainHash: record.contentHash,
      verified,
      submitter: record.submitter,
      timestamp: Number(record.timestamp),
      sourceUrl: record.sourceUrl,
    },
  };
}

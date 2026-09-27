import type {
  ClarityValue,
  ContractPrincipalCV,
  SomeCV,
  StandardPrincipalCV,
  StringAsciiCV,
  TupleCV,
  UIntCV,
} from "@stacks/transactions";
import { API_BASE, parseContractPrincipal, type ContractPrincipal } from "./config";
import {
  decodeCapabilities,
  encodeCapabilities,
  isStatus,
  type Capability,
  type Passport,
} from "./types";

const NETWORK = "testnet";

/** The Stacks SDK is large, so it is only downloaded the first time it is needed. */
async function sdk() {
  return import("@stacks/transactions");
}

function readString(value: ClarityValue): string {
  return (value as StringAsciiCV).value;
}

function readUint(value: ClarityValue): number {
  return Number((value as UIntCV).value);
}

function readPrincipal(value: ClarityValue): string {
  return (value as StandardPrincipalCV | ContractPrincipalCV).value;
}

function readBool(value: ClarityValue): boolean {
  return value.type === "true";
}

function requireRegistry(registryId: string): ContractPrincipal {
  const registry = parseContractPrincipal(registryId);
  if (!registry) {
    throw new Error("Set the deployed contract-passport address before reading passports.");
  }
  return registry;
}

function decodePassport(fields: Record<string, ClarityValue>): Passport {
  const status = readString(fields["status"]);
  return {
    contractPrincipal: readPrincipal(fields["contract-principal"]),
    name: readString(fields["name"]),
    version: readString(fields["version"]),
    status: isStatus(status) ? status : "active",
    owner: readPrincipal(fields["owner"]),
    capabilities: decodeCapabilities(readUint(fields["capabilities"])),
    selfAttested: readBool(fields["self-attested"]),
    registeredAt: readUint(fields["registered-at"]),
    updatedAt: readUint(fields["updated-at"]),
    updateCount: readUint(fields["update-count"]),
    source: "chain",
  };
}

/** Read a passport from the registry. Returns null when the contract has no passport yet. */
export async function fetchPassport(
  registryId: string,
  targetId: string,
  senderAddress?: string,
): Promise<Passport | null> {
  const registry = requireRegistry(registryId);
  const target = parseContractPrincipal(targetId);
  if (!target) {
    throw new Error("Enter a contract principal like ST3HKMJ7BYNTGV4DG9A33RVBTVJ1GTCGX9GQ5AKPB.contract-passport.");
  }
  const { Cl, fetchCallReadOnlyFunction } = await sdk();
  const result = await fetchCallReadOnlyFunction({
    contractAddress: registry.address,
    contractName: registry.name,
    functionName: "get-passport",
    functionArgs: [Cl.contractPrincipal(target.address, target.name)],
    senderAddress: senderAddress ?? target.address,
    network: NETWORK,
  });
  if (result.type === "none") return null;
  const tuple = (result as SomeCV).value as TupleCV;
  return decodePassport(tuple.value as Record<string, ClarityValue>);
}

/** Number of passports registered in the registry contract. */
export async function fetchPassportCount(
  registryId: string,
  senderAddress: string,
): Promise<number> {
  const registry = requireRegistry(registryId);
  const { fetchCallReadOnlyFunction } = await sdk();
  const result = await fetchCallReadOnlyFunction({
    contractAddress: registry.address,
    contractName: registry.name,
    functionName: "get-passport-count",
    functionArgs: [],
    senderAddress,
    network: NETWORK,
  });
  return readUint(result);
}

/** Clarity arguments for register-contract / update-contract. */
export async function passportArgs(
  target: ContractPrincipal,
  metadata: { name: string; version: string; status: string; capabilities: Capability[] },
): Promise<ClarityValue[]> {
  const { Cl } = await sdk();
  return [
    Cl.contractPrincipal(target.address, target.name),
    Cl.stringAscii(metadata.name),
    Cl.stringAscii(metadata.version),
    Cl.stringAscii(metadata.status),
    Cl.uint(encodeCapabilities(metadata.capabilities)),
  ];
}

export interface TxStatus {
  state: "pending" | "success" | "aborted" | "not_found";
  blockHeight: number | null;
  detail: string;
}

async function readTxStatus(txid: string): Promise<TxStatus> {
  const response = await fetch(`${API_BASE}/extended/v1/tx/${txid}`);
  if (response.status === 404) {
    return {
      state: "not_found",
      blockHeight: null,
      detail: "Transaction is not in the mempool yet.",
    };
  }
  if (!response.ok) {
    return {
      state: "pending",
      blockHeight: null,
      detail: `Node replied with HTTP ${response.status}.`,
    };
  }
  const body = (await response.json()) as {
    tx_status?: string;
    block_height?: number;
    tx_result?: { repr?: string };
  };
  const raw = body.tx_status ?? "unknown";
  const blockHeight = typeof body.block_height === "number" ? body.block_height : null;
  if (raw === "success") {
    return { state: "success", blockHeight, detail: "Confirmed on Stacks testnet." };
  }
  if (raw.startsWith("abort")) {
    return {
      state: "aborted",
      blockHeight,
      detail: body.tx_result?.repr ?? "The transaction was aborted by the contract.",
    };
  }
  return { state: "pending", blockHeight, detail: "Waiting for confirmation..." };
}

/** Poll the Stacks API until the transaction is mined, aborted or the timeout is reached. */
export async function waitForTx(
  txid: string,
  onUpdate: (status: TxStatus) => void,
  timeoutMs = 240_000,
): Promise<TxStatus> {
  const deadline = Date.now() + timeoutMs;
  let last: TxStatus = { state: "pending", blockHeight: null, detail: "Broadcasting..." };
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 6_000));
    try {
      last = await readTxStatus(txid);
    } catch {
      last = { state: "pending", blockHeight: null, detail: "Node unreachable, retrying..." };
    }
    onUpdate(last);
    if (last.state === "success" || last.state === "aborted") return last;
  }
  return last;
}

/** Check that the configured registry contract is really deployed on testnet. */
export async function registryExists(registryId: string): Promise<boolean> {
  const registry = parseContractPrincipal(registryId);
  if (!registry) return false;
  try {
    const response = await fetch(
      `${API_BASE}/v2/contracts/interface/${registry.address}/${registry.name}`,
    );
    return response.ok;
  } catch {
    return false;
  }
}

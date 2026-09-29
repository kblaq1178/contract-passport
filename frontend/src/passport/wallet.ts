import type { StacksProvider } from "@stacks/connect";
import type { ClarityValue } from "@stacks/transactions";

const NETWORK = "testnet";

/** Stacks Connect (and the wallet modal it opens) is loaded on demand. */
async function connectSdk() {
  return import("@stacks/connect");
}

async function txSdk() {
  return import("@stacks/transactions");
}

/** Read the connected testnet STX address from the Stacks Connect session. */
export async function connectedAddress(): Promise<string | null> {
  const { getLocalStorage, isConnected } = await connectSdk();
  if (!isConnected()) return null;
  const stxAddresses = getLocalStorage()?.addresses.stx ?? [];
  const testnet = stxAddresses.find((entry) => entry.address.startsWith("ST"));
  return (testnet ?? stxAddresses[0])?.address ?? null;
}

/**
 * Wallet providers injected by browser extensions, in preference order.
 *
 * The connect modal resolves the wallet you click by treating its id as a `window`
 * property path (getProviderFromId splits the id on "." and walks `window`). An
 * extension's registered id and its actual window path do not always line up, which
 * leaves the click with no usable provider and no visible error. Resolving the
 * injected objects here avoids that round trip.
 */
function injectedProviders(): StacksProvider[] {
  const scope = window as unknown as {
    XverseProviders?: { BitcoinProvider?: StacksProvider };
    LeatherProvider?: StacksProvider;
  };
  const candidates = [scope.XverseProviders?.BitcoinProvider, scope.LeatherProvider];
  return candidates.filter(
    (candidate): candidate is StacksProvider => typeof candidate?.request === "function",
  );
}

function stacksTestnetAddress(addresses: ReadonlyArray<{ address?: string }>): string {
  const entry = addresses.find((item) => item.address?.startsWith("ST"));
  if (!entry?.address) {
    throw new Error(
      "The wallet did not return a Stacks testnet address. Switch Xverse to Testnet, then try again.",
    );
  }
  return entry.address;
}

/** Connect the injected wallet, falling back to the wallet picker when needed. */
export async function connectWallet(): Promise<string> {
  const { connect, request } = await connectSdk();
  const providers = injectedProviders();

  // A single injected wallet is used directly; several keep the picker so the choice stays.
  const response =
    providers.length === 1
      ? await request({ provider: providers[0], forceWalletSelect: false }, "getAddresses")
      : await connect({ forceWalletSelect: true });

  return stacksTestnetAddress(response.addresses ?? []);
}

export async function disconnectWallet(): Promise<void> {
  const { disconnect } = await connectSdk();
  disconnect();
}

/**
 * Ask the wallet to sign and broadcast a call to the passport contract.
 * Returns the transaction id, which the caller can track on the Stacks API.
 */
export async function submitContractCall(options: {
  contract: string;
  functionName: "register-contract" | "update-contract";
  functionArgs: ClarityValue[];
  address: string;
}): Promise<string> {
  const { request } = await connectSdk();
  const response = await request("stx_callContract", {
    contract: options.contract as `${string}.${string}`,
    functionName: options.functionName,
    functionArgs: options.functionArgs,
    network: NETWORK,
    address: options.address,
  });
  if (response.txid) return response.txid;

  // Some wallets hand back the signed transaction instead of broadcasting it.
  if (response.transaction) {
    const { broadcastTransaction, deserializeTransaction } = await txSdk();
    const result = await broadcastTransaction({
      transaction: deserializeTransaction(response.transaction),
      network: NETWORK,
    });
    if ("txid" in result && typeof result.txid === "string") return result.txid;
    throw new Error(`The mempool rejected the transaction: ${JSON.stringify(result)}`);
  }

  throw new Error("The wallet did not return a transaction id.");
}

export const NETWORK_NAME = "testnet";
export const NETWORK_LABEL = "Stacks testnet";
export const API_BASE = "https://api.testnet.hiro.so";
export const EXPLORER_BASE = "https://explorer.hiro.so";

/**
 * The Contract Passport registry deployed on Stacks testnet. This is the built-in
 * default so the app works on localhost and on Vercel without environment
 * variables. A principal saved in the browser, or supplied through
 * NEXT_PUBLIC_REGISTRY_ADDRESS, still takes precedence.
 */
export const DEPLOYED_REGISTRY_ID = "ST3HKMJ7BYNTGV4DG9A33RVBTVJ1GTCGX9GQ5AKPB.contract-passport";

const REGISTRY_STORAGE_KEY = "contract-passport:registry:v1";
// Next.js inlines NEXT_PUBLIC_* values at build time; the Vite spelling of this
// setting (VITE_REGISTRY_ADDRESS) is not available in this bundler.
const ENV_REGISTRY = String(process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? "").trim();

export interface ContractPrincipal {
  address: string;
  name: string;
  id: string;
}

const ADDRESS_PATTERN = /^S[TP][0-9A-Z]{30,42}$/;
const CONTRACT_NAME_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9_-]*)$/;

/** Parse "<address>.<contract-name>" and reject anything that is not a contract principal. */
export function parseContractPrincipal(value: string): ContractPrincipal | null {
  const trimmed = value.trim();
  const separator = trimmed.indexOf(".");
  if (separator < 0) return null;
  const address = trimmed.slice(0, separator);
  const name = trimmed.slice(separator + 1);
  if (!ADDRESS_PATTERN.test(address)) return null;
  if (!CONTRACT_NAME_PATTERN.test(name) || name.length > 40) return null;
  return { address, name, id: `${address}.${name}` };
}

export function getRegistryId(): string {
  const stored = readStored(REGISTRY_STORAGE_KEY);
  if (stored && parseContractPrincipal(stored)) return stored;
  if (ENV_REGISTRY && parseContractPrincipal(ENV_REGISTRY)) return ENV_REGISTRY;
  return DEPLOYED_REGISTRY_ID;
}

export function setRegistryId(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) {
    writeStored(REGISTRY_STORAGE_KEY, null);
    return;
  }
  writeStored(REGISTRY_STORAGE_KEY, trimmed);
}

export function registrySource(): "env" | "local" | "default" {
  const stored = readStored(REGISTRY_STORAGE_KEY);
  if (stored && parseContractPrincipal(stored)) return "local";
  if (ENV_REGISTRY && parseContractPrincipal(ENV_REGISTRY)) return "env";
  return "default";
}

// Storage can throw or be unavailable (private windows, blocked third-party
// cookies, embedded views). The registry address is a convenience, not a
// requirement, so failures fall back to "no value" instead of breaking the app.
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Ignored on purpose: the UI stays usable without persistence.
  }
}

export function explorerTxUrl(txid: string): string {
  return `${EXPLORER_BASE}/txid/${txid}?chain=testnet`;
}

export function explorerPrincipalUrl(principal: string): string {
  return `${EXPLORER_BASE}/address/${principal}?chain=testnet`;
}

export function truncateId(value: string, lead = 7, tail = 6): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}

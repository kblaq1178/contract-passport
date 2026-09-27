export type Capability = "swap" | "lend" | "borrow" | "stake" | "escrow";

export interface CapabilitySpec {
  name: Capability;
  label: string;
  bit: number;
  blurb: string;
}

/** Mirrors the CAPABILITY-* constants in contracts/contract-passport.clar. */
export const CAPABILITY_SPECS: CapabilitySpec[] = [
  { name: "swap", label: "SWAP", bit: 1, blurb: "Registrant declares token exchange" },
  { name: "lend", label: "LEND", bit: 2, blurb: "Registrant declares lending or supply" },
  { name: "borrow", label: "BORROW", bit: 4, blurb: "Registrant declares borrowing" },
  { name: "stake", label: "STAKE", bit: 8, blurb: "Registrant declares staking" },
  { name: "escrow", label: "ESCROW", bit: 16, blurb: "Registrant declares escrow" },
];

export function capabilitySpec(name: Capability): CapabilitySpec {
  const spec = CAPABILITY_SPECS.find((entry) => entry.name === name);
  if (!spec) throw new Error(`Unknown capability: ${name}`);
  return spec;
}

export function decodeCapabilities(mask: number | bigint): Capability[] {
  const value = Number(mask);
  return CAPABILITY_SPECS.filter((spec) => (value & spec.bit) === spec.bit).map((spec) => spec.name);
}

export function encodeCapabilities(capabilities: Iterable<Capability>): number {
  let mask = 0;
  for (const name of capabilities) mask |= capabilitySpec(name).bit;
  return mask;
}

export type Status = "active" | "paused" | "deprecated" | "migrated";

export const STATUSES: Status[] = ["active", "paused", "deprecated", "migrated"];

export interface StatusSpec {
  label: string;
  tone: "ok" | "warn" | "bad" | "info";
  blurb: string;
}

export const STATUS_SPECS: Record<Status, StatusSpec> = {
  active: { label: "Active", tone: "ok", blurb: "Registrant reports this contract as live." },
  paused: { label: "Paused", tone: "warn", blurb: "Registrant reports this contract as paused." },
  deprecated: {
    label: "Deprecated",
    tone: "bad",
    blurb: "Registrant reports this contract as deprecated. Prefer an alternative.",
  },
  migrated: {
    label: "Migrated",
    tone: "info",
    blurb: "Registrant reports this contract as migrated to a new contract principal.",
  },
};

export function isStatus(value: string): value is Status {
  return (STATUSES as string[]).includes(value);
}

export interface Passport {
  contractPrincipal: string;
  name: string;
  version: string;
  status: Status;
  owner: string;
  capabilities: Capability[];
  selfAttested: boolean;
  registeredAt: number;
  updatedAt: number;
  updateCount: number;
  /** "chain" entries come from the registry contract, "demo" entries never touch the chain. */
  source: "chain" | "demo";
}

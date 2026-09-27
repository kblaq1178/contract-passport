import type { Passport } from "./types";

/**
 * Sample passports used only for the "demo data" preview on the main screen.
 * These entries never come from the chain and are labelled DEMO everywhere in
 * the UI. They exist so the layout can be reviewed before a testnet deploy.
 */
export const DEMO_PASSPORTS: Passport[] = [
  {
    contractPrincipal: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG.demo-swap-v2",
    name: "Demo Swap V2",
    version: "2.4.0",
    status: "active",
    owner: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
    capabilities: ["swap"],
    selfAttested: true,
    registeredAt: 0,
    updatedAt: 0,
    updateCount: 3,
    source: "demo",
  },
  {
    contractPrincipal: "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC.demo-lend-pool",
    name: "Demo Lend Pool",
    version: "1.2.1",
    status: "paused",
    owner: "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC",
    capabilities: ["lend", "borrow"],
    selfAttested: true,
    registeredAt: 0,
    updatedAt: 0,
    updateCount: 1,
    source: "demo",
  },
  {
    contractPrincipal: "ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0.demo-vault-escrow",
    name: "Demo Vault Escrow",
    version: "0.9.0",
    status: "deprecated",
    owner: "ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0",
    capabilities: ["escrow", "stake"],
    selfAttested: true,
    registeredAt: 0,
    updatedAt: 0,
    updateCount: 0,
    source: "demo",
  },
];

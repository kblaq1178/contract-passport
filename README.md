# Contract Passport

> Know what a Stacks contract is and what it can do before you interact with it.

Contract Passport is a small, self-attested on-chain registry for Stacks smart contracts. A
registrant publishes plain metadata about a contract (name, version, status, owner, declared
capabilities) and anyone can read it back before interacting with that contract.

**This registry is self-attested.** It does not audit, analyze, verify, score or endorse any
contract, and it never inspects contract code. Clarity cannot prove who deployed another contract,
so the "owner" stored in a passport is the address that registered it, not proof of deployment.

## Repository layout

| Path | Purpose |
| --- | --- |
| `contracts/contract-passport.clar` | The registry contract (Clarity). |
| `tests/contract-passport.test.ts` | Clarinet simnet unit tests. |
| `web/` | The web UI (Vite + TypeScript, no framework). |
| `Clarinet.toml`, `settings/`, `deployments/` | Clarinet project configuration and plans. |

## Contract

Contract name: `contract-passport`.

### Public functions

- `register-contract (target principal) (name (string-ascii 64)) (version (string-ascii 16)) (status (string-ascii 12)) (capabilities uint)`
  Registers a passport keyed by the target contract principal (`ADDRESS.contract-name`). The caller
  becomes the passport owner. Fails with `ERR-ALREADY-REGISTERED` if a passport already exists.
- `update-contract (...same arguments...)`
  Replaces the metadata of an existing passport. Only the registered owner may call it
  (`ERR-NOT-AUTHORIZED` otherwise).

### Read-only functions

- `get-passport (target principal)` -> `(optional {...})`, the full passport or `none`.
- `get-capabilities (target principal)` -> `(ok (list "swap" ...))`, capability names instead of bits.
- `get-passport-count` -> `uint`, number of passports registered.
- `is-registered (target principal)` -> `bool`.

### Passport fields

| Field | Type | Notes |
| --- | --- | --- |
| `contract-principal` | `principal` | Key of the passport, set at registration. |
| `name` | `(string-ascii 64)` | Human readable name, not empty. |
| `version` | `(string-ascii 16)` | Free-form version string, not empty. |
| `status` | `(string-ascii 12)` | One of `active`, `paused`, `deprecated`, `migrated`. |
| `owner` | `principal` | Address that registered the passport; the only address allowed to update it. |
| `capabilities` | `uint` | Bitmask of declared capabilities (see below). |
| `self-attested` | `bool` | Always `true`; the registry stores claims, never verified facts. |
| `registered-at` | `uint` | Stacks block height of registration. |
| `updated-at` | `uint` | Stacks block height of the last update. |
| `update-count` | `uint` | Number of updates since registration. |

### Capability bits

| Capability | Bit |
| --- | --- |
| `swap` | 1 |
| `lend` | 2 |
| `borrow` | 4 |
| `stake` | 8 |
| `escrow` | 16 |

At least one capability is required, and unknown bits are rejected (`ERR-INVALID-CAPABILITIES`).

### Error codes

| Code | Constant | Meaning |
| --- | --- | --- |
| `u100` | `ERR-NOT-AUTHORIZED` | Caller is not the passport owner. |
| `u101` | `ERR-ALREADY-REGISTERED` | A passport already exists for that principal. |
| `u102` | `ERR-NOT-REGISTERED` | No passport exists for that principal. |
| `u103` | `ERR-INVALID-STATUS` | Status is not in the status model. |
| `u104` | `ERR-INVALID-CAPABILITIES` | Empty bitmask or unknown capability bits. |
| `u105` | `ERR-INVALID-NAME` | Empty name. |
| `u106` | `ERR-INVALID-VERSION` | Empty version. |

### Rules and limits

- Registration is open: any principal can register a passport for any contract principal. The first
  registration wins; afterwards only that registrant can update the entry.
- Ownership is not provenance. There is no on-chain way to prove which address deployed a contract,
  so treat `owner` as "whoever published this claim".
- Metadata is never verified on-chain.

## Tests

```bash
npm install --legacy-peer-deps
npm test
clarinet check
```

`npm install` needs `--legacy-peer-deps` on npm 10 because the npm peer resolver crashes with
`Cannot read properties of null (reading 'edgesOut')` while resolving this project's
`vitest` / `vitest-environment-clarinet` peer graph.

The suite covers registration, duplicate registration, owner-only updates, unknown passports,
status/capability/name/version validation, capability decoding, per-principal isolation and the
registration counter.

## Deploy to Stacks testnet

Verified against Clarinet 3.23.2. Nothing here deploys on its own.

### 1. Local credential

`settings/Testnet.toml` is gitignored. Fill in `[accounts.deployer]` with the Secret Recovery
Phrase of the testnet-funded account, either as the plain `mnemonic` field or, preferably, as
`encrypted_mnemonic` after running `clarinet deployments encrypt` (Clarinet then prompts for the
password when it signs).

Only `mnemonic` and `encrypted_mnemonic` are read. Unknown keys, including `private_key` and
`derivation_path`, are silently ignored; with no valid credential Clarinet generates a plan with a
random, unfunded deployer address. Always check the plan's `expected-sender` before applying.

### 2. Generate the plan and verify the deployer

```bash
clarinet deployments generate --testnet --low-cost
```

Open `deployments/default.testnet-plan.yaml` and confirm `expected-sender` is the funded `ST...`
address (the address the wallet shows while it is switched to Testnet). For a network-free check
first, `clarinet deployments generate --testnet --manual-cost` writes a plan without a fee — read
it, then regenerate with `--low-cost` before applying, because a manual-cost plan should not be
broadcast as is.

If `expected-sender` is not the funded account, stop. Clarinet 3.23.2 always derives with the
standard Stacks path (verified: the Clarinet devnet fixture phrase derives to the address documented
in `settings/Devnet.toml`), and no supported setting changes it, so the funded address must be the
account that this phrase derives to.

### 3. Apply

```bash
clarinet deployments apply --testnet --no-dashboard
```

The low-cost fee for this single-transaction deployment was `121301` uSTX (~0.12 STX) when it was
verified. `--no-dashboard` streams plain logs instead of the terminal UI.

The contract id is `<deployer-address>.contract-passport`; use it in the web UI's "Registry
contract" field or as `VITE_REGISTRY_ADDRESS` for `web/`.

## Web UI

```bash
cd web
npm install --legacy-peer-deps
npm run dev     # http://localhost:5173
npm run build   # type-check + production build into web/dist
```

The UI is vanilla TypeScript with a hand-written stylesheet. `@stacks/transactions` and
`@stacks/connect` are loaded lazily, so the first paint is a few kilobytes.

### Registry address

The UI reads and writes one registry contract. Configure it either way:

- build-time: `VITE_REGISTRY_ADDRESS=ST....contract-passport` (see `web/.env.example`), or
- runtime: paste the address into the "Registry contract" field; it is stored in `localStorage`.

The UI checks the address against the Stacks API and shows whether the contract is actually deployed
on testnet before you rely on it.

### What the UI does

- **Main screen**: header, subtitle, contract-principal search, capability filter chips
  (`SWAP`, `LEND`, `BORROW`, `STAKE`, `ESCROW`) and passport cards.
- **Passport detail**: contract principal, name, version, status, owner, declared capabilities, a
  `SELF-ATTESTED` badge and registration/update block information, plus an explorer link.
- **Registration flow**: connect a Stacks wallet (Leather/Xverse through Stacks Connect), fill in the
  metadata, submit a real contract call, watch the pending state, then see the refreshed passport.
  The form switches between `register-contract` and `update-contract` depending on whether a passport
  already exists, and the contract enforces ownership either way.

### Testnet data vs demo data

- Real results are read from `https://api.testnet.hiro.so` (`get-passport`) and written through the
  connected wallet on testnet; transactions link to `https://explorer.hiro.so`.
- The optional "demo layout" block on the main screen is local sample data. It is labelled
  `DEMO DATA · NOT ON-CHAIN` and is never mixed with chain results.

There is no indexer: lookups are per contract principal, and the registry contract only exposes
point reads plus a total counter.

## Deliberately out of scope

No AI, no DAO governance, no reputation system, no cross-chain features, no indexer, no contract
analysis or scraping of contract source. Anything a passport says is a claim made by its registrant.

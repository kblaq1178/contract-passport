import "./passport.css";
import { fetchPassport, fetchPassportCount, passportArgs, registryExists, waitForTx } from "./api";
import {
  NETWORK_LABEL,
  explorerTxUrl,
  getRegistryId,
  parseContractPrincipal,
  registrySource,
  setRegistryId,
} from "./config";
import { DEMO_PASSPORTS } from "./demo";
import { esc, qs, truncateId } from "./dom";
import { mountLanding } from "./landing";
import {
  CAPABILITY_SPECS,
  STATUSES,
  STATUS_SPECS,
  type Capability,
  type Passport,
  type Status,
} from "./types";
import { capabilityChipList, demoGrid, passportCard } from "./views";
import { connectWallet, connectedAddress, disconnectWallet, submitContractCall } from "./wallet";

type FlowState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "pending"; txid: string | null; detail: string }
  | { kind: "success"; txid: string; blockHeight: number | null; action: "registered" | "updated" };

interface State {
  registry: string;
  registryState: "unknown" | "ok" | "missing";
  count: number | null;
  address: string | null;
  filters: Set<Capability>;
  loading: boolean;
  searched: string | null;
  passport: Passport | null;
  error: string;
  demo: boolean;
  flow: FlowState;
  formNote: string;
  submitLabel: string;
}

const state: State = {
  registry: getRegistryId(),
  registryState: "unknown",
  count: null,
  address: null,
  filters: new Set<Capability>(),
  loading: false,
  searched: null,
  passport: null,
  error: "",
  demo: false,
  flow: { kind: "idle" },
  formNote: "",
  submitLabel: "Sign & register passport",
};

function shellMarkup(): string {
  const registrySourceKind = registrySource();
  const registryHint =
    registrySourceKind === "env"
      ? "Loaded from NEXT_PUBLIC_REGISTRY_ADDRESS."
      : registrySourceKind === "local"
        ? "Loaded from this browser."
        : "Using the built-in testnet deployment.";

  return `
    <header class="site-header">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30" role="img">
            <rect width="32" height="32" rx="8" fill="#5546ff"></rect>
            <path d="M11 23V9h10M11 16h8" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round"></path>
          </svg>
        </span>
        <div class="brand-text">
          <h1 class="brand-title">CONTRACT PASSPORT</h1>
          <p class="brand-sub">Know what a Stacks contract is before you interact with it.</p>
        </div>
      </div>
      <div class="header-actions">
        <span class="net-badge" title="Reads and writes target the Stacks testnet">${esc(NETWORK_LABEL.toUpperCase())}</span>
        <button id="wallet-button" class="btn btn-ghost" type="button">Connect Stacks wallet</button>
      </div>
    </header>

    <section class="panel registry-panel">
      <div class="registry-row">
        <label class="meta-label" for="registry-input">Registry contract</label>
        <input
          id="registry-input"
          class="input mono"
          spellcheck="false"
          autocomplete="off"
          placeholder="ST3HKMJ7BYNTGV4DG9A33RVBTVJ1GTCGX9GQ5AKPB.contract-passport"
          value="${esc(state.registry)}"
        />
        <button id="registry-save" class="btn btn-quiet" type="button">Save</button>
      </div>
      <p id="registry-status" class="hint"></p>
      <p class="hint hint-dim">${esc(registryHint)} Deploy contracts/contract-passport.clar to testnet, then paste its address here.</p>
    </section>

    <section class="panel register-panel">
      <header class="panel-head">
        <h2 class="panel-title">Register or update a passport</h2>
        <p class="panel-sub">
          Metadata is written by a real contract transaction. Only the wallet that registered a
          passport can update it afterwards.
        </p>
      </header>
      <form id="register-form" class="form" novalidate>
        <div class="field">
          <label class="meta-label" for="f-target">Contract principal</label>
          <input id="f-target" class="input mono" spellcheck="false" autocomplete="off" placeholder="ST3HKMJ7BYNTGV4DG9A33RVBTVJ1GTCGX9GQ5AKPB.contract-passport" />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="meta-label" for="f-name">Name</label>
            <input id="f-name" class="input" maxlength="64" placeholder="My Stacks contract" />
          </div>
          <div class="field field-small">
            <label class="meta-label" for="f-version">Version</label>
            <input id="f-version" class="input" maxlength="16" value="1.0.0" />
          </div>
          <div class="field field-small">
            <label class="meta-label" for="f-status">Status</label>
            <select id="f-status" class="input">
              ${STATUSES.map((status) => `<option value="${esc(status)}">${esc(STATUS_SPECS[status].label)}</option>`).join("")}
            </select>
          </div>
        </div>
        <fieldset class="field">
          <legend class="meta-label">Declared capabilities</legend>
          <div id="form-caps" class="chips">
            ${CAPABILITY_SPECS.map(
              (spec) =>
                `<label class="chip chip-toggle" title="${esc(spec.blurb)}"><input type="checkbox" value="${esc(spec.name)}" /><span>${esc(spec.label)}</span></label>`,
            ).join("")}
          </div>
        </fieldset>
        <div class="form-actions">
          <button id="submit-button" class="btn btn-primary" type="submit">${esc(state.submitLabel)}</button>
          <span id="form-note" class="hint"></span>
        </div>
      </form>
      <div id="flow" class="flow"></div>
    </section>

    <section class="panel search-panel">
      <div class="search-row">
        <input
          id="search-input"
          class="input search-input mono"
          spellcheck="false"
          autocomplete="off"
          placeholder="Search contract principal: ST3HKMJ7BYNTGV4DG9A33RVBTVJ1GTCGX9GQ5AKPB.contract-passport"
        />
        <button id="search-button" class="btn btn-primary" type="button">Look up passport</button>
      </div>
      <div class="filter-row">
        <span class="meta-label">Filter by declared capability</span>
        <div id="filters" class="chips">${capabilityChipList()}</div>
      </div>
      <p class="hint">
        Chips filter the passport you look up. Everything in this registry is self-attested by the
        registrant: capability chips are claims, not a security review.
      </p>
    </section>

    <section id="results" class="results"></section>

    <footer class="site-footer">
      <p>
        Contract Passport is a self-attested metadata registry. It does not audit, verify, score or
        endorse any contract, it does not read contract code, and it is not an indexer: look up a
        specific contract principal. Reads and writes use the Stacks testnet.
      </p>
    </footer>
  `;
}

function inputValue(selector: string): string {
  return qs<HTMLInputElement | HTMLSelectElement>(selector).value;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function setFlow(flow: FlowState): void {
  state.flow = flow;
  renderFlow();
}

function setFlowError(message: string): void {
  setFlow({ kind: "error", message });
}

function renderFlow(): void {
  const node = qs<HTMLDivElement>("#flow");
  const flow = state.flow;
  if (flow.kind === "idle") {
    node.innerHTML = "";
    return;
  }
  if (flow.kind === "error") {
    node.innerHTML = `<div class="flow-card flow-error"><strong>Not submitted.</strong> ${esc(flow.message)}</div>`;
    return;
  }
  if (flow.kind === "pending") {
    const tx = flow.txid
      ? `<a href="${esc(explorerTxUrl(flow.txid))}" target="_blank" rel="noreferrer">${esc(truncateId(flow.txid, 12, 8))}</a>`
      : "awaiting wallet signature";
    node.innerHTML = `
      <div class="flow-card flow-pending">
        <span class="dot" aria-hidden="true"></span>
        <div>
          <strong>Transaction pending</strong>
          <p>${esc(flow.detail)} · ${tx}</p>
        </div>
      </div>`;
    return;
  }
  const block = flow.blockHeight === null ? "" : ` in block ${flow.blockHeight}`;
  node.innerHTML = `
    <div class="flow-card flow-success">
      <strong>Passport ${esc(flow.action)}${esc(block)}.</strong>
      <p><a href="${esc(explorerTxUrl(flow.txid))}" target="_blank" rel="noreferrer">View transaction ↗</a> · confirmed on ${esc(NETWORK_LABEL)}</p>
    </div>`;
}

function renderWallet(): void {
  const button = qs<HTMLButtonElement>("#wallet-button");
  if (state.address) {
    button.textContent = `${truncateId(state.address, 8, 6)} · disconnect`;
    button.classList.add("btn-connected");
  } else {
    button.textContent = "Connect Stacks wallet";
    button.classList.remove("btn-connected");
  }
}

function renderRegistryStatus(): void {
  const node = qs<HTMLParagraphElement>("#registry-status");
  if (!state.registry) {
    node.textContent = "Reads are disabled until a registry contract is set.";
    node.className = "hint hint-warn";
    return;
  }
  if (state.registryState === "missing") {
    node.textContent = `No contract found at ${state.registry} on ${NETWORK_LABEL}. Check the address or deploy the contract.`;
    node.className = "hint hint-warn";
    return;
  }
  if (state.registryState === "ok") {
    const count = state.count === null ? "counting..." : `${state.count} passport(s) registered`;
    node.textContent = `Registry reachable · ${count}`;
    node.className = "hint hint-ok";
    return;
  }
  node.textContent = "Checking the registry contract...";
  node.className = "hint";
}

function renderResults(): void {
  const node = qs<HTMLDivElement>("#results");
  if (state.loading) {
    node.innerHTML = `<div class="panel state-panel"><span class="dot" aria-hidden="true"></span> Reading the registry contract...</div>`;
    return;
  }
  if (state.error) {
    node.innerHTML = `<div class="panel state-panel state-error"><strong>Lookup failed.</strong> ${esc(state.error)}</div>`;
    return;
  }
  if (state.searched) {
    if (state.passport) {
      node.innerHTML = `
        <div class="result-head">
          <span class="meta-label">Passport for</span>
          <span class="mono">${esc(state.passport.contractPrincipal)}</span>
        </div>
        ${passportCard(state.passport, state.filters)}`;
      return;
    }
    node.innerHTML = `
      <div class="panel state-panel">
        <strong>No passport registered for</strong>
        <span class="mono">${esc(state.searched)}</span>
        <p class="hint">Registration is a wallet-signed contract call. Use the form below to register it.</p>
      </div>`;
    return;
  }
  node.innerHTML = `
    <div class="panel state-panel">
      <strong>Look up a contract principal</strong>
      <p class="hint">
        Paste an address such as ST3HKMJ7BYNTGV4DG9A33RVBTVJ1GTCGX9GQ5AKPB.contract-passport to read its passport from the registry.
        There is no indexer, so browsing happens one contract at a time.
      </p>
      <button id="demo-toggle" class="btn btn-quiet" type="button" aria-pressed="${state.demo}">
        ${state.demo ? "Hide demo layout" : "Show demo layout"}
      </button>
    </div>
    ${state.demo ? demoGrid(state.filters, DEMO_PASSPORTS) : ""}`;
  const toggle = document.querySelector<HTMLButtonElement>("#demo-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      state.demo = !state.demo;
      renderResults();
    });
  }
}

function renderFilters(): void {
  for (const chip of document.querySelectorAll<HTMLSpanElement>("#filters .chip")) {
    const name = chip.dataset.capability as Capability | undefined;
    if (!name) continue;
    chip.classList.toggle("chip-active", state.filters.has(name));
  }
}

function renderFormNote(): void {
  qs<HTMLSpanElement>("#form-note").textContent = state.formNote;
  qs<HTMLButtonElement>("#submit-button").textContent = state.submitLabel;
}

async function refreshRegistry(): Promise<void> {
  if (!state.registry) {
    state.registryState = "unknown";
    state.count = null;
    renderRegistryStatus();
    return;
  }
  state.registryState = "unknown";
  state.count = null;
  renderRegistryStatus();
  const exists = await registryExists(state.registry);
  state.registryState = exists ? "ok" : "missing";
  renderRegistryStatus();
  if (!exists) return;
  const parsed = parseContractPrincipal(state.registry);
  const sender = state.address ?? parsed?.address;
  if (!sender) return;
  try {
    state.count = await fetchPassportCount(state.registry, sender);
  } catch {
    state.count = null;
  }
  renderRegistryStatus();
}

async function runSearch(targetId?: string): Promise<void> {
  const target = (targetId ?? inputValue("#search-input")).trim();
  state.searched = target;
  state.passport = null;
  state.error = "";
  if (!state.registry) {
    state.error = "Set the registry contract address first.";
    renderResults();
    return;
  }
  if (!parseContractPrincipal(target)) {
    state.error = "Enter a contract principal like ST3HKMJ7BYNTGV4DG9A33RVBTVJ1GTCGX9GQ5AKPB.contract-passport.";
    renderResults();
    return;
  }
  state.loading = true;
  renderResults();
  try {
    state.passport = await fetchPassport(state.registry, target, state.address ?? undefined);
  } catch (error) {
    state.error = errorMessage(error);
  }
  state.loading = false;
  renderResults();
}

function selectedCapabilities(): Set<Capability> {
  const selected = new Set<Capability>();
  for (const input of document.querySelectorAll<HTMLInputElement>("#form-caps input:checked")) {
    selected.add(input.value as Capability);
  }
  return selected;
}

async function checkExistingPassport(): Promise<void> {
  const target = inputValue("#f-target").trim();
  const parsed = parseContractPrincipal(target);
  if (!parsed || !state.registry) {
    state.formNote = "";
    state.submitLabel = "Sign & register passport";
    renderFormNote();
    return;
  }
  try {
    const existing = await fetchPassport(state.registry, parsed.id, state.address ?? undefined);
    if (existing) {
      state.formNote = `A passport already exists for this contract (owner ${truncateId(existing.owner, 8, 6)}). Only that address can update it.`;
      state.submitLabel = "Sign & update passport";
    } else {
      state.formNote = "No passport yet: this call registers a new one.";
      state.submitLabel = "Sign & register passport";
    }
  } catch (error) {
    state.formNote = errorMessage(error);
  }
  renderFormNote();
}

async function onSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const registry = parseContractPrincipal(state.registry);
  const target = parseContractPrincipal(inputValue("#f-target"));
  const name = inputValue("#f-name").trim();
  const version = inputValue("#f-version").trim();
  const status = inputValue("#f-status") as Status;
  const capabilities = selectedCapabilities();

  if (!registry) return setFlowError("Set and save the registry contract address first.");
  if (!state.address) return setFlowError("Connect a Stacks wallet to sign this transaction.");
  if (!target) {
    return setFlowError("The contract principal must look like ST3HKMJ7BYNTGV4DG9A33RVBTVJ1GTCGX9GQ5AKPB.contract-passport.");
  }
  if (!name) return setFlowError("Give the passport a name.");
  if (!version) return setFlowError("Give the passport a version, for example 1.0.0.");
  if (capabilities.size === 0) return setFlowError("Select at least one declared capability.");
  if (!STATUSES.includes(status)) return setFlowError("Pick one of the four statuses.");

  setFlow({ kind: "pending", txid: null, detail: "Waiting for the wallet to sign..." });
  try {
    const existing = await fetchPassport(registry.id, target.id, state.address);
    const functionName = existing ? "update-contract" : "register-contract";
    const txid = await submitContractCall({
      contract: registry.id,
      functionName,
      address: state.address,
      functionArgs: await passportArgs(target, {
        name,
        version,
        status,
        capabilities: [...capabilities],
      }),
    });
    setFlow({ kind: "pending", txid, detail: "Broadcast. Waiting for a block..." });
    const final = await waitForTx(txid, (update) => {
      setFlow({ kind: "pending", txid, detail: update.detail });
    });
    if (final.state === "success") {
      setFlow({
        kind: "success",
        txid,
        blockHeight: final.blockHeight,
        action: existing ? "updated" : "registered",
      });
      qs<HTMLInputElement>("#search-input").value = target.id;
      void refreshRegistry();
      await runSearch(target.id);
    } else {
      setFlowError(`${final.detail} Transaction: ${txid}`);
    }
  } catch (error) {
    setFlowError(errorMessage(error));
  }
}

function bindEvents(): void {
  qs<HTMLButtonElement>("#wallet-button").addEventListener("click", async () => {
    if (state.address) {
      void disconnectWallet();
      state.address = null;
      renderWallet();
      return;
    }
    try {
      state.address = await connectWallet();
      renderWallet();
      void refreshRegistry();
    } catch (error) {
      setFlowError(errorMessage(error));
    }
  });

  qs<HTMLButtonElement>("#search-button").addEventListener("click", () => void runSearch());
  qs<HTMLInputElement>("#search-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") void runSearch();
  });

  qs<HTMLDivElement>("#filters").addEventListener("click", (event) => {
    const chip = (event.target as HTMLElement).closest<HTMLSpanElement>("[data-capability]");
    const name = chip?.dataset.capability as Capability | undefined;
    if (!name) return;
    if (state.filters.has(name)) state.filters.delete(name);
    else state.filters.add(name);
    renderFilters();
    renderResults();
  });

  qs<HTMLButtonElement>("#registry-save").addEventListener("click", () => {
    const value = inputValue("#registry-input").trim();
    if (value && !parseContractPrincipal(value)) {
      setFlowError("Registry address must be a contract principal, for example ST3HKMJ7BYNTGV4DG9A33RVBTVJ1GTCGX9GQ5AKPB.contract-passport.");
      return;
    }
    setRegistryId(value);
    state.registry = getRegistryId();
    state.passport = null;
    state.searched = null;
    state.error = "";
    renderResults();
    void refreshRegistry();
  });

  qs<HTMLDivElement>("#form-caps").addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    const label = input.closest<HTMLLabelElement>(".chip-toggle");
    label?.classList.toggle("chip-active", input.checked);
  });

  qs<HTMLInputElement>("#f-target").addEventListener("blur", () => void checkExistingPassport());
  qs<HTMLFormElement>("#register-form").addEventListener("submit", (event) => void onSubmit(event));
}

function mount(): void {
  try {
    const app = qs<HTMLDivElement>("#app");
    app.innerHTML = shellMarkup();
    bindEvents();
    renderWallet();
    renderRegistryStatus();
    renderResults();
    renderFilters();
    renderFormNote();
    renderFlow();
  } catch (error) {
    // Rendering must never leave the visitor with an empty page.
    console.error("Contract Passport failed to mount", error);
    qs<HTMLDivElement>("#app").innerHTML = `
      <header class="site-header">
        <div class="brand">
          <div class="brand-text">
            <h1 class="brand-title">CONTRACT PASSPORT</h1>
            <p class="brand-sub">Know what a Stacks contract is before you interact with it.</p>
          </div>
        </div>
      </header>
      <section class="panel state-panel state-error">
        <strong>The interface failed to start.</strong>
        <p class="hint">${esc(errorMessage(error))}</p>
      </section>`;
  }
}

// Wallet and network work happens after the static interface is on screen, so a
// blocked wallet extension, an unreachable API or a missing registry address can
// never prevent the first render.
async function init(): Promise<void> {
  try {
    state.address = await connectedAddress();
  } catch {
    // A missing or blocked wallet extension must not stop the registry from loading.
    state.address = null;
  }
  if (state.address) renderWallet();
  try {
    await refreshRegistry();
  } catch (error) {
    console.warn("Contract Passport could not refresh the registry", error);
  }
}

export type PassportMode = "landing" | "dashboard";

/**
 * Mount the Contract Passport UI into the `#app` shell.
 *
 * `"dashboard"` renders the registry console and `"landing"` renders the marketing
 * page. The standalone web app used to derive this from window.location.pathname;
 * the Next.js routes now pass the mode in explicitly.
 */
export function mountPassportApp(mode: PassportMode): void {
  if (mode === "dashboard") {
    // 1. Render the dashboard immediately.
    mount();
    // 2. Then load the wallet session and reach the network.
    void init();
    return;
  }
  mountLanding();
}

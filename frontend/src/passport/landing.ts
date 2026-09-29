/**
 * Landing page for Contract Passport.
 *
 * Static markup only: this route renders no wallet, API or network code, and every
 * call to action links into the dashboard at /dashboard.
 */
const DASHBOARD_PATH = "/dashboard";

interface Step {
  number: string;
  title: string;
  body: string;
}

interface Feature {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    number: "01",
    title: "REGISTER",
    body: "Register a contract with its identity and metadata.",
  },
  {
    number: "02",
    title: "DECLARE",
    body: "Declare capabilities such as SWAP, LEND, BORROW, STAKE, or ESCROW.",
  },
  {
    number: "03",
    title: "DISCOVER",
    body: "Search the registry and inspect a contract passport before interacting.",
  },
];

const FEATURES: Feature[] = [
  {
    title: "Onchain registry",
    body: "Passports live in a Clarity contract on Stacks, not in a private database.",
  },
  {
    title: "Stacks Testnet",
    body: "Every read and write in the dashboard targets Stacks testnet.",
  },
  {
    title: "Xverse wallet",
    body: "Connect Xverse on testnet to register and update your own passports.",
  },
  {
    title: "Real contract interaction",
    body: "Registering signs a real contract call, then reads the passport back from chain.",
  },
];

function brandMark(): string {
  return `
    <span class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="30" height="30" role="img">
        <rect width="32" height="32" rx="8" fill="#5546ff"></rect>
        <path d="M11 23V9h10M11 16h8" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round"></path>
      </svg>
    </span>`;
}

export function landingMarkup(): string {
  return `
    <header class="site-header">
      <div class="brand">
        ${brandMark()}
        <div class="brand-text">
          <p class="brand-title">CONTRACT PASSPORT</p>
          <p class="brand-sub">Self-attested metadata registry for Stacks contracts.</p>
        </div>
      </div>
      <div class="header-actions">
        <span class="net-badge">STACKS TESTNET</span>
        <a class="btn btn-ghost" href="${DASHBOARD_PATH}">Open Dashboard</a>
      </div>
    </header>

    <section class="landing-hero">
      <p class="landing-kicker">CONTRACT PASSPORT</p>
      <h1 class="landing-headline">Know what a Stacks contract can do before you interact with it.</h1>
      <p class="landing-lede">
        A self-attested onchain identity and capability registry for Stacks contracts.
      </p>
      <div class="landing-actions">
        <a class="btn btn-primary btn-lg" href="${DASHBOARD_PATH}">Open Dashboard</a>
        <span class="landing-note">Built on Stacks Testnet</span>
      </div>
    </section>

    <section class="panel landing-panel">
      <h2 class="landing-label">WHY CONTRACT PASSPORT?</h2>
      <p class="landing-body">
        Contracts shouldn't be black boxes. Contract Passport lets users see a contract's identity,
        version, status, and declared capabilities before interacting with it.
      </p>
    </section>

    <section class="landing-section">
      <h2 class="landing-label">HOW IT WORKS</h2>
      <div class="landing-grid">
        ${STEPS.map(
          (step) => `
        <article class="panel landing-card landing-step">
          <span class="landing-step-num">${step.number}</span>
          <h3 class="landing-step-title">${step.title}</h3>
          <p class="landing-card-body">${step.body}</p>
        </article>`,
        ).join("")}
      </div>
    </section>

    <section class="landing-section">
      <h2 class="landing-label">BUILT FOR STACKS</h2>
      <div class="landing-grid">
        ${FEATURES.map(
          (feature) => `
        <article class="panel landing-card">
          <h3 class="landing-card-title">${feature.title}</h3>
          <p class="landing-card-body">${feature.body}</p>
        </article>`,
        ).join("")}
      </div>
    </section>

    <section class="panel landing-panel landing-attest">
      <h2 class="landing-label">SELF-ATTESTED</h2>
      <p class="landing-body">
        Contract Passport records information provided by the registrant. It is not a security audit
        or automatic analysis.
      </p>
    </section>

    <section class="panel landing-final">
      <h2 class="landing-final-title">Explore Contract Passport</h2>
      <a class="btn btn-primary btn-lg" href="${DASHBOARD_PATH}">Open Dashboard</a>
    </section>

    <footer class="site-footer">
      <p>
        Contract Passport is a self-attested metadata registry. It does not audit, verify, score or
        endorse any contract, and it does not read contract code.
      </p>
    </footer>`;
}

/** Replace the neutral first-paint shell with the landing page. */
export function mountLanding(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;
  app.innerHTML = landingMarkup();
}

import { explorerPrincipalUrl, truncateId } from "./config";
import { esc } from "./dom";
import { CAPABILITY_SPECS, STATUS_SPECS, capabilitySpec, type Capability, type Passport, type Status } from "./types";

export function statusBadge(status: Status): string {
  const spec = STATUS_SPECS[status];
  return `<span class="badge badge-status badge-${spec.tone}">${esc(spec.label)}</span>`;
}

export function capabilityChip(name: Capability, active = true): string {
  const spec = capabilitySpec(name);
  return `<span class="chip chip-cap${active ? " chip-active" : ""}">${esc(spec.label)}</span>`;
}

function registrationLine(passport: Passport): string {
  if (passport.source === "demo") return "Demo entry · no on-chain registration";
  const updates = passport.updateCount === 0 ? "no updates yet" : `${passport.updateCount} update(s)`;
  return `Registered in block ${passport.registeredAt} · last updated in block ${passport.updatedAt} · ${updates}`;
}

function filterNotice(passport: Passport, filters: Set<Capability>): string {
  if (filters.size === 0) return "";
  const missing = [...filters].filter((name) => !passport.capabilities.includes(name));
  if (missing.length === 0) {
    return `<p class="notice notice-ok">Declares every capability you filtered on.</p>`;
  }
  const labels = missing.map((name) => esc(capabilitySpec(name).label)).join(", ");
  return `<p class="notice notice-warn">This passport does not declare: ${labels}. Treat that as a warning, not proof.</p>`;
}

export function passportCard(passport: Passport, filters: Set<Capability>): string {
  const isDemo = passport.source === "demo";
  const capabilityMarkup = passport.capabilities.length
    ? passport.capabilities.map((name) => capabilityChip(name)).join("")
    : `<span class="chip chip-empty">Nothing declared</span>`;

  return `
    <article class="passport${isDemo ? " passport-demo" : ""}">
      <div class="passport-top">
        <span class="badge badge-attested" title="The registrant signed this metadata. Nobody verified it.">SELF-ATTESTED</span>
        ${statusBadge(passport.status)}
        ${isDemo ? `<span class="badge badge-demo">DEMO DATA · NOT ON-CHAIN</span>` : ""}
      </div>
      <h3 class="passport-name">${esc(passport.name)}</h3>
      <p class="passport-principal" title="${esc(passport.contractPrincipal)}">${esc(passport.contractPrincipal)}</p>
      <div class="passport-meta">
        <div class="meta-cell">
          <span class="meta-label">Version</span>
          <span class="meta-value">${esc(passport.version)}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">Owner / deployer</span>
          <span class="meta-value mono" title="${esc(passport.owner)}">${esc(truncateId(passport.owner, 10, 6))}</span>
        </div>
        <div class="meta-cell meta-wide">
          <span class="meta-label">Registration</span>
          <span class="meta-value">${esc(registrationLine(passport))}</span>
        </div>
      </div>
      <div class="passport-caps">
        <span class="meta-label">Declared capabilities</span>
        <div class="chips">${capabilityMarkup}</div>
      </div>
      ${filterNotice(passport, filters)}
      <footer class="passport-foot">
        ${
          isDemo
            ? `<span>Sample entry for layout review</span>`
            : `<a href="${esc(explorerPrincipalUrl(passport.contractPrincipal))}" target="_blank" rel="noreferrer">View on explorer ↗</a>`
        }
        <span>${esc(STATUS_SPECS[passport.status].blurb)}</span>
      </footer>
    </article>
  `;
}

export function demoGrid(filters: Set<Capability>, passports: Passport[]): string {
  const visible = filters.size
    ? passports.filter((passport) => [...filters].every((name) => passport.capabilities.includes(name)))
    : passports;
  const cards = visible.length
    ? visible.map((passport) => passportCard(passport, filters)).join("")
    : `<p class="hint">No demo entry declares all of the selected capabilities.</p>`;
  return `
    <div class="demo-block">
      <div class="demo-head">
        <span class="badge badge-demo">DEMO DATA</span>
        <span class="hint">Local sample entries, clearly not on-chain. Real results only come from the registry contract.</span>
      </div>
      <div class="card-grid">${cards}</div>
    </div>
  `;
}

export function capabilityChipList(): string {
  return CAPABILITY_SPECS.map((spec) => `<span class="chip" data-capability="${esc(spec.name)}">${esc(spec.label)}</span>`).join("");
}

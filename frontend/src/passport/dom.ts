/** Escape untrusted strings before they are interpolated into HTML templates. */
export function esc(value: unknown): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value ?? "").replace(/[&<>"']/g, (character) => replacements[character] ?? character);
}

export function qs<T extends Element = Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Expected element ${selector} to exist.`);
  return node;
}

export function truncateId(value: string, lead = 8, tail = 6): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}

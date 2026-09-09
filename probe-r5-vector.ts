// Scratch fuzz probe #1: vector.ts sanitizeSvg hypotheses
import { sanitizeSvg } from "./src/lib/vector.ts";

const fails: string[] = [];
const check = (name: string, cond: boolean, extra = "") => {
  if (!cond) fails.push(`${name} ${extra}`.trim());
};

// H1: case-variant duplicate attrs break canonical output / idempotency
{
  const r = sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect FILL="#ff0000" fill="#00ff00" width="5" height="5"/></svg>`,
  );
  check("H1a ok:false on case-variant dup", !r.ok, JSON.stringify(r).slice(0, 120));
  if (r.ok) {
    const r2 = sanitizeSvg(r.svg);
    check("H1b idempotency after dup-case", r2.ok, JSON.stringify(r2).slice(0, 120));
  }
}
// exact dup already fails
{
  const r = sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect fill="#ff0000" fill="#00ff00" width="5" height="5"/></svg>`,
  );
  check("H1c exact dup fails closed", !r.ok);
}
// viewBox variant-case dup
{
  const r = sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" VIEWBOX="0 0 5 5"><rect width="5" height="5"/></svg>`,
  );
  check("H1d viewBox case dup", !r.ok || sanitizeSvg(r.svg).ok, JSON.stringify(r).slice(0, 140));
}

// H2: random mutation fuzz — no throws, ok results are idempotent
const atoms = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">`,
  `</svg>`,
  `<rect x="1" y="2" width="10" height="20" fill="#ff0000"/>`,
  `<circle cx="5" cy="5" r="4" fill="none" stroke="#0f0"/>`,
  `<g transform="rotate(45 4 4)">`,
  `</g>`,
  `<text x="2" y="3" font-size="12" fill="#123456">hi &amp; bye</text>`,
  `<polygon points="0,0 10,0 5,8" fill="#abc"/>`,
  `<path d="M0 0 L10 10" stroke="#123"/>`,
  `fill="url(#grad)"`,
  `onclick="alert(1)"`,
  `style="x:y"`,
  `&lt;script&gt;`,
  `"`,
  `'`,
  `>`,
  `<`,
  `<!-- -->`,
  `<!DOCTYPE x>`,
  `<?xml?>`,
  `VIEWBOX="0 0 5 5"`,
  `FILL="#00FF00"`,
  `&#65;`,
  `&amp;`,
  `\u0000`,
  `\u0001`,
  `\u007f`,
  `\ud800`, // lone surrogate
  `x="1e999"`,
  `width="-3"`,
  `transform="translate(999999999999 0)"`,
];
let seed = 12345;
const rnd = (m: number) => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed % m;
};
let okCount = 0;
for (let iter = 0; iter < 4000; iter++) {
  const k = 2 + rnd(9);
  let s = "";
  for (let j = 0; j < k; j++) s += atoms[rnd(atoms.length)];
  try {
    const r = sanitizeSvg(s);
    if (r.ok) {
      okCount++;
      const r2 = sanitizeSvg(r.svg);
      if (!r2.ok) {
        fails.push(`idempotency iter=${iter} in=${JSON.stringify(s)} out=${JSON.stringify(r.svg)} -> ${r2.reason}`);
        break;
      }
      if (r2.svg !== r.svg) {
        fails.push(`non-idempotent byte iter=${iter}`);
        break;
      }
    }
  } catch (e) {
    fails.push(`THROW iter=${iter} in=${JSON.stringify(s)} err=${String(e)}`);
    break;
  }
}
check(`H2 fuzz ok results idempotent byte-stable (${okCount} ok)`, fails.length === 0 ? true : false, fails[0] ?? "");
console.log(fails.length ? "FAILS:\n" + fails.join("\n") : "ALL PROBES PASS");

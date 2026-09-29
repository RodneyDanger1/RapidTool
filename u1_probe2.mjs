// U1 scratch probe 2: import-mode loader with the path EMBEDDED in the eval
// text (process.argv[1] must stay empty — the emitted direct-run guard fires
// when argv[1] names the entry).
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const base = join(tmpdir(), "u1-probe");
const run = (args, cwd, opts = {}) =>
  spawnSync(process.execPath, args, { cwd, encoding: "utf8", timeout: 30000, ...opts });
const desc = (r) => `status=${r.status} signal=${r.signal ?? "-"} err=${r.error ? r.error.code || r.error.message : "-"} out=${JSON.stringify((r.stdout || "").slice(0, 160))} errText=${JSON.stringify((r.stderr || "").slice(0, 160))}`;

for (const slug of ["date-rrule-library", "order-webhook-service"]) {
  const cwd = join(base, slug);
  const abs = join(cwd, "src/main.ts");
  const loader =
    `const entry = ${JSON.stringify(abs)};` +
    'const { pathToFileURL } = await import("node:url");' +
    "const m = await import(pathToFileURL(entry).href);" +
    'console.log("import ok; exports: " + Object.keys(m).join(","));';
  console.log(`${slug} import(embedded, flag):`, desc(run(["--experimental-strip-types", "--input-type=module", "-e", loader], cwd)));
  console.log(`${slug} import(embedded, bare):`, desc(run(["--input-type=module", "-e", loader], cwd)));
}

// .ts exec without the flag (documenting whether v22.23 still needs it):
console.log("svc exec no-flag:", desc(run(["src/main.ts"], join(base, "order-webhook-service"))));
// parse check of the exact env-minimal shape:
console.log("env probe:", desc(spawnSync(process.execPath, ["-e", "console.log(Object.keys(process.env).join(','))"], { cwd: base, encoding: "utf8", env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, PATHEXT: process.env.PATHEXT, COMSPEC: process.env.COMSPEC, SystemDrive: process.env.SystemDrive, WINDIR: process.env.WINDIR, USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME } })));

import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { completeDeepSeek } from "./deepseek.ts";
import { getActiveKeySource } from "./key-resolution.ts";
import { LLM_ENV_FILE_VAR, resolveProcessKey } from "./key-source.server.ts";

const KEY = "DEEPSEEK_API_KEY";
const FUNDED = "sk-ffffffffffffffffffffffffffffff19b3";
const AMBIENT = "sk-eeeeeeeeeeeeeeeeeeeeeeeeeeeeee42ff";

let dir: string;
let envPath: string;

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rt331-keysource-"));
  envPath = join(dir, ".env");
  writeFileSync(envPath, `DEEPSEEK_API_KEY=${FUNDED}\n`, "utf8");
  delete process.env[LLM_ENV_FILE_VAR];
  delete process.env[KEY];
});

afterEach(() => {
  delete process.env[LLM_ENV_FILE_VAR];
  delete process.env[KEY];
  rmSync(dir, { recursive: true, force: true });
});

describe("W45 331-1 key-source.server — the provider resolves a declared .env", () => {
  it("sends the .env key when the ambient value differs (stub transport, no network)", async () => {
    process.env[LLM_ENV_FILE_VAR] = envPath;
    process.env[KEY] = AMBIENT; // non-blank, DIFFERENT from the .env key
    let auth: unknown = null;
    const res = await completeDeepSeek("hello", {
      fetch: (async (_url: unknown, init?: RequestInit) => {
        auth = (init?.headers as Record<string, string> | undefined)?.authorization;
        return okResponse({
          model: "deepseek-v4-flash",
          choices: [{ message: { role: "assistant", content: "ok" } }],
        });
      }) as typeof fetch,
    });
    assert.equal(res.ok, true);
    assert.equal(auth, `Bearer ${FUNDED}`, "the .env key must be sent, not the stale ambient value");
    assert.equal(process.env[KEY], FUNDED, "the effective .env value is installed for direct readers");
    assert.equal(getActiveKeySource()?.kind, "repo-env-file", "provenance names the .env file");
    assert.equal(getActiveKeySource()?.path, envPath);
  });

  it("declaring the marker + resolving installs the .env value and records provenance", () => {
    process.env[KEY] = AMBIENT;
    process.env[LLM_ENV_FILE_VAR] = envPath;
    const resolution = resolveProcessKey(KEY);
    assert.equal(process.env[KEY], FUNDED);
    assert.equal(resolution.effective?.kind, "repo-env-file");
    assert.deepEqual(resolution.conflict, { repoEnvTail: "19b3", processEnvTail: "42ff" });
  });

  it("a present-but-blank process value DISABLES the declared .env (keyless)", () => {
    process.env[LLM_ENV_FILE_VAR] = envPath;
    process.env[KEY] = "   ";
    const resolution = resolveProcessKey(KEY);
    assert.equal(resolution.effective, null);
    assert.equal(resolution.conflict, null);
  });

  it("with NO declared file the read is a pure process read (no side effects)", () => {
    process.env[KEY] = AMBIENT;
    const resolution = resolveProcessKey(KEY);
    assert.equal(resolution.effective?.value, AMBIENT);
    assert.equal(resolution.effective?.kind, "process-env");
    assert.equal(process.env[LLM_ENV_FILE_VAR], undefined);
  });

  it("scripts/with-app-env.mjs declares the SAME marker env var (cross-file pin)", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../../../scripts/with-app-env.mjs", import.meta.url)),
      "utf8",
    );
    assert.match(source, new RegExp(LLM_ENV_FILE_VAR), "the wrapper must set RAPIDTOOL_LLM_ENV_FILE");
    assert.match(source, /LLM_ENV_REL_PATH\s*=\s*"\.env"/, "the wrapper must point at the repo .env");
    assert.ok(!/VITE_.*DEEPSEEK|DEEPSEEK.*VITE_/.test(source), "a server secret is never VITE_-prefixed");
  });
});

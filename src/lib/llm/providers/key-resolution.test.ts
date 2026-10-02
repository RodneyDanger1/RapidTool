import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  KEY_REJECTED_CODE,
  KEY_SHADOWED_CODE,
  describeKeySource,
  getActiveKeySource,
  parseEnvFile,
  resolveApiKey,
  setActiveKeySource,
  tailOf,
} from "./key-resolution.ts";
import { ERROR_CODES, ERROR_CODE_DOC } from "../../errors.ts";

/** A 35-char fake key ending in a distinctive 4-char tail. */
const FUNDED = "sk-ffffffffffffffffffffffffffffff19b3";
const AMBIENT = "sk-eeeeeeeeeeeeeeeeeeeeeeeeeeeeee42ff";
const ENV_PATH = "C:\\repo\\.env";

describe("W45 331-1 tailOf (secrecy contract)", () => {
  it("returns only the last 4 chars of a long secret", () => {
    assert.equal(tailOf(FUNDED), "19b3");
    assert.equal(tailOf(AMBIENT), "42ff");
  });

  it("masks a short value entirely rather than echoing it", () => {
    assert.equal(tailOf("abc"), "****");
    assert.equal(tailOf("abcd"), "****");
    assert.equal(tailOf(""), "");
    assert.equal(tailOf(null), "");
  });
});

describe("W45 331-1 parseEnvFile", () => {
  it("parses KEY=value, quoted values, empty values, comments and export prefixes", () => {
    const parsed = parseEnvFile(
      [
        "# a comment",
        "",
        "DEEPSEEK_API_KEY=sk-abc",
        '  QUOTED = "sk-quoted"  ',
        "SINGLE='sk-single'",
        "EMPTY=",
        "export EXPORTED=sk-exported",
        "UNQUOTED=sk-value # trailing comment",
        "not a line",
      ].join("\n"),
    );
    assert.equal(parsed.DEEPSEEK_API_KEY, "sk-abc");
    assert.equal(parsed.QUOTED, "sk-quoted");
    assert.equal(parsed.SINGLE, "sk-single");
    assert.equal(parsed.EMPTY, "");
    assert.equal(parsed.EXPORTED, "sk-exported");
    assert.equal(parsed.UNQUOTED, "sk-value");
    assert.equal(Object.keys(parsed).length, 6);
  });

  it("never throws on hostile input", () => {
    assert.deepEqual(parseEnvFile(undefined as unknown as string), {});
    assert.deepEqual(parseEnvFile("====\n= x\n"), {});
  });
});

describe("W45 331-1 resolveApiKey (precedence)", () => {
  it(".env wins over a DIFFERENT process key and reports both tails", () => {
    const r = resolveApiKey({
      name: "DEEPSEEK_API_KEY",
      envFileValue: FUNDED,
      envFilePath: ENV_PATH,
      processValue: AMBIENT,
    });
    assert.equal(r.effective?.value, FUNDED);
    assert.equal(r.effective?.kind, "repo-env-file");
    assert.equal(r.effective?.path, ENV_PATH);
    assert.equal(r.effective?.tail, "19b3");
    assert.deepEqual(r.conflict, { repoEnvTail: "19b3", processEnvTail: "42ff" });
  });

  it("does NOT report a conflict when both sources agree", () => {
    const r = resolveApiKey({
      name: "DEEPSEEK_API_KEY",
      envFileValue: FUNDED,
      envFilePath: ENV_PATH,
      processValue: FUNDED,
    });
    assert.equal(r.effective?.value, FUNDED);
    assert.equal(r.effective?.kind, "repo-env-file");
    assert.equal(r.conflict, null);
  });

  it("falls back to the process environment when .env is absent or blank", () => {
    for (const envFileValue of [null, undefined, "", "   "]) {
      const r = resolveApiKey({
        name: "DEEPSEEK_API_KEY",
        envFileValue,
        envFilePath: ENV_PATH,
        processValue: AMBIENT,
      });
      assert.equal(r.effective?.value, AMBIENT);
      assert.equal(r.effective?.kind, "process-env");
      assert.equal(r.effective?.path, null);
      assert.equal(r.conflict, null);
    }
  });

  it("returns an honest null when neither source holds a key", () => {
    const r = resolveApiKey({
      name: "DEEPSEEK_API_KEY",
      envFileValue: null,
      envFilePath: ENV_PATH,
      processValue: null,
    });
    assert.equal(r.effective, null);
    assert.equal(r.conflict, null);
  });

  it("a present-but-BLANK process key DISABLES .env (the keyless floor)", () => {
    for (const blank of ["", "   ", "\t", "\r\n"]) {
      const r = resolveApiKey({
        name: "DEEPSEEK_API_KEY",
        envFileValue: FUNDED,
        envFilePath: ENV_PATH,
        processValue: blank,
      });
      assert.equal(r.effective, null, `blank ${JSON.stringify(blank)} must force keyless`);
      assert.equal(r.conflict, null);
    }
  });

  it("a present-but-blank process key with no .env is keyless too", () => {
    const r = resolveApiKey({
      name: "DEEPSEEK_API_KEY",
      envFileValue: null,
      envFilePath: ENV_PATH,
      processValue: "",
    });
    assert.equal(r.effective, null);
    assert.equal(r.conflict, null);
  });

  it("ABSENCE (undefined/null) is NOT the disable signal — .env still supplies the key", () => {
    for (const absent of [undefined, null]) {
      const r = resolveApiKey({
        name: "DEEPSEEK_API_KEY",
        envFileValue: FUNDED,
        envFilePath: ENV_PATH,
        processValue: absent,
      });
      assert.equal(r.effective?.value, FUNDED, "absence must fall back to .env");
      assert.equal(r.effective?.kind, "repo-env-file");
      assert.equal(r.conflict, null);
    }
  });

  it("conflict/diagnostic surfaces carry only tails — never the full secret", () => {
    const r = resolveApiKey({
      name: "DEEPSEEK_API_KEY",
      envFileValue: FUNDED,
      envFilePath: ENV_PATH,
      processValue: AMBIENT,
    });
    // The conflict object is what gets PRINTED — it must be tail-only.
    const printed = JSON.stringify(r.conflict);
    assert.ok(!printed.includes(FUNDED), "must never serialize the full .env key");
    assert.ok(!printed.includes(AMBIENT), "must never serialize the full ambient key");
    assert.match(printed, /19b3/);
    assert.match(printed, /42ff/);
    // The diagnostic label is tail-only too (the value is carried
    // separately for installation — never in a logged string).
    assert.ok(!describeKeySource(FUNDED).includes(FUNDED));
  });
});

describe("W45 331-1 describeKeySource (401 provenance)", () => {
  beforeEach(() => setActiveKeySource(null));

  it("names the .env PATH when the installed source matches the key sent", () => {
    setActiveKeySource({
      kind: "repo-env-file",
      path: ENV_PATH,
      tail: "19b3",
      value: FUNDED,
    });
    const text = describeKeySource(FUNDED);
    assert.match(text, /19b3/);
    assert.ok(text.includes(ENV_PATH), "must name the .env path");
    assert.ok(!text.includes(FUNDED), "must never include the full key");
  });

  it("names the process environment when the installed source matches", () => {
    setActiveKeySource({ kind: "process-env", path: null, tail: "42ff", value: AMBIENT });
    const text = describeKeySource(AMBIENT);
    assert.match(text, /process environment/);
    assert.match(text, /42ff/);
    assert.ok(!text.includes(AMBIENT));
  });

  it("defaults to the process environment (tail-only) when nothing was installed", () => {
    const text = describeKeySource(FUNDED);
    assert.match(text, /process environment/);
    assert.match(text, /19b3/);
    assert.ok(!text.includes(FUNDED));
  });

  it("getActiveKeySource round-trips and clears", () => {
    setActiveKeySource({ kind: "process-env", path: null, tail: "42ff", value: AMBIENT });
    assert.equal(getActiveKeySource()?.tail, "42ff");
    setActiveKeySource(null);
    assert.equal(getActiveKeySource(), null);
  });
});

describe("W45 331-1 registry wiring", () => {
  it("both new codes are registered with honest docs", () => {
    for (const code of [KEY_REJECTED_CODE, KEY_SHADOWED_CODE]) {
      assert.ok((ERROR_CODES as readonly string[]).includes(code), `${code} missing from ERROR_CODES`);
      assert.ok(ERROR_CODE_DOC[code as keyof typeof ERROR_CODE_DOC], `${code} missing a doc entry`);
    }
  });
});

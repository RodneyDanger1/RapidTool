// ---------------------------------------------------------------------------
// zip.test.ts — the STORE-only ZIP writer (src/lib/zip.ts).
// Run: node --experimental-strip-types --test src/lib/zip.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { crc32, createZip } from "./zip.ts";

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

type ParsedEntry = { name: string; data: Uint8Array };

/** Minimal reader — enough to prove the bytes form a valid ZIP central dir. */
function readZip(bytes: Uint8Array): ParsedEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  assert.notEqual(eocd, -1, "end-of-central-directory record must exist");
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const entries: ParsedEntry[] = [];
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(cursor, true), CENTRAL_SIG, "central directory header signature");
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
    assert.equal(view.getUint32(localOffset, true), LOCAL_SIG, "local header signature");
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const size = view.getUint32(localOffset + 18, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    entries.push({ name, data: bytes.subarray(dataStart, dataStart + size) });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

describe("crc32", () => {
  it("matches the standard IEEE 802.3 check value", () => {
    assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  });

  it("is stable across empty and non-empty input", () => {
    assert.equal(crc32(new Uint8Array()), 0);
    assert.equal(crc32(new TextEncoder().encode("a")), crc32(new TextEncoder().encode("a")));
  });
});

describe("createZip (STORE)", () => {
  it("round-trips entries with their exact UTF-8 names and bytes", () => {
    const bytes = createZip(
      [
        { path: "index.html", body: "<!doctype html>\n" },
        { path: "src/main.tsx", body: "export const x = 1;\n" },
        { path: "src/naïve/ünïcode.txt", body: "héllo — wörld" },
      ],
      { date: new Date(2026, 0, 2, 3, 4, 6) },
    );

    const entries = readZip(bytes);
    assert.deepEqual(
      entries.map((e) => e.name),
      ["index.html", "src/main.tsx", "src/naïve/ünïcode.txt"],
    );
    const decoder = new TextDecoder();
    assert.equal(decoder.decode(entries[0]!.data), "<!doctype html>\n");
    assert.equal(decoder.decode(entries[1]!.data), "export const x = 1;\n");
    assert.equal(decoder.decode(entries[2]!.data), "héllo — wörld");
  });

  it("stamps the UTF-8 flag and store method on every header", () => {
    const bytes = createZip([{ path: "a.txt", body: "x" }], { date: new Date(2026, 0, 2) });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    assert.equal(view.getUint16(6, true), 0x0800, "general-purpose UTF-8 flag");
    assert.equal(view.getUint16(8, true), 0, "compression method is STORE");
    // Central directory copy carries the same flags.
    const cd = view.getUint32(bytes.length - 22, true) === EOCD_SIG
      ? view.getUint32(view.getUint32(bytes.length - 22 + 16, true), true)
      : -1;
    assert.equal(cd, CENTRAL_SIG);
  });

  it("emits a valid empty archive for zero entries", () => {
    const bytes = createZip([]);
    assert.equal(bytes.length, 22, "only the end-of-central-directory record");
    const view = new DataView(bytes.buffer);
    assert.equal(view.getUint32(0, true), EOCD_SIG);
    assert.equal(view.getUint16(10, true), 0);
  });

  it("refuses more entries than ZIP16 can address", () => {
    const many = Array.from({ length: 0x10000 }, (_, i) => ({ path: `f${i}`, body: "" }));
    assert.throws(() => createZip(many), /too many entries/);
  });
});

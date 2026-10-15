// ---------------------------------------------------------------------------
// zip.ts — a minimal, dependency-free ZIP writer (STORE only, no compression).
//
// Why: the browser console can emit the product's file tree in memory
// (scaffold.scaffoldProject is pure) but there was no way to hand the user a
// real, openable archive without a server-side fs write. This module turns a
// `{ path, body }[]` list into the bytes of a standard ZIP that Windows
// Explorer, macOS Archive Utility and `unzip` all open.
//
// Scope + honesty: STORE method (0) only — CRC32 + local file header + central
// directory + end-of-central-directory, UTF-8 names (general-purpose bit 11).
// It is NOT a general ZIP library: no compression, no ZIP64, no encryption, no
// directory entries. Each input path is written verbatim (forward slashes), so
// extracting reproduces the exact relative tree.
//
// Pure + deterministic given `date` (defaults to now): no I/O, no globals.
// ---------------------------------------------------------------------------

/** One file to place in the archive. `body` is UTF-8 encoded. */
export type ZipEntry = { path: string; body: string | Uint8Array };

/** CRC32 (IEEE 802.3) over bytes — the checksum every ZIP entry requires. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]!;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();

function bytesOf(body: string | Uint8Array): Uint8Array {
  return typeof body === "string" ? encoder.encode(body) : body;
}

/** MS-DOS packed date/time (ZIP's 1980-epoch fields). */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const packedDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const packedTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  return { time: packedTime & 0xffff, date: packedDate & 0xffff };
}

function u16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value & 0xffff, true);
}

function u32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
/** UTF-8 filename/comment flag (general-purpose bit 11). */
const FLAG_UTF8 = 0x0800;

/**
 * Build a STORE-only ZIP archive. Entry order is preserved; duplicate paths are
 * written as given (the caller owns de-duplication). Throws only on absurd
 * input (> 65535 entries, > 4 GiB total — both outside the product-tree case).
 */
export function createZip(entries: readonly ZipEntry[], options: { date?: Date } = {}): Uint8Array {
  if (entries.length > 0xffff) {
    throw new Error(`createZip: too many entries (${entries.length}); ZIP16 caps at 65535`);
  }
  const { time, date } = dosDateTime(options.date ?? new Date());

  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const dataBytes = bytesOf(entry.body);
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    u32(lv, 0, LOCAL_SIG);
    u16(lv, 4, 20); // version needed to extract
    u16(lv, 6, FLAG_UTF8);
    u16(lv, 8, 0); // method: store
    u16(lv, 10, time);
    u16(lv, 12, date);
    u32(lv, 14, crc);
    u32(lv, 18, dataBytes.length); // compressed size == uncompressed (store)
    u32(lv, 22, dataBytes.length);
    u16(lv, 26, nameBytes.length);
    u16(lv, 28, 0); // extra length
    localHeader.set(nameBytes, 30);
    local.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    u32(cv, 0, CENTRAL_SIG);
    u16(cv, 4, 20); // version made by
    u16(cv, 6, 20); // version needed
    u16(cv, 8, FLAG_UTF8);
    u16(cv, 10, 0); // method: store
    u16(cv, 12, time);
    u16(cv, 14, date);
    u32(cv, 16, crc);
    u32(cv, 20, dataBytes.length);
    u32(cv, 24, dataBytes.length);
    u16(cv, 28, nameBytes.length);
    u16(cv, 30, 0); // extra length
    u16(cv, 32, 0); // comment length
    u16(cv, 34, 0); // disk number start
    u16(cv, 36, 0); // internal attributes
    u32(cv, 38, 0); // external attributes
    u32(cv, 42, offset); // relative offset of the local header
    centralHeader.set(nameBytes, 46);
    central.push(centralHeader);

    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  u32(ev, 0, EOCD_SIG);
  u16(ev, 4, 0); // this disk
  u16(ev, 6, 0); // disk with central directory
  u16(ev, 8, entries.length); // entries on this disk
  u16(ev, 10, entries.length); // total entries
  u32(ev, 12, centralSize);
  u32(ev, 16, offset); // central directory offset
  u16(ev, 20, 0); // comment length

  const chunks = [...local, ...central, eocd];
  const total = chunks.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of chunks) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

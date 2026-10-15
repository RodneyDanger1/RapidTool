import { renderHome, computeOpenStatus, getWeeklyHours, getHolidayClosures, renderHoursPage, getMenuItems, filterMenu, renderMenu } from "../generated/render-home.ts";
import { formatGbp, computeLineTotal, validateOrder, submitOrder, generateOrderReference, renderOrderConfirmation, renderContactPage } from "../generated/format-gbp.ts";
import { runQuery, listQueryRuns } from "./query.ts";
// src/generated/track.ts
// Golden Crust Bakery — track/show image job module.
// Implements the two type signatures owned by this file:
//   runTrack(command: TrackCommand): Promise<Image>
//   listTrackRuns(id: string, limit?: number): Promise<TrackRun[]>
//
// These wrap the project's A6 data contract for the Image entity and the
// GET /v1/track endpoint. No backend exists (the site is static), so the
// job records live purely in-memory here and are produced deterministically
// from the inputs (no Math.random, no Date.now non-determinism beyond the
// caller-supplied clock value and an incrementing sequence).

type EntityStatus = "draft" | "published" | "archived";

type ImageEntity = {
  id: string;
  status: EntityStatus;
  updatedAt: string;
};

type Image = {
  id: string;
  status: EntityStatus;
  updatedAt: string;
  url: string;
  alt: string;
  width: number;
  height: number;
};

type TrackCommand = {
  source: string;
  alt: string;
  now: string;
  width?: number;
  height?: number;
  status?: EntityStatus;
};

type TrackRun = {
  id: string;
  status: "ok" | "error";
  startedAt: string;
  finishedAt: string;
  image?: Image;
  message?: string;
};

type TrackStore = {
  sequence: number;
  runs: TrackRun[];
};

const trackStore: TrackStore = { sequence: 0, runs: [] };

const DEFAULT_TRACK_WIDTH: number = 1200;
const DEFAULT_TRACK_HEIGHT: number = 800;
const MAX_TRACK_RUNS: number = 200;

/**
 * Format a zero-padded decimal string.
 *
 * @param value - non-negative integer to pad.
 * @param width - minimum number of digits.
 * @returns the zero-padded string.
 */
function padTrackNumber(value: number, width: number): string {
  let text: string = String(Math.trunc(Math.abs(value)));
  while (text.length < width) {
    text = "0" + text;
  }
  return text;
}

/**
 * Sanitise a short free-text value so it can be echoed safely.
 *
 * @param value - raw input value.
 * @returns an escaped, trimmed string.
 */
function sanitizeTrackText(value: string): string {
  const raw: string = typeof value === "string" ? value : "";
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .trim();
}

/**
 * Normalise a positive integer measurement, falling back when unusable.
 *
 * @param value - candidate measurement.
 * @param fallback - value used when the candidate is not a finite positive number.
 * @returns a finite positive integer.
 */
function normalizeTrackDimension(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.trunc(value);
}

/**
 * Build an Image entity from the collected tracking values.
 *
 * // req-9
 *
 * @param id - image entity id.
 * @param url - image url.
 * @param alt - alt text for the image (never empty).
 * @param width - rendered width in pixels.
 * @param height - rendered height in pixels.
 * @param status - entity status.
 * @param updatedAt - ISO timestamp of the update.
 * @returns the assembled Image entity.
 */
function buildTrackImage(
  id: string,
  url: string,
  alt: string,
  width: number,
  height: number,
  status: EntityStatus,
  updatedAt: string,
): Image {
  const safeAlt: string = sanitizeTrackText(alt);
  return {
    id: id,
    status: status,
    updatedAt: updatedAt,
    url: url,
    alt: safeAlt.length > 0 ? safeAlt : "Golden Crust Bakery image",
    width: width,
    height: height,
  };
}

/**
 * Record a completed run in the in-memory track journal.
 *
 * @param run - the run record to append.
 * @returns the stored run record.
 */
function recordTrackRun(run: TrackRun): TrackRun {
  trackStore.runs.push(run);
  if (trackStore.runs.length > MAX_TRACK_RUNS) {
    trackStore.runs.splice(0, trackStore.runs.length - MAX_TRACK_RUNS);
  }
  return run;
}

/**
 * Run an image tracking job for a static Golden Crust page image.
 *
 * The command describes the source image, its alt text and the current
 * instant; the returned Image entity follows the A6 data contract
 * (id, status, updatedAt) and adds the rendered attributes the page needs.
 * Deterministic: identical commands always produce identical image ids.
 *
 * @param command - the track command describing the image to track.
 * @returns the tracked Image entity.
 */
// req-12
async function runTrack(command: TrackCommand): Promise<Image> {
  const now: string =
    command !== undefined && command !== null && typeof command.now === "string" && command.now.length > 0
      ? command.now
      : "1970-01-01T00:00:00.000Z";
  const source: string =
    command !== undefined && command !== null && typeof command.source === "string" && command.source.length > 0
      ? command.source
      : "static://golden-crust/image";
  const alt: string = command !== undefined && command !== null ? command.alt : "";
  const status: EntityStatus =
    command !== undefined && command !== null && command.status === "draft"
      ? "draft"
      : command !== undefined && command !== null && command.status === "archived"
        ? "archived"
        : "published";

  trackStore.sequence = trackStore.sequence + 1;
  const sequence: string = padTrackNumber(trackStore.sequence, 4);
  const id: string = "img_" + sequence + "_" + sanitizeTrackText(source).replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();

  const image: Image = buildTrackImage(
    id,
    source,
    alt,
    normalizeTrackDimension(command !== undefined && command !== null ? command.width : undefined, DEFAULT_TRACK_WIDTH),
    normalizeTrackDimension(command !== undefined && command !== null ? command.height : undefined, DEFAULT_TRACK_HEIGHT),
    status,
    now,
  );

  recordTrackRun({
    id: id,
    status: "ok",
    startedAt: now,
    finishedAt: now,
    image: image,
  });

  return image;
}

/**
 * List the recorded image tracking runs, newest first.
 *
 * Backed by the static in-memory journal because the marketing site has no
 * database or CMS backend; the endpoint contract of GET /v1/track is
 * honoured with the same shape the static content uses.
 *
 * @param id - image source or entity id prefix to filter by (empty lists all).
 * @param limit - maximum number of runs to return (defaults to 50).
 * @returns the matching run records, newest first.
 */
// req-12
async function listTrackRuns(id: string, limit?: number): Promise<TrackRun[]> {
  const filter: string = typeof id === "string" ? id.trim().toLowerCase() : "";
  const max: number =
    typeof limit === "number" && isFinite(limit) && limit > 0 ? Math.trunc(limit) : 50;

  const matches: TrackRun[] = trackStore.runs.filter((run: TrackRun): boolean => {
    if (filter.length === 0) {
      return true;
    }
    const haystack: string =
      run.id.toLowerCase() + " " + (run.image !== undefined && run.image !== null ? run.image.url : "").toLowerCase();
    return haystack.indexOf(filter) !== -1;
  });

  const newestFirst: TrackRun[] = matches.slice().reverse();
  return newestFirst.slice(0, max);
}
export { runTrack, listTrackRuns };

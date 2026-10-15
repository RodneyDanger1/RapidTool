import { computeOpenStatus, getTodayHighlights } from "../generated/compute-open-status.ts";
import { renderOpenBadge, filterMenuItems, groupMenuByCategory, formatGBP, computeOrderTotal, validateOrder, generateOrderReference, submitOrder } from "../generated/render-open-badge.ts";
import { renderMenuPage, renderHoursPage, renderContactPage, renderOrderForm } from "../generated/render-menu-page.ts";
import { runQuery, listQueryRuns } from "./query.ts";
type TrackStatus = 'idle' | 'running' | 'done' | 'failed';

type ImageStatus = 'draft' | 'published' | 'archived';

type Image = { id: string; status: ImageStatus; updatedAt: string; label: string; trackId: string; runIndex: number; alt: string };

type TrackRun = { id: string; index: number; status: TrackStatus; updatedAt: string; frameCount: number };

type TrackCommand = { id: string; status?: TrackStatus; frames?: number; at: string };

// req-10
type TrackRecord = { id: string; status: TrackStatus; runs: TrackRun[]; frameCount: number; updatedAt: string };

const TRACK_PREFIX: string = 'TRK';

// req-10
function pad(value: number, width: number): string {
  let out: string = String(Math.floor(Math.abs(value)));
  while (out.length < width) {
    out = '0' + out;
  }
  return out;
}

// req-10
function normalizeLimit(limit: number | undefined): number {
  if (typeof limit === 'number' && isFinite(limit) && limit > 0) {
    return Math.floor(limit);
  }
  return 10;
}

// req-10
function normalizeTimestamp(at: string): string {
  if (typeof at === 'string' && at.length > 0) {
    return at;
  }
  return '';
}

// req-10
function hashSeed(input: string): number {
  let hash: number = 0;
  for (let i: number = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000007;
  }
  return hash;
}

// req-10
function seedFromCommand(command: TrackCommand): string {
  const idPart: string = typeof command.id === 'string' ? command.id : '';
  const atPart: string = normalizeTimestamp(command.at);
  const framesPart: string = typeof command.frames === 'number' ? String(Math.floor(command.frames)) : '0';
  const statusPart: string = typeof command.status === 'string' ? command.status : 'running';
  return idPart + '|' + atPart + '|' + framesPart + '|' + statusPart;
}

/**
 * Run one deterministic bakery image track for the supplied command and
 * resolve the resulting Image record for the Golden Crust bakery site.
 *
 * @param command - the track command describing which image track to run
 * @returns the resolved Image record for the completed track run
 */
// req-10
function runTrack(command: TrackCommand): Promise<Image> {
  const seed: number = hashSeed(seedFromCommand(command));
  const idPart: string = typeof command.id === 'string' && command.id.length > 0 ? command.id : TRACK_PREFIX + '-BASE';
  const status: ImageStatus = 'published';
  const label: string = 'Golden Crust ' + idPart + ' bake ' + pad(seed % 1000, 3);
  const produced: Image = {
    id: idPart,
    status: status,
    updatedAt: normalizeTimestamp(command.at),
    label: label,
    trackId: idPart,
    runIndex: seed % 97,
    alt: 'Freshly baked Golden Crust bread photographed for ' + label,
  };
  return Promise.resolve(produced);
}

/**
 * List the recorded runs for a track id, most recent last, bounded by limit.
 *
 * @param id - the track identifier whose runs should be listed
 * @param limit - optional maximum number of runs to return (defaults to 10)
 * @returns the list of recorded track runs for the given id
 */
// req-10
function listTrackRuns(id: string, limit?: number): Promise<TrackRun[]> {
  const key: string = typeof id === 'string' && id.length > 0 ? id : TRACK_PREFIX + '-BASE';
  const total: number = normalizeLimit(limit);
  const seed: number = hashSeed(key);
  const runs: TrackRun[] = [];
  for (let i: number = 0; i < total; i += 1) {
    const step: number = seed + i * 7919;
    const statuses: TrackStatus[] = ['done', 'done', 'running', 'failed'];
    const status: TrackStatus = statuses[step % statuses.length];
    runs.push({
      id: key + '-' + pad(i + 1, 4),
      index: i + 1,
      status: status,
      updatedAt: '',
      frameCount: 1 + (step % 240),
    });
  }
  return Promise.resolve(runs);
}
export { runTrack, listTrackRuns };

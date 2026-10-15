import { computeOpenStatus, getTodayHighlights } from "../generated/compute-open-status.ts";
import { renderOpenBadge, filterMenuItems, groupMenuByCategory, formatGBP, computeOrderTotal, validateOrder, generateOrderReference, submitOrder } from "../generated/render-open-badge.ts";
import { renderMenuPage, renderHoursPage, renderContactPage, renderOrderForm } from "../generated/render-menu-page.ts";
import { runQuery, listQueryRuns } from "./query.ts";
import { runTrack, listTrackRuns } from "./track.ts";
type CloseCommand = {
  id: string;
  payload?: Record<string, unknown>;
  now?: string;
};

type Page = {
  id: string;
  status: string;
  updatedAt: string;
  sections: string[];
};

type CloseRun = {
  id: string;
  status: string;
  updatedAt: string;
  pageId: string;
  closed: boolean;
};

const closeRunStore: CloseRun[] = [];

function normalizeCloseId(seed: string): string {
  const cleaned = seed.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const padded = (cleaned + "000000").slice(0, 6);
  return "clz-" + padded;
}

function buildCloseTimestamp(command: CloseCommand): string {
  if (typeof command.now === "string" && command.now.length > 0) {
    return command.now;
  }
  return "1970-01-01T00:00:00.000Z";
}

/**
 * Runs a close command and resolves the resulting Page record.
 *
 * @param command - The close command carrying the target id, optional payload and clock.
 * @returns A promise resolving to the resulting Page.
 */
// req-1
async function runClose(command: CloseCommand): Promise<Page> {
  const pageId = normalizeCloseId(command.id);
  const updatedAt = buildCloseTimestamp(command);
  const payload = command.payload ?? {};
  const sections: string[] = [];
  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (typeof value === "string") {
      sections.push(key + ":" + value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      sections.push(key + ":" + String(value));
    } else {
      sections.push(key);
    }
  }
  const page: Page = {
    id: pageId,
    status: "closed",
    updatedAt: updatedAt,
    sections: sections
  };
  closeRunStore.push({
    id: pageId,
    status: "closed",
    updatedAt: updatedAt,
    pageId: pageId,
    closed: true
  });
  return page;
}

/**
 * Lists recorded close runs for a given id, newest last, capped by limit.
 *
 * @param id - The id to filter recorded close runs by.
 * @param limit - Optional maximum number of runs to return.
 * @returns A promise resolving to the matching close runs.
 */
// req-10
async function listCloseRuns(id: string, limit?: number): Promise<CloseRun[]> {
  const target = normalizeCloseId(id);
  const all: CloseRun[] = [];
  for (const run of closeRunStore) {
    if (run.id === target) {
      all.push({
        id: run.id,
        status: run.status,
        updatedAt: run.updatedAt,
        pageId: run.pageId,
        closed: run.closed
      });
    }
  }
  if (typeof limit === "number" && limit >= 0) {
    return all.slice(0, Math.floor(limit));
  }
  return all;
}
export { runClose, listCloseRuns };

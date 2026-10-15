import { computeOpenStatus, getTodayHighlights } from "../generated/compute-open-status.ts";
import { renderOpenBadge, filterMenuItems, groupMenuByCategory, formatGBP, computeOrderTotal, validateOrder, generateOrderReference, submitOrder } from "../generated/render-open-badge.ts";
import { renderMenuPage, renderHoursPage, renderContactPage, renderOrderForm } from "../generated/render-menu-page.ts";
import { runQuery, listQueryRuns } from "./query.ts";
import { runTrack, listTrackRuns } from "./track.ts";
import { runClose, listCloseRuns } from "./close.ts";
// req-1, req-10
interface SearchCommand {
  id: string;
  query: string;
  category?: string;
  allergen?: string;
  limit?: number;
}

interface TableRow {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  allergens: string[];
}

interface Table {
  id: string;
  status: string;
  updatedAt: string;
  columns: string[];
  rows: TableRow[];
}

interface SearchRun {
  id: string;
  commandId: string;
  query: string;
  resultCount: number;
  status: string;
  updatedAt: string;
}

interface SearchState {
  runs: SearchRun[];
}

const searchState: SearchState = { runs: [] };

/**
 * Catalog of bakery menu items used as the searchable table source.
 * @returns The full list of searchable table rows.
 */
function getCatalogRows(): TableRow[] {
  return [
    { id: "item-001", name: "Sourdough Loaf", description: "Naturally leavened white sourdough with a blistered crust.", price: 5.5, category: "Breads", allergens: ["gluten", "vegan"] },
    { id: "item-002", name: "Wholemeal Cob", description: "Stoneground wholemeal cob with a soft crumb.", price: 4.2, category: "Breads", allergens: ["gluten", "vegan"] },
    { id: "item-003", name: "Focaccia Slab", description: "Olive-oil focaccia finished with rosemary and sea salt.", price: 4.8, category: "Breads", allergens: ["gluten", "vegan"] },
    { id: "item-004", name: "Butter Croissant", description: "Laminated 72-hour croissant baked golden each morning.", price: 3.1, category: "Pastries", allergens: ["gluten", "dairy", "egg"] },
    { id: "item-005", name: "Pain au Chocolat", description: "Flaky pastry filled with two dark chocolate batons.", price: 3.4, category: "Pastries", allergens: ["gluten", "dairy", "egg"] },
    { id: "item-006", name: "Almond Danish", description: "Sweet pastry swirl with frangipane and toasted almonds.", price: 3.8, category: "Pastries", allergens: ["gluten", "dairy", "nuts", "egg"] },
    { id: "item-007", name: "Cinnamon Bun", description: "Soft enriched dough rolled with cinnamon sugar.", price: 3.2, category: "Pastries", allergens: ["gluten", "dairy", "egg"] },
    { id: "item-008", name: "Victoria Sponge", description: "Vanilla sponge layered with jam and whipped cream.", price: 18.0, category: "Cakes", allergens: ["gluten", "dairy", "egg"] },
    { id: "item-009", name: "Lemon Drizzle", description: "Zesty lemon loaf cake with a crunchy sugar glaze.", price: 16.5, category: "Cakes", allergens: ["gluten", "dairy", "egg"] },
    { id: "item-010", name: "Chocolate Fudge Cake", description: "Rich cocoa sponge with a fudgy dark chocolate ganache.", price: 22.0, category: "Cakes", allergens: ["gluten", "dairy", "egg"] },
    { id: "item-011", name: "Vegan Carrot Cake", description: "Plant-based carrot sponge with coconut frosting.", price: 19.5, category: "Cakes", allergens: ["gluten", "nuts", "vegan"] },
    { id: "item-012", name: "Flat White", description: "Double ristretto with silky steamed milk.", price: 3.3, category: "Drinks", allergens: ["dairy"] },
    { id: "item-013", name: "Filter Coffee", description: "Single-origin filter coffee brewed by the cup.", price: 2.8, category: "Drinks", allergens: ["vegan"] },
    { id: "item-014", name: "Oat Cappuccino", description: "Espresso topped with steamed oat milk foam.", price: 3.5, category: "Drinks", allergens: ["vegan"] },
    { id: "item-015", name: "Loose Leaf Tea", description: "English breakfast loose leaf tea served in a pot.", price: 2.6, category: "Drinks", allergens: ["vegan"] }
  ];
}

/**
 * Deterministic timestamp derived from a monotonic counter rather than wall clock.
 * @param sequence - Non-negative integer sequence input.
 * @returns An ISO-like datetime string.
 */
function searchTimestamp(sequence: number): string {
  const normalized = sequence < 0 ? 0 : Math.floor(sequence);
  const year = 2024;
  const month = 1 + (normalized % 12);
  const day = 1 + (normalized % 28);
  const hour = normalized % 24;
  const minute = normalized % 60;
  const second = normalized % 60;
  const pad = (value: number): string => (value < 10 ? "0" + String(value) : String(value));
  return String(year) + "-" + pad(month) + "-" + pad(day) + "T" + pad(hour) + ":" + pad(minute) + ":" + pad(second) + "Z";
}

/**
 * Derives a deterministic run identifier from a command identifier and index.
 * @param commandId - Identifier of the originating search command.
 * @param index - Zero-based index of the run for this command.
 * @returns A stable run identifier string.
 */
function searchRunId(commandId: string, index: number): string {
  const safeIndex = index < 0 ? 0 : Math.floor(index);
  return "run-" + String(commandId) + "-" + String(safeIndex + 1).padStart(4, "0");
}

/**
 * Normalizes a free-text search string for case-insensitive comparison.
 * @param value - Raw text value from the caller.
 * @returns Lower-cased trimmed text.
 */
function normalizeSearchText(value: string): string {
  return String(value == null ? "" : value).trim().toLowerCase();
}

/**
 * Applies category, allergen and free-text filters with AND semantics.
 * @param rows - Candidate rows from the shared table source.
 * @param command - Search command carrying the active filters.
 * @returns Rows that match every active filter.
 */
function applySearchFilters(rows: TableRow[], command: SearchCommand): TableRow[] {
  const query = normalizeSearchText(command.query);
  const category = normalizeSearchText(command.category == null ? "" : command.category);
  const allergen = normalizeSearchText(command.allergen == null ? "" : command.allergen);
  return rows.filter((row: TableRow): boolean => {
    if (category !== "" && normalizeSearchText(row.category) !== category) {
      return false;
    }
    if (allergen !== "") {
      const tags = row.allergens.map((tag: string): string => normalizeSearchText(tag));
      if (tags.indexOf(allergen) === -1) {
        return false;
      }
    }
    if (query !== "") {
      const haystack = normalizeSearchText(row.name) + " " + normalizeSearchText(row.description);
      if (haystack.indexOf(query) === -1) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Executes a search command against the static table source and records the run.
 * Implements the GET /v1/search endpoint as an in-app operation.
 * @param command - Search command with filters and an identifier.
 * @returns The matching table with its rows and metadata.
 */
async function runSearch(command: SearchCommand): Promise<Table> {
  const rows = applySearchFilters(getCatalogRows(), command);
  const bounded = rows.slice(0, 50);
  const run: SearchRun = {
    id: searchRunId(command.id, searchState.runs.length),
    commandId: command.id,
    query: String(command.query == null ? "" : command.query),
    resultCount: bounded.length,
    status: "closed",
    updatedAt: searchTimestamp(searchState.runs.length + 1)
  };
  searchState.runs.push(run);
  const table: Table = {
    id: command.id,
    status: "complete",
    updatedAt: searchTimestamp(searchState.runs.length),
    columns: ["id", "name", "description", "price", "category", "allergens"],
    rows: bounded
  };
  return table;
}

/**
 * Lists recorded search runs for a given command identifier.
 * Implements the GET /v1/track endpoint as an in-app operation.
 * @param id - Command identifier to filter runs by.
 * @param limit - Optional maximum number of runs to return.
 * @returns The most recent matching runs up to the limit.
 */
async function listSearchRuns(id: string, limit?: number): Promise<SearchRun[]> {
  const matching = searchState.runs.filter((run: SearchRun): boolean => run.commandId === id);
  const effective = typeof limit === "number" && limit > 0 ? Math.floor(limit) : matching.length;
  const ordered = matching.slice().reverse();
  return ordered.slice(0, effective);
}
export { runSearch, listSearchRuns };

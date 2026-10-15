type Allergen = 'gluten' | 'dairy' | 'nuts' | 'egg' | 'vegan';
type Category = 'Breads' | 'Pastries' | 'Cakes' | 'Drinks';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  priceGBP: number;
  category: Category;
  allergens: Allergen[];
}

interface WeeklyHoursRow {
  day: string;
  open: string | null;
  close: string | null;
}

interface HolidayClosure {
  date: string;
  label: string;
}

interface OpeningHoursTable {
  weekly: WeeklyHoursRow[];
  holidays: HolidayClosure[];
}

const DAY_NAMES: string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

/**
 * Formats an integer minute-of-day value as a 24-hour HH:MM clock string.
 * @param minutes minutes since midnight
 * @returns two-digit padded HH:MM
 */
function minutesToClock(minutes: number): string {
  const normalized: number = ((minutes % 1440) + 1440) % 1440;
  const hour: number = Math.floor(normalized / 60);
  const minute: number = normalized % 60;
  const hh: string = hour < 10 ? '0' + String(hour) : String(hour);
  const mm: string = minute < 10 ? '0' + String(minute) : String(minute);
  return hh + ':' + mm;
}

/**
 * Parses an HH:MM clock string into minutes since midnight.
 * @param clock the clock string, or null
 * @returns minutes since midnight, or null when absent/unparseable
 */
function clockToMinutes(clock: string | null): number | null {
  if (clock === null || clock === undefined) {
    return null;
  }
  const trimmed: string = clock.trim();
  const match: RegExpExecArray | null = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (match === null) {
    return null;
  }
  const hour: number = Number(match[1]);
  const minute: number = Number(match[2]);
  if (isNaN(hour) || isNaN(minute)) {
    return null;
  }
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

/**
 * Builds a local YYYY-MM-DD date key for the supplied date.
 * @param now the date to key
 * @returns the ISO-style local date key
 */
function dateKey(now: Date): string {
  const year: number = now.getFullYear();
  const month: number = now.getMonth() + 1;
  const day: number = now.getDate();
  const mm: string = month < 10 ? '0' + String(month) : String(month);
  const dd: string = day < 10 ? '0' + String(day) : String(day);
  return String(year) + '-' + mm + '-' + dd;
}

/**
 * Computes whether the bakery is currently open from the shared hours table.
 * This is the single source of truth reused by the Home badge and the Hours page.
 * The badge is forced to Closed on a listed holiday, renders Closed for a day
 * with no weekly rows, and supports midnight-wrapping close times.
 * // req-2
 * // req-8
 * @param hours the shared opening-hours table
 * @param now the current moment
 * @returns an object with the isOpen flag and a human-readable label
 */
function computeOpenStatus(hours: OpeningHoursTable, now: Date): { isOpen: boolean; label: string } {
  const todayKey: string = dateKey(now);
  const holiday: HolidayClosure | undefined = hours.holidays.find(
    (h: HolidayClosure): boolean => h.date === todayKey
  );
  if (holiday !== undefined) {
    return { isOpen: false, label: 'Closed today \u2014 ' + holiday.label };
  }

  const todayName: string = DAY_NAMES[now.getDay()];
  const rows: WeeklyHoursRow[] = hours.weekly.filter(
    (row: WeeklyHoursRow): boolean => row.day === todayName
  );
  if (rows.length === 0) {
    return { isOpen: false, label: 'Closed today' };
  }

  const nowMinutes: number = now.getHours() * 60 + now.getMinutes();
  let matchLabel: string | null = null;

  for (let i: number = 0; i < rows.length; i += 1) {
    const row: WeeklyHoursRow = rows[i];
    const openMinutes: number | null = clockToMinutes(row.open);
    const closeMinutes: number | null = clockToMinutes(row.close);
    if (openMinutes === null || closeMinutes === null) {
      continue;
    }
    let isOpenNow: boolean = false;
    if (closeMinutes > openMinutes) {
      isOpenNow = nowMinutes >= openMinutes && nowMinutes < closeMinutes;
    } else if (closeMinutes < openMinutes) {
      isOpenNow = nowMinutes >= openMinutes || nowMinutes < closeMinutes;
    } else {
      isOpenNow = true;
    }
    if (isOpenNow) {
      matchLabel = 'Open until ' + minutesToClock(closeMinutes);
      break;
    }
  }

  if (matchLabel !== null) {
    return { isOpen: true, label: matchLabel };
  }

  let nextOpen: number | null = null;
  for (let i: number = 0; i < rows.length; i += 1) {
    const openMinutes: number | null = clockToMinutes(rows[i].open);
    if (openMinutes !== null && openMinutes > nowMinutes) {
      if (nextOpen === null || openMinutes < nextOpen) {
        nextOpen = openMinutes;
      }
    }
  }

  if (nextOpen !== null) {
    return { isOpen: false, label: 'Closed \u2014 opens at ' + minutesToClock(nextOpen) };
  }

  return { isOpen: false, label: 'Closed' };
}

/**
 * Selects today's fresh-bake highlights from the menu for the Home hero.
 * // req-2
 * @param items the full menu item list
 * @param now the current moment used to derive a stable daily rotation
 * @returns up to four items highlighted for today
 */
function getTodayHighlights(items: MenuItem[], now: Date): MenuItem[] {
  if (items.length === 0) {
    return [];
  }
  const startIndex: number = (now.getFullYear() + now.getMonth() + now.getDate()) % items.length;
  const count: number = items.length < 4 ? items.length : 4;
  const highlights: MenuItem[] = [];
  for (let i: number = 0; i < count; i += 1) {
    const index: number = (startIndex + i) % items.length;
    highlights.push(items[index]);
  }
  return highlights;
}
export { computeOpenStatus, getTodayHighlights };

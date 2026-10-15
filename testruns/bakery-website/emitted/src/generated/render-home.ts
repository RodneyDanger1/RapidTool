type AllergenTag = 'gluten' | 'dairy' | 'nuts' | 'egg' | 'vegan';

type Category = 'Breads' | 'Pastries' | 'Cakes' | 'Drinks';

interface MenuItem {
  name: string;
  description: string;
  priceGbp: number;
  category: string;
  allergens: string[];
}

interface MenuFilters {
  category: string;
  tag: string;
  query: string;
}

interface WeeklyHours {
  days: { day: string; open: string; close: string }[];
}

interface HolidayClosure {
  name: string;
  date: string;
}

interface OpenStatus {
  open: boolean;
  label: string;
  todayOpen: string;
  todayClose: string;
}

/**
 * Returns the single shared weekly hours table used by the Home badge and the Hours page.
 * @returns the weekly hours source of truth.
 */
// req-3
function getWeeklyHours(): WeeklyHours {
  return {
    days: [
      { day: 'Monday', open: '07:00', close: '17:00' },
      { day: 'Tuesday', open: '07:00', close: '17:00' },
      { day: 'Wednesday', open: '07:00', close: '17:00' },
      { day: 'Thursday', open: '07:00', close: '17:00' },
      { day: 'Friday', open: '07:00', close: '18:00' },
      { day: 'Saturday', open: '08:00', close: '18:00' },
      { day: 'Sunday', open: '08:00', close: '14:00' }
    ]
  };
}

/**
 * Returns the holiday closures used by both the Home badge and the Hours page.
 * @returns the holiday closure list.
 */
// req-3
function getHolidayClosures(): HolidayClosure[] {
  return [
    { name: 'New Year\u2019s Day', date: '2025-01-01' },
    { name: 'Christmas Day', date: '2025-12-25' },
    { name: 'Boxing Day', date: '2025-12-26' }
  ];
}

/**
 * Converts a Date to an ISO date string (YYYY-MM-DD) using local calendar fields.
 * @param d the date to convert.
 * @returns the ISO date string.
 */
function toIsoDate(d: Date): string {
  const y: number = d.getFullYear();
  const m: number = d.getMonth() + 1;
  const day: number = d.getDate();
  const mm: string = m < 10 ? '0' + String(m) : String(m);
  const dd: string = day < 10 ? '0' + String(day) : String(day);
  return String(y) + '-' + mm + '-' + dd;
}

/**
 * Returns the weekday name for a Date.
 * @param d the date to inspect.
 * @returns the weekday name.
 */
function weekdayName(d: Date): string {
  const names: string[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[d.getDay()];
}

/**
 * Parses an 'HH:MM' time into total minutes from midnight.
 * @param t the time string.
 * @returns minutes from midnight, or -1 when unparseable.
 */
function parseMinutes(t: string): number {
  if (typeof t !== 'string') {
    return -1;
  }
  const parts: string[] = t.split(':');
  if (parts.length !== 2) {
    return -1;
  }
  const h: number = Number(parts[0]);
  const m: number = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) {
    return -1;
  }
  return h * 60 + m;
}

/**
 * Pads a count to a two digit string.
 * @param n the number to pad.
 * @returns the padded string.
 */
function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

/**
 * Escapes text so it can be echoed safely without breaking markup.
 * @param s the raw text.
 * @returns the escaped text.
 */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats a GBP amount with exactly two decimals.
 * @param n the amount in pounds.
 * @returns the formatted GBP string.
 */
function formatGbp(n: number): string {
  if (typeof n !== 'number' || isNaN(n) || !isFinite(n)) {
    return 'unavailable';
  }
  const pence: number = Math.round(n * 100);
  if (isNaN(pence)) {
    return 'unavailable';
  }
  const whole: number = Math.floor(pence / 100);
  const rest: number = pence - whole * 100;
  return '\u00a3' + String(whole) + '.' + pad2(rest);
}

/**
 * Computes the line total for a unit price and quantity, formatted in GBP.
 * @param unitPrice the unit price in pounds.
 * @param quantity the quantity ordered.
 * @returns the formatted line total or 'unavailable' when it cannot be produced.
 */
function computeLineTotal(unitPrice: number, quantity: number): string {
  if (typeof unitPrice !== 'number' || typeof quantity !== 'number' || isNaN(unitPrice) || isNaN(quantity) || quantity < 1) {
    return 'unavailable';
  }
  return formatGbp(Math.round(unitPrice * 100) * quantity / 100);
}

/**
 * Computes the Open/Closed badge from the shared weekly hours table and current time.
 * @param now the current instant.
 * @param hours the shared weekly hours table.
 * @param closures the holiday closures.
 * @returns the OpenStatus for the current instant.
 */
// req-2
// req-3
function computeOpenStatus(now: Date, hours: WeeklyHours, closures: HolidayClosure[]): OpenStatus {
  const dayName: string = weekdayName(now);
  const todayIso: string = toIsoDate(now);
  let entryOpen: string | undefined = undefined;
  let entryClose: string | undefined = undefined;
  if (hours && Array.isArray(hours.days)) {
    for (let i = 0; i < hours.days.length; i = i + 1) {
      const d = hours.days[i];
      if (d && d.day === dayName) {
        entryOpen = d.open;
        entryClose = d.close;
      }
    }
  }
  let closedToday: boolean = false;
  if (Array.isArray(closures)) {
    for (let j = 0; j < closures.length; j = j + 1) {
      const c = closures[j];
      if (c && c.date === todayIso) {
        closedToday = true;
      }
    }
  }
  if (!entryOpen || !entryClose) {
    return { open: false, label: 'Closed', todayOpen: 'Closed', todayClose: 'Closed' };
  }
  if (closedToday) {
    return { open: false, label: 'Closed', todayOpen: entryOpen, todayClose: entryClose };
  }
  const openMin: number = parseMinutes(entryOpen);
  const closeMin: number = parseMinutes(entryClose);
  const nowMin: number = now.getHours() * 60 + now.getMinutes();
  let isOpen: boolean = false;
  if (openMin >= 0 && closeMin >= 0) {
    if (closeMin >= openMin) {
      isOpen = nowMin >= openMin && nowMin < closeMin;
    } else {
      isOpen = nowMin >= openMin || nowMin < closeMin;
    }
  }
  return {
    open: isOpen,
    label: isOpen ? 'Open now' : 'Closed',
    todayOpen: entryOpen,
    todayClose: entryClose
  };
}

/**
 * Renders the Home page as static semantic HTML.
 * @param badge the computed open status.
 * @param highlights today's fresh-bake highlights.
 * @param story the short story block.
 * @returns the Home page HTML.
 */
// req-1
// req-2
function renderHome(badge: OpenStatus, highlights: MenuItem[], story: string): string {
  const badgeClass: string = badge && badge.open ? 'badge badge-open' : 'badge badge-closed';
  const badgeText: string = badge && badge.label ? badge.label : 'Closed';
  const badgeHours: string = badge && badge.todayOpen ? 'Today ' + escapeHtml(badge.todayOpen) + '\u2013' + escapeHtml(badge.todayClose) : '';
  const highlightItems: string = Array.isArray(highlights)
    ? highlights.map(function (item: MenuItem): string {
        return '<li class="highlight"><span class="highlight-name">' + escapeHtml(item.name) + '</span><span class="highlight-price">' + formatGbp(item.priceGbp) + '</span><p class="highlight-desc">' + escapeHtml(item.description) + '</p></li>';
      }).join('')
    : '';
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Golden Crust Bakery</title>',
    '</head>',
    '<body>',
    '<header><h1>Golden Crust Bakery</h1><nav aria-label="Main"><ul><li><a href="/">Home</a></li><li><a href="/menu">Menu</a></li><li><a href="/hours">Hours &amp; Location</a></li><li><a href="/order">Order</a></li><li><a href="/contact">Contact</a></li></ul></nav></header>',
    '<main>',
    '<section class="hero" aria-labelledby="hero-heading">',
    '<h2 id="hero-heading">Fresh from the oven</h2>',
    '<p class="badge ' + badgeClass + '" role="status">' + escapeHtml(badgeText) + '</p>',
    '<p class="badge-hours">' + badgeHours + '</p>',
    '<ul class="highlights">' + highlightItems + '</ul>',
    '</section>',
    '<section class="story" aria-labelledby="story-heading">',
    '<h2 id="story-heading">Our story</h2>',
    '<p>' + escapeHtml(story || '') + '</p>',
    '</section>',
    '</main>',
    '<footer><p>Golden Crust Bakery</p></footer>',
    '</body>',
    '</html>'
  ].join('');
}

/**
 * Returns the full static menu catalogue grouped by category order.
 * @returns all menu items in category order.
 */
// req-4
function getMenuItems(): MenuItem[] {
  return [
    { name: 'Sourdough Loaf', description: 'Naturally leavened, crisp crust, soft crumb.', priceGbp: 4.50, category: 'Breads', allergens: ['gluten'] },
    { name: 'Wholemeal Bloomer', description: 'Stoneground wholemeal, seeded top.', priceGbp: 3.80, category: 'Breads', allergens: ['gluten'] },
    { name: 'Seeded Rye', description: 'Dense rye loaf with sunflower and poppy seeds.', priceGbp: 4.90, category: 'Breads', allergens: ['gluten', 'nuts'] },
    { name: 'Butter Croissant', description: 'Laminated overnight, all-butter.', priceGbp: 2.60, category: 'Pastries', allergens: ['gluten', 'dairy', 'egg'] },
    { name: 'Pain au Chocolat', description: 'Buttery pastry with dark chocolate batons.', priceGbp: 2.90, category: 'Pastries', allergens: ['gluten', 'dairy', 'egg'] },
    { name: 'Vegan Cinnamon Bun', description: 'Soft spiced swirl, no animal ingredients.', priceGbp: 3.10, category: 'Pastries', allergens: ['gluten', 'vegan'] },
    { name: 'Celebration Sponge', description: 'Vanilla sponge with jam and buttercream.', priceGbp: 28.00, category: 'Cakes', allergens: ['gluten', 'dairy', 'egg'] },
    { name: 'Chocolate Fudge Cake', description: 'Rich chocolate layers with fudge frosting.', priceGbp: 32.00, category: 'Cakes', allergens: ['gluten', 'dairy', 'egg', 'nuts'] },
    { name: 'Vegan Lemon Drizzle', description: 'Zesty lemon loaf, entirely plant based.', priceGbp: 26.00, category: 'Cakes', allergens: ['gluten', 'vegan'] },
    { name: 'Filter Coffee', description: 'Locally roasted single origin.', priceGbp: 2.40, category: 'Drinks', allergens: [] },
    { name: 'Loose Leaf Tea', description: 'English breakfast or peppermint.', priceGbp: 2.20, category: 'Drinks', allergens: [] },
    { name: 'Oat Flat White', description: 'Espresso with steamed oat milk.', priceGbp: 3.20, category: 'Drinks', allergens: [] }
  ];
}

/**
 * Filters menu items with AND semantics over category, dietary tag and free-text query.
 * @param items the menu items to filter.
 * @param filters the category, tag and query filters.
 * @returns the matching items or an empty array.
 */
// req-5
function filterMenu(items: MenuItem[], filters: MenuFilters): MenuItem[] {
  const list: MenuItem[] = Array.isArray(items) ? items : [];
  const category: string = filters && typeof filters.category === 'string' ? filters.category : '';
  const tag: string = filters && typeof filters.tag === 'string' ? filters.tag : '';
  const query: string = filters && typeof filters.query === 'string' ? filters.query : '';
  const normalQuery: string = query.trim().toLowerCase();
  const validTags: string[] = ['gluten', 'dairy', 'nuts', 'egg', 'vegan'];
  const validCategories: string[] = ['Breads', 'Pastries', 'Cakes', 'Drinks'];
  const useTag: boolean = tag !== '' && validTags.indexOf(tag) !== -1;
  const useCategory: boolean = category !== '' && validCategories.indexOf(category) !== -1;
  return list.filter(function (item: MenuItem): boolean {
    if (useCategory && item.category !== category) {
      return false;
    }
    if (useTag && (!Array.isArray(item.allergens) || item.allergens.indexOf(tag) === -1)) {
      return false;
    }
    if (normalQuery !== '') {
      const haystack: string = (String(item.name) + ' ' + String(item.description)).toLowerCase();
      if (haystack.indexOf(normalQuery) === -1) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Renders the Menu page as static semantic HTML with grouped items and an empty state.
 * @param items the menu items to render.
 * @param filters the active filters used for the caption.
 * @returns the Menu page HTML.
 */
// req-1
// req-5
// req-6
function renderMenu(items: MenuItem[], filters: MenuFilters): string {
  const list: MenuItem[] = Array.isArray(items) ? items : [];
  const order: string[] = ['Breads', 'Pastries', 'Cakes', 'Drinks'];
  const groups: string[] = [];
  for (let i = 0; i < order.length; i = i + 1) {
    const category: string = order[i];
    const inGroup: MenuItem[] = list.filter(function (item: MenuItem): boolean {
      return item.category === category;
    });
    if (inGroup.length === 0) {
      continue;
    }
    const rows: string = inGroup.map(function (item: MenuItem): string {
      const tags: string = Array.isArray(item.allergens) && item.allergens.length > 0
        ? ' <span class="allergens">(' + item.allergens.map(function (t: string): string { return escapeHtml(t); }).join(', ') + ')</span>'
        : '';
      return '<li class="menu-item"><span class="menu-name">' + escapeHtml(item.name) + '</span> <span class="menu-price">' + formatGbp(item.priceGbp) + '</span><p class="menu-desc">' + escapeHtml(item.description) + '</p>' + tags + '</li>';
    }).join('');
    groups.push('<section aria-labelledby="cat-' + escapeHtml(category) + '"><h2 id="cat-' + escapeHtml(category) + '">' + escapeHtml(category) + '</h2><ul>' + rows + '</ul></section>');
  }
  const activeQuery: string = filters && typeof filters.query === 'string' ? filters.query : '';
  let body: string = '';
  if (groups.length === 0) {
    body = '<p class="empty-state" role="status">No items match your filters yet. Try clearing the search or choosing another category.</p>';
  } else {
    body = groups.join('');
  }
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Menu \u2014 Golden Crust Bakery</title>',
    '</head>',
    '<body>',
    '<header><h1>Menu</h1><nav aria-label="Main"><ul><li><a href="/">Home</a></li><li><a href="/menu">Menu</a></li><li><a href="/hours">Hours &amp; Location</a></li><li><a href="/order">Order</a></li><li><a href="/contact">Contact</a></li></ul></nav></header>',
    '<main>',
    '<p class="filter-summary">Showing results for: ' + escapeHtml(filters && filters.category ? filters.category : 'All categories') + ', ' + escapeHtml(filters && filters.tag ? filters.tag : 'All diets') + (activeQuery ? ', \u201c' + escapeHtml(activeQuery) + '\u201d' : '') + '</p>',
    body,
    '</main>',
    '<footer><p>Golden Crust Bakery</p></footer>',
    '</body>',
    '</html>'
  ].join('');
}

/**
 * Renders the Hours & Location page from the shared hours table and closures.
 * @param hours the shared weekly hours table.
 * @param closures the holiday closures.
 * @param mapImage the static map image with alt text.
 * @param directionsUrl the Get directions link target.
 * @returns the Hours & Location page HTML.
 */
// req-1
// req-3
// req-9
function renderHoursPage(hours: WeeklyHours, closures: HolidayClosure[], mapImage: { src: string; alt: string }, directionsUrl: string): string {
  const days: { day: string; open: string; close: string }[] = hours && Array.isArray(hours.days) ? hours.days : [];
  const rows: string = days.map(function (d: { day: string; open: string; close: string }): string {
    const openText: string = d.open ? escapeHtml(d.open) : 'Closed';
    const closeText: string = d.close ? escapeHtml(d.close) : 'Closed';
    return '<tr><th scope="row">' + escapeHtml(d.day) + '</th><td>' + openText + '</td><td>' + closeText + '</td></tr>';
  }).join('');
  const closureItems: string = Array.isArray(closures) && closures.length > 0
    ? closures.map(function (c: HolidayClosure): string {
        return '<li>' + escapeHtml(c.name) + ' \u2014 ' + escapeHtml(c.date) + '</li>';
      }).join('')
    : '<li>No holiday closures scheduled.</li>';
  const safeSrc: string = mapImage && typeof mapImage.src === 'string' ? escapeHtml(mapImage.src) : '';
  const safeAlt: string = mapImage && typeof mapImage.alt === 'string' ? escapeHtml(mapImage.alt) : 'Static map of Golden Crust Bakery';
  const safeDirections: string = typeof directionsUrl === 'string' ? escapeHtml(directionsUrl) : '#';
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Hours &amp; Location \u2014 Golden Crust Bakery</title>',
    '</head>',
    '<body>',
    '<header><h1>Hours &amp; Location</h1><nav aria-label="Main"><ul><li><a href="/">Home</a></li><li><a href="/menu">Menu</a></li><li><a href="/hours">Hours &amp; Location</a></li><li><a href="/order">Order</a></li><li><a href="/contact">Contact</a></li></ul></nav></header>',
    '<main>',
    '<section aria-labelledby="hours-heading">',
    '<h2 id="hours-heading">Opening hours</h2>',
    '<table><caption>Weekly opening hours</caption><thead><tr><th scope="col">Day</th><th scope="col">Opens</th><th scope="col">Closes</th></tr></thead><tbody>' + rows + '</tbody></table>',
    '</section>',
    '<section aria-labelledby="closures-heading">',
    '<h2 id="closures-heading">Holiday closures</h2>',
    '<ul>' + closureItems + '</ul>',
    '</section>',
    '<section aria-labelledby="map-heading">',
    '<h2 id="map-heading">Find us</h2>',
    '<img src="' + safeSrc + '" alt="' + safeAlt + '" width="600" height="400">',
    '<p><a href="' + safeDirections + '">Get directions</a></p>',
    '</section>',
    '</main>',
    '<footer><p>Golden Crust Bakery</p></footer>',
    '</body>',
    '</html>'
  ].join('');
}
export { renderHome, computeOpenStatus, getWeeklyHours, getHolidayClosures, renderHoursPage, getMenuItems, filterMenu, renderMenu };

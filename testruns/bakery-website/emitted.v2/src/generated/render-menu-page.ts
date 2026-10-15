import { computeOpenStatus, getTodayHighlights } from "./compute-open-status.ts";
import { renderOpenBadge, filterMenuItems, groupMenuByCategory, formatGBP, computeOrderTotal, validateOrder, generateOrderReference, submitOrder } from "./render-open-badge.ts";
type Category = 'Breads' | 'Pastries' | 'Cakes' | 'Drinks';

type AllergenTag = 'gluten' | 'dairy' | 'nuts' | 'egg' | 'vegan';

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  allergens: AllergenTag[];
};

type OpeningHoursTable = Record<string, { open: string; close: string } | null>;

interface ContactDetails {
  phone: string;
  email: string;
  address: string;
  socialLinks: string[];
  faq: { question: string; answer: string }[];
}

/**
 * Escape a string for safe interpolation into HTML text and attribute contexts.
 *
 * @param value - the raw text to escape
 * @returns the escaped text safe for HTML output
 */
function escapeHtmlText(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format a numeric amount as GBP with exactly two decimals.
 *
 * @param amount - the numeric amount in pounds
 * @returns a string such as "3.50" prefixed by the pound sign
 */
function formatMenuGBP(amount: number): string {
  const safe = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  return '£' + safe.toFixed(2);
}

/**
 * Compute the line total for a unit price and quantity, returning a figure
 * only when the quantity exceeds one.
 *
 * @param unitPrice - the price of a single item in pounds
 * @param quantity - the number of items ordered
 * @returns the computed total in pounds, or null when no total line is shown
 */
function computeMenuLineTotal(unitPrice: number, quantity: number): number | null {
  if (typeof quantity !== 'number' || quantity <= 1) {
    return null;
  }
  return unitPrice * quantity;
}

/**
 * Render the menu page with items grouped by category and full static markup
 * so the content is readable without JavaScript.
 *
 * // req-3 // req-4 // req-11
 *
 * @param items - the menu items to display
 * @returns the complete menu page HTML
 */
function renderMenuPage(items: MenuItem[]): string {
  const list: MenuItem[] = Array.isArray(items) ? items : [];
  const categories: Category[] = ['Breads', 'Pastries', 'Cakes', 'Drinks'];
  let groupedMarkup = '';
  let totalRendered = 0;

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const inCategory: MenuItem[] = [];
    for (let j = 0; j < list.length; j++) {
      const item = list[j];
      if (item && item.category === category) {
        inCategory.push(item);
      }
    }
    if (inCategory.length > 0) {
      totalRendered += inCategory.length;
      let itemMarkup = '';
      for (let k = 0; k < inCategory.length; k++) {
        const item = inCategory[k];
        const tagMarkup = item.allergens
          .map(function (tag: AllergenTag): string {
            return '<li>' + escapeHtmlText(tag) + '</li>';
          })
          .join('');
        itemMarkup +=
          '<li class="menu-item">' +
          '<h3>' + escapeHtmlText(item.name) + '</h3>' +
          '<p>' + escapeHtmlText(item.description) + '</p>' +
          '<p class="price">' + formatMenuGBP(item.price) + '</p>' +
          '<ul class="allergens">' + tagMarkup + '</ul>' +
          '</li>';
      }
      groupedMarkup +=
        '<section class="menu-category">' +
        '<h2>' + escapeHtmlText(category) + '</h2>' +
        '<ul class="menu-list">' + itemMarkup + '</ul>' +
        '</section>';
    }
  }

  let body: string;
  if (totalRendered === 0) {
    body =
      '<p class="empty-state">No items match your filters right now - try clearing the category, dietary tag or search box.</p>';
  } else {
    body = groupedMarkup;
  }

  return (
    '<main class="page page-menu">' +
    '<h1>Our Menu</h1>' +
    '<form class="menu-filters" role="search">' +
    '<label for="menu-category">Category</label>' +
    '<select id="menu-category" name="category">' +
    '<option value="">All categories</option>' +
    '<option value="Breads">Breads</option>' +
    '<option value="Pastries">Pastries</option>' +
    '<option value="Cakes">Cakes</option>' +
    '<option value="Drinks">Drinks</option>' +
    '</select>' +
    '<label for="menu-tag">Dietary tag</label>' +
    '<select id="menu-tag" name="tag">' +
    '<option value="">All dietary tags</option>' +
    '<option value="gluten">gluten</option>' +
    '<option value="dairy">dairy</option>' +
    '<option value="nuts">nuts</option>' +
    '<option value="egg">egg</option>' +
    '<option value="vegan">vegan</option>' +
    '</select>' +
    '<label for="menu-search">Search</label>' +
    '<input id="menu-search" name="q" type="search" placeholder="sourdough, croissant, cake" />' +
    '</form>' +
    body +
    '</main>'
  );
}

/**
 * Render the Hours & Location page from the shared opening hours table so the
 * weekly table, holiday closures, map image and directions link are readable
 * without JavaScript.
 *
 * // req-5 // req-8 // req-11
 *
 * @param hours - the shared weekly opening hours table
 * @returns the complete hours and location page HTML
 */
function renderHoursPage(hours: OpeningHoursTable): string {
  const table: OpeningHoursTable = hours && typeof hours === 'object' ? hours : {};
  const dayKeys: string[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  let rows = '';
  for (let i = 0; i < dayKeys.length; i++) {
    const key = dayKeys[i];
    const entry = table[key];
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    let value: string;
    if (entry && typeof entry.open === 'string' && typeof entry.close === 'string') {
      value = escapeHtmlText(entry.open) + ' – ' + escapeHtmlText(entry.close);
    } else {
      value = 'Closed';
    }
    rows +=
      '<tr><th scope="row">' + escapeHtmlText(label) + '</th><td>' + value + '</td></tr>';
  }

  const closures = ['1 January', '25 December', '26 December'];
  let closureList = '';
  for (let c = 0; c < closures.length; c++) {
    closureList += '<li>' + escapeHtmlText(closures[c]) + '</li>';
  }

  return (
    '<main class="page page-hours">' +
    '<h1>Hours &amp; Location</h1>' +
    '<table class="hours-table">' +
    '<caption>Weekly opening hours</caption>' +
    '<thead><tr><th scope="col">Day</th><th scope="col">Hours</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '<section class="holiday-closures">' +
    '<h2>Holiday closures</h2>' +
    '<ul>' + closureList + '</ul>' +
    '</section>' +
    '<section class="location">' +
    '<h2>Find us</h2>' +
    '<img src="/images/golden-crust-map.png" alt="Street map showing Golden Crust Bakery on Mill Lane" width="600" height="400" />' +
    '<p><a href="https://www.openstreetmap.org/directions?to=12%20Mill%20Lane" rel="noopener noreferrer">Get directions</a></p>' +
    '</section>' +
    '</main>'
  );
}

/**
 * Render the Contact page with phone, email, address, social links and a short
 * FAQ, fully understandable without JavaScript.
 *
 * // req-1 // req-11
 *
 * @param details - the static contact details and FAQ entries
 * @returns the complete contact page HTML
 */
function renderContactPage(details: ContactDetails): string {
  const phone = details && typeof details.phone === 'string' ? details.phone : '';
  const email = details && typeof details.email === 'string' ? details.email : '';
  const address = details && typeof details.address === 'string' ? details.address : '';
  const socialLinks =
    details && Array.isArray(details.socialLinks) ? details.socialLinks : [];
  const faq = details && Array.isArray(details.faq) ? details.faq : [];

  let socialMarkup = '';
  for (let i = 0; i < socialLinks.length; i++) {
    const link = socialLinks[i];
    socialMarkup +=
      '<li><a href="' + escapeHtmlText(link) + '" rel="noopener noreferrer">' +
      escapeHtmlText(link) +
      '</a></li>';
  }

  let faqMarkup = '';
  for (let f = 0; f < faq.length; f++) {
    const entry = faq[f];
    faqMarkup +=
      '<dt>' + escapeHtmlText(entry.question) + '</dt>' +
      '<dd>' + escapeHtmlText(entry.answer) + '</dd>';
  }

  return (
    '<main class="page page-contact">' +
    '<h1>Contact Golden Crust</h1>' +
    '<section class="contact-details">' +
    '<h2>Get in touch</h2>' +
    '<ul>' +
    '<li>Phone: <a href="tel:' + escapeHtmlText(phone) + '">' + escapeHtmlText(phone) + '</a></li>' +
    '<li>Email: <a href="mailto:' + escapeHtmlText(email) + '">' + escapeHtmlText(email) + '</a></li>' +
    '<li>Address: <address>' + escapeHtmlText(address) + '</address></li>' +
    '</ul>' +
    '<ul class="social-links">' + socialMarkup + '</ul>' +
    '</section>' +
    '<section class="faq">' +
    '<h2>Frequently asked questions</h2>' +
    '<dl>' + faqMarkup + '</dl>' +
    '</section>' +
    '</main>'
  );
}

/**
 * Render the order enquiry form with every field, an accessible error container
 * per field and a confirmation region announced to screen readers.
 *
 * // req-6 // req-10 // req-11
 *
 * @returns the complete order form HTML
 */
function renderOrderForm(): string {
  return (
    '<main class="page page-order">' +
    '<h1>Order a celebration cake or catering box</h1>' +
    '<form class="order-form" novalidate>' +
    '<div class="field">' +
    '<label for="order-name">Name</label>' +
    '<input id="order-name" name="name" type="text" autocomplete="name" aria-describedby="order-name-error" />' +
    '<p id="order-name-error" class="field-error" role="alert" aria-live="assertive"></p>' +
    '</div>' +
    '<div class="field">' +
    '<label for="order-phone">Phone</label>' +
    '<input id="order-phone" name="phone" type="tel" autocomplete="tel" aria-describedby="order-phone-error" />' +
    '<p id="order-phone-error" class="field-error" role="alert" aria-live="assertive"></p>' +
    '</div>' +
    '<div class="field">' +
    '<label for="order-email">Email</label>' +
    '<input id="order-email" name="email" type="email" autocomplete="email" aria-describedby="order-email-error" />' +
    '<p id="order-email-error" class="field-error" role="alert" aria-live="assertive"></p>' +
    '</div>' +
    '<div class="field">' +
    '<label for="order-pickup-date">Pickup date</label>' +
    '<input id="order-pickup-date" name="pickupDate" type="date" aria-describedby="order-pickup-date-error" />' +
    '<p id="order-pickup-date-error" class="field-error" role="alert" aria-live="assertive"></p>' +
    '</div>' +
    '<div class="field">' +
    '<label for="order-product">Product</label>' +
    '<input id="order-product" name="product" type="text" aria-describedby="order-product-error" />' +
    '<p id="order-product-error" class="field-error" role="alert" aria-live="assertive"></p>' +
    '</div>' +
    '<div class="field">' +
    '<label for="order-quantity">Quantity</label>' +
    '<input id="order-quantity" name="quantity" type="number" min="1" aria-describedby="order-quantity-error" />' +
    '<p id="order-quantity-error" class="field-error" role="alert" aria-live="assertive"></p>' +
    '</div>' +
    '<div class="field">' +
    '<label for="order-notes">Notes</label>' +
    '<textarea id="order-notes" name="notes" aria-describedby="order-notes-error"></textarea>' +
    '<p id="order-notes-error" class="field-error" role="alert" aria-live="assertive"></p>' +
    '</div>' +
    '<button type="submit">Send order enquiry</button>' +
    '</form>' +
    '<section id="order-confirmation" class="order-confirmation" role="status" aria-live="polite"></section>' +
    '</main>'
  );
}
export { renderMenuPage, renderHoursPage, renderContactPage, renderOrderForm };

import { renderHome, computeOpenStatus, getWeeklyHours, getHolidayClosures, renderHoursPage, getMenuItems, filterMenu, renderMenu } from "./render-home.ts";
type AllergenTag = 'gluten' | 'dairy' | 'nuts' | 'egg' | 'vegan';

type MenuCategory = 'Breads' | 'Pastries' | 'Cakes' | 'Drinks';

interface OrderInput {
  name: string;
  phone: string;
  email: string;
  pickupDate: string;
  product: string;
  quantity: number | string;
  notes: string;
}

interface FieldError {
  field: string;
  message: string;
  inputId: string;
  describedBy: string;
  announce: string;
}

interface OrderValidationResult {
  valid: boolean;
  errors: FieldError[];
}

interface Order {
  name: string;
  phone: string;
  email: string;
  pickupDate: string;
  product: string;
  quantity: number;
  notes: string;
  contactMethod: string;
}

interface OrderResult {
  ok: boolean;
  reference: string;
  order: Order | null;
  errors: FieldError[];
  message: string;
}

interface ContactInfo {
  phone: string;
  email: string;
  address: string;
  socialLinks: { label: string; url: string }[];
}

interface FAQEntry {
  question: string;
  answer: string;
}

/**
 * Escape HTML special characters so user-supplied text can be echoed safely.
 */
function escapeHtml(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charAt(i);
    if (ch === '&') {
      out += '&amp;';
    } else if (ch === '<') {
      out += '&lt;';
    } else if (ch === '>') {
      out += '&gt;';
    } else if (ch === '"') {
      out += '&quot;';
    } else if (ch === "'") {
      out += '&#39;';
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Format a numeric amount in GBP with exactly two decimals.
 * @param amount - the monetary amount in pounds
 * @returns the amount formatted as a GBP string with two decimals
 */
// req-6
function formatGbp(amount: number): string {
  if (typeof amount !== 'number' || !isFinite(amount)) {
    return '£0.00';
  }
  const rounded = Math.round(amount * 100) / 100;
  return '£' + rounded.toFixed(2);
}

/**
 * Compute a line total as unit price times quantity, avoiding float drift.
 * @param unitPrice - unit price in pounds
 * @param quantity - number of units
 * @returns the line total in pounds, rounded to two decimals
 */
// req-6
function computeLineTotal(unitPrice: number, quantity: number): number {
  if (typeof unitPrice !== 'number' || !isFinite(unitPrice)) {
    return 0;
  }
  if (typeof quantity !== 'number' || !isFinite(quantity)) {
    return 0;
  }
  const raw = Math.round(unitPrice * 100) * Math.round(quantity);
  return raw / 100;
}

/**
 * Determine whether a string is non-empty after trimming.
 */
function isNonBlank(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Parse a YYYY-MM-DD date string into a Date at UTC midnight, or null when invalid.
 */
function parsePickupDate(value: string): Date | null {
  if (!isNonBlank(value)) {
    return null;
  }
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const parsed = new Date(Date.UTC(year, month, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month || parsed.getUTCDate() !== day) {
    return null;
  }
  return parsed;
}

/**
 * Format a Date as a YYYY-MM-DD string in UTC.
 */
function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const mm = month < 10 ? '0' + month : String(month);
  const dd = day < 10 ? '0' + day : String(day);
  return String(year) + '-' + mm + '-' + dd;
}

/**
 * Build a field-level error object bound to its input by id and aria-describedby.
 */
function makeFieldError(field: string, inputId: string, message: string): FieldError {
  return {
    field: field,
    message: message,
    inputId: inputId,
    describedBy: inputId + '-error',
    announce: message
  };
}

/**
 * Validate an order form submission with field-level, accessible errors.
 * @param input - the raw order form values
 * @returns an OrderValidationResult carrying valid flag and field errors
 */
// req-8
function validateOrder(input: OrderInput): OrderValidationResult {
  const errors: FieldError[] = [];
  const source: OrderInput = input || ({} as OrderInput);

  if (!isNonBlank(source.name)) {
    errors.push(makeFieldError('name', 'order-name', 'Please enter your name.'));
  }

  const hasPhone = isNonBlank(source.phone);
  const hasEmail = isNonBlank(source.email);

  if (!hasPhone && !hasEmail) {
    errors.push(makeFieldError('phone', 'order-phone', 'Please provide a phone number or an email address so we can reach you.'));
    errors.push(makeFieldError('email', 'order-email', 'Please provide a phone number or an email address so we can reach you.'));
  } else {
    if (hasEmail) {
      const email = String(source.email).trim();
      if (email.indexOf('@') < 1 || email.indexOf('@') === email.length - 1 || email.indexOf('.') < 0) {
        errors.push(makeFieldError('email', 'order-email', 'Please enter a valid email address.'));
      }
    }
  }

  const pickup = parsePickupDate(String(source.pickupDate));
  const nowTime = 0;
  void nowTime;
  if (!pickup) {
    errors.push(makeFieldError('pickupDate', 'order-pickup-date', 'Please choose a valid pickup date (YYYY-MM-DD).'));
  }

  let quantityNumber = NaN;
  const rawQuantity: unknown = source.quantity;
  if (typeof rawQuantity === 'number') {
    quantityNumber = rawQuantity;
  } else if (typeof rawQuantity === 'string' && rawQuantity.trim().length > 0) {
    quantityNumber = Number(rawQuantity.trim());
  }

  if (!isFinite(quantityNumber) || Math.floor(quantityNumber) !== quantityNumber || quantityNumber < 1) {
    errors.push(makeFieldError('quantity', 'order-quantity', 'Please enter a whole quantity of 1 or more.'));
  }

  if (!isNonBlank(source.product)) {
    errors.push(makeFieldError('product', 'order-product', 'Please choose a product.'));
  }

  return { valid: errors.length === 0, errors: errors };
}

/**
 * Generate a human-readable order reference of the form GC-YYYY-NNNN.
 * @param now - the current instant used to derive the year
 * @param sequence - the per-year sequence number
 * @returns the formatted order reference
 */
// req-7
function generateOrderReference(now: Date, sequence: number): string {
  let year = 1970;
  if (now instanceof Date && isFinite(now.getTime())) {
    year = now.getFullYear();
  }
  let seq = 0;
  if (typeof sequence === 'number' && isFinite(sequence)) {
    seq = Math.floor(sequence);
  }
  if (seq < 0) {
    seq = 0;
  }
  const padded = seq < 1000 ? ('000' + seq).slice(-4) : String(seq);
  return 'GC-' + String(year) + '-' + padded;
}

/**
 * Validate and accept an order submission, generating a reference client-side.
 * @param input - the raw order form values
 * @param now - the current instant for date checks and reference year
 * @returns an OrderResult with reference and echoed order on success
 */
// req-7
// req-8
function submitOrder(input: OrderInput, now: Date): OrderResult {
  const current: Date = now instanceof Date && isFinite(now.getTime()) ? now : new Date(0);
  const validation = validateOrder(input);

  const source: OrderInput = input || ({} as OrderInput);
  const pickup = parsePickupDate(String(source.pickupDate));
  const errors: FieldError[] = validation.errors.slice();

  if (pickup) {
    const earliest = current.getTime() + 48 * 60 * 60 * 1000;
    if (pickup.getTime() < earliest) {
      const minDate = formatIsoDate(new Date(earliest));
      errors.push(makeFieldError('pickupDate', 'order-pickup-date', 'Pickup must be at least 48 hours ahead. The earliest available date is ' + minDate + '.'));
    }
  }

  if (errors.length > 0) {
    return { ok: false, reference: '', order: null, errors: errors, message: 'Please correct the highlighted fields.' };
  }

  const quantityNumber = typeof source.quantity === 'number' ? source.quantity : Number(String(source.quantity).trim());
  const contactMethod = isNonBlank(source.phone) ? 'phone' : 'email';
  const order: Order = {
    name: String(source.name).trim(),
    phone: isNonBlank(source.phone) ? String(source.phone).trim() : '',
    email: isNonBlank(source.email) ? String(source.email).trim() : '',
    pickupDate: String(source.pickupDate).trim(),
    product: String(source.product).trim(),
    quantity: quantityNumber,
    notes: isNonBlank(source.notes) ? String(source.notes) : '',
    contactMethod: contactMethod
  };

  const startOfYear = new Date(current.getFullYear(), 0, 1).getTime();
  const sequence = Math.floor((current.getTime() - startOfYear) / 1000) % 10000;
  const reference = generateOrderReference(current, sequence);

  return { ok: true, reference: reference, order: order, errors: [], message: 'Thank you! Your order enquiry has been received.' };
}

/**
 * Render the order confirmation echoing every submitted field plus the reference.
 * @param order - the accepted order
 * @param reference - the generated order reference
 * @returns semantic HTML for the confirmation block
 */
// req-7
function renderOrderConfirmation(order: Order, reference: string): string {
  const parts: string[] = [];
  parts.push('<section class="order-confirmation" aria-live="polite">');
  parts.push('<h2>Order confirmation</h2>');
  parts.push('<p>Your order enquiry has been received. This reference is generated in your browser only and is not stored on a server.</p>');
  parts.push('<p class="order-reference">Order reference: <strong>' + escapeHtml(reference) + '</strong></p>');
  parts.push('<dl class="order-echo">');
  parts.push('<dt>Name</dt><dd>' + escapeHtml(order.name) + '</dd>');
  parts.push('<dt>Phone</dt><dd>' + escapeHtml(order.phone.length > 0 ? order.phone : 'Not provided') + '</dd>');
  parts.push('<dt>Email</dt><dd>' + escapeHtml(order.email.length > 0 ? order.email : 'Not provided') + '</dd>');
  parts.push('<dt>Pickup date</dt><dd>' + escapeHtml(order.pickupDate) + '</dd>');
  parts.push('<dt>Product</dt><dd>' + escapeHtml(order.product) + '</dd>');
  parts.push('<dt>Quantity</dt><dd>' + escapeHtml(String(order.quantity)) + '</dd>');
  parts.push('<dt>Notes</dt><dd>' + escapeHtml(order.notes.length > 0 ? order.notes : 'None') + '</dd>');
  parts.push('</dl>');
  parts.push('</section>');
  return parts.join('');
}

/**
 * Render the static Contact page with phone, email, address, social links and FAQ.
 * @param contact - the bakery contact details
 * @param faq - the short FAQ entries
 * @returns semantic HTML for the Contact page main content
 */
// req-10
function renderContactPage(contact: ContactInfo, faq: FAQEntry[]): string {
  const parts: string[] = [];
  parts.push('<h1>Contact Golden Crust Bakery</h1>');
  parts.push('<section class="contact-details" aria-labelledby="contact-heading">');
  parts.push('<h2 id="contact-heading">Get in touch</h2>');
  parts.push('<ul class="contact-list">');
  parts.push('<li>Phone: <a href="tel:' + escapeHtml(contact.phone.replace(/\s+/g, '')) + '">' + escapeHtml(contact.phone) + '</a></li>');
  parts.push('<li>Email: <a href="mailto:' + escapeHtml(contact.email) + '">' + escapeHtml(contact.email) + '</a></li>');
  parts.push('<li>Address: <address>' + escapeHtml(contact.address) + '</address></li>');
  parts.push('</ul>');
  parts.push('</section>');

  parts.push('<section class="contact-social" aria-labelledby="social-heading">');
  parts.push('<h2 id="social-heading">Follow us</h2>');
  if (Array.isArray(contact.socialLinks) && contact.socialLinks.length > 0) {
    parts.push('<ul class="social-links">');
    for (let i = 0; i < contact.socialLinks.length; i += 1) {
      const link = contact.socialLinks[i];
      parts.push('<li><a href="' + escapeHtml(link.url) + '" rel="noopener">' + escapeHtml(link.label) + '</a></li>');
    }
    parts.push('</ul>');
  } else {
    parts.push('<p>No social links available.</p>');
  }
  parts.push('</section>');

  parts.push('<section class="contact-faq" aria-labelledby="faq-heading">');
  parts.push('<h2 id="faq-heading">Frequently asked questions</h2>');
  if (Array.isArray(faq) && faq.length > 0) {
    for (let i = 0; i < faq.length; i += 1) {
      const entry = faq[i];
      parts.push('<details class="faq-entry">');
      parts.push('<summary>' + escapeHtml(entry.question) + '</summary>');
      parts.push('<p>' + escapeHtml(entry.answer) + '</p>');
      parts.push('</details>');
    }
  } else {
    parts.push('<p>No questions listed yet.</p>');
  }
  parts.push('</section>');

  return parts.join('');
}
export { formatGbp, computeLineTotal, validateOrder, submitOrder, generateOrderReference, renderOrderConfirmation, renderContactPage };

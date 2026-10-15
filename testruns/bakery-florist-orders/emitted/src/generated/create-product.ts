type ProductCategory = 'Bakery' | 'Floral';
type ProductUnit = 'each' | 'dozen' | 'bunch' | 'box';
type OrderStatus = 'Draft' | 'Confirmed' | 'Ready' | 'Fulfilled' | 'Cancelled';

type ProductInput = {
  id?: string;
  name: string;
  category: ProductCategory;
  unitPricePence: number;
  unit: ProductUnit;
  stockOnHand: number;
  reorderLevel: number;
  allergens?: string[];
  stemCount?: number;
  active?: boolean;
};

type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  unitPricePence: number;
  unit: ProductUnit;
  stockOnHand: number;
  reorderLevel: number;
  allergens: string[];
  stemCount: number | null;
  active: boolean;
};

type ProductFilter = {
  search?: string;
  category?: ProductCategory | null;
  active?: boolean | null;
};

type OrderLine = {
  id: string;
  productId: string;
  quantity: number;
  unitPricePence: number;
  lineTotalPence: number;
};

type Order = {
  id: string;
  customerId: string;
  createdAt: string;
  fulfilmentDate: string;
  status: OrderStatus;
  lines: OrderLine[];
  totalPence: number;
};

const PRODUCT_STORE: Record<string, Product> = {};
const PRODUCT_ID_ORDER: string[] = [];
const ORDER_STORE: Record<string, Order> = {};
const ORDER_ID_ORDER: string[] = [];
let PRODUCT_SEQ: number = 0;
let ORDER_SEQ: number = 0;
let LINE_SEQ: number = 0;

// req-1
/**
 * List products, supporting search by name, filtering by category and by active flag.
 * @param filter the search/category/active filter combination
 * @returns the matching products
 */
async function listProducts(filter: ProductFilter): Promise<Product[]> {
  const f: ProductFilter = filter === undefined || filter === null ? {} : filter;
  const term: string = typeof f.search === 'string' ? f.search.trim().toLowerCase() : '';
  const category: ProductCategory | null = f.category === undefined ? null : f.category;
  const active: boolean | null = f.active === undefined ? null : f.active;
  const out: Product[] = [];
  for (let i: number = 0; i < PRODUCT_ID_ORDER.length; i += 1) {
    const id: string = PRODUCT_ID_ORDER[i];
    const p: Product = PRODUCT_STORE[id];
    if (p === undefined) {
      continue;
    }
    if (term !== '' && p.name.toLowerCase().indexOf(term) === -1) {
      continue;
    }
    if (category !== null && p.category !== category) {
      continue;
    }
    if (active !== null && p.active !== active) {
      continue;
    }
    out.push(cloneProduct(p));
  }
  return out;
}

// req-2
/**
 * Create a product with the given validated input.
 * @param input the product creation input
 * @returns the created product
 */
async function createProduct(input: ProductInput): Promise<Product> {
  if (input === undefined || input === null) {
    throw new Error('validation error: missing product input');
  }
  const name: string = typeof input.name === 'string' ? input.name.trim() : '';
  if (name === '') {
    throw new Error('validation error: name is required');
  }
  const category: unknown = input.category;
  if (category !== 'Bakery' && category !== 'Floral') {
    throw new Error('validation error: category must be Bakery or Floral');
  }
  const unit: unknown = input.unit;
  if (unit !== 'each' && unit !== 'dozen' && unit !== 'bunch' && unit !== 'box') {
    throw new Error('validation error: unit must be each, dozen, bunch or box');
  }
  const unitPricePence: unknown = input.unitPricePence;
  if (typeof unitPricePence !== 'number' || !isInt(unitPricePence) || unitPricePence < 0) {
    throw new Error('validation error: unitPricePence must be a non-negative integer');
  }
  const stockOnHand: unknown = input.stockOnHand;
  if (typeof stockOnHand !== 'number' || !isInt(stockOnHand) || stockOnHand < 0) {
    throw new Error('validation error: stockOnHand must be a non-negative integer');
  }
  const reorderLevel: unknown = input.reorderLevel;
  if (typeof reorderLevel !== 'number' || !isInt(reorderLevel) || reorderLevel < 0) {
    throw new Error('validation error: reorderLevel must be a non-negative integer');
  }
  let allergens: string[] = [];
  let stemCount: number | null = null;
  if (category === 'Bakery') {
    const rawAllergens: unknown = input.allergens;
    if (typeof rawAllergens !== 'object' || rawAllergens === null || !isArrayOfStrings(rawAllergens)) {
      throw new Error('validation error: allergens is required for Bakery');
    }
    allergens = (rawAllergens as string[]).slice();
    stemCount = null;
  } else {
    const rawStem: unknown = input.stemCount;
    if (typeof rawStem !== 'number' || !isInt(rawStem) || rawStem <= 0) {
      throw new Error('validation error: stemCount is required for Floral');
    }
    stemCount = rawStem;
    allergens = [];
  }
  PRODUCT_SEQ += 1;
  const id: string = typeof input.id === 'string' && input.id.trim() !== '' ? input.id.trim() : 'product-' + String(PRODUCT_SEQ);
  if (PRODUCT_STORE[id] !== undefined) {
    throw new Error('validation error: product id already exists');
  }
  const product: Product = {
    id: id,
    name: name,
    category: category,
    unitPricePence: unitPricePence,
    unit: unit,
    stockOnHand: stockOnHand,
    reorderLevel: reorderLevel,
    allergens: allergens,
    stemCount: stemCount,
    active: input.active === undefined ? true : input.active === true
  };
  PRODUCT_STORE[id] = product;
  PRODUCT_ID_ORDER.push(id);
  return cloneProduct(product);
}

// req-2
/**
 * Edit an existing product, preserving id and category-specific validation.
 * @param id the product id
 * @param changes the partial changes to apply
 * @returns the updated product
 */
async function editProduct(id: string, changes: Partial<ProductInput>): Promise<Product> {
  const existing: Product = PRODUCT_STORE[id];
  if (existing === undefined) {
    throw new Error('not-found error: unknown product id ' + String(id));
  }
  if (changes === undefined || changes === null) {
    throw new Error('validation error: missing changes');
  }
  const next: Product = cloneProduct(existing);
  if (changes.name !== undefined) {
    const name: string = typeof changes.name === 'string' ? changes.name.trim() : '';
    if (name === '') {
      throw new Error('validation error: name is required');
    }
    next.name = name;
  }
  if (changes.category !== undefined) {
    const category: unknown = changes.category;
    if (category !== 'Bakery' && category !== 'Floral') {
      throw new Error('validation error: category must be Bakery or Floral');
    }
    next.category = category;
  }
  if (changes.unit !== undefined) {
    const unit: unknown = changes.unit;
    if (unit !== 'each' && unit !== 'dozen' && unit !== 'bunch' && unit !== 'box') {
      throw new Error('validation error: unit must be each, dozen, bunch or box');
    }
    next.unit = unit;
  }
  if (changes.unitPricePence !== undefined) {
    const price: unknown = changes.unitPricePence;
    if (typeof price !== 'number' || !isInt(price) || price < 0) {
      throw new Error('validation error: unitPricePence must be a non-negative integer');
    }
    next.unitPricePence = price;
  }
  if (changes.stockOnHand !== undefined) {
    const stock: unknown = changes.stockOnHand;
    if (typeof stock !== 'number' || !isInt(stock) || stock < 0) {
      throw new Error('validation error: stockOnHand must be a non-negative integer');
    }
    next.stockOnHand = stock;
  }
  if (changes.reorderLevel !== undefined) {
    const level: unknown = changes.reorderLevel;
    if (typeof level !== 'number' || !isInt(level) || level < 0) {
      throw new Error('validation error: reorderLevel must be a non-negative integer');
    }
    next.reorderLevel = level;
  }
  if (next.category === 'Bakery') {
    if (changes.allergens !== undefined) {
      const rawAllergens: unknown = changes.allergens;
      if (typeof rawAllergens !== 'object' || rawAllergens === null || !isArrayOfStrings(rawAllergens)) {
        throw new Error('validation error: allergens must be an array of strings for Bakery');
      }
      next.allergens = (rawAllergens as string[]).slice();
    } else if (next.allergens.length === 0) {
      throw new Error('validation error: allergens is required for Bakery');
    }
    next.stemCount = null;
  } else {
    if (changes.stemCount !== undefined) {
      const rawStem: unknown = changes.stemCount;
      if (typeof rawStem !== 'number' || !isInt(rawStem) || rawStem <= 0) {
        throw new Error('validation error: stemCount must be a positive integer for Floral');
      }
      next.stemCount = rawStem;
    } else if (next.stemCount === null || next.stemCount <= 0) {
      throw new Error('validation error: stemCount is required for Floral');
    }
    next.allergens = [];
  }
  if (changes.active !== undefined) {
    next.active = changes.active === true;
  }
  PRODUCT_STORE[id] = next;
  return cloneProduct(next);
}

// req-3
/**
 * Soft-deactivate a product by setting active=false; the record and its history remain.
 * @param id the product id
 * @returns the deactivated product
 */
async function deactivateProduct(id: string): Promise<Product> {
  const existing: Product = PRODUCT_STORE[id];
  if (existing === undefined) {
    throw new Error('not-found error: unknown product id ' + String(id));
  }
  const next: Product = cloneProduct(existing);
  next.active = false;
  PRODUCT_STORE[id] = next;
  return cloneProduct(next);
}

// req-3
/**
 * Reactivate a previously deactivated product.
 * @param id the product id
 * @returns the reactivated product
 */
async function reactivateProduct(id: string): Promise<Product> {
  const existing: Product = PRODUCT_STORE[id];
  if (existing === undefined) {
    throw new Error('not-found error: unknown product id ' + String(id));
  }
  const next: Product = cloneProduct(existing);
  next.active = true;
  PRODUCT_STORE[id] = next;
  return cloneProduct(next);
}

// req-4
/**
 * Create a new Draft order with an empty lines array.
 * @param customerId the customer id
 * @param fulfilmentDate the requested fulfilment date
 * @returns the created Draft order
 */
async function createOrder(customerId: string, fulfilmentDate: Date): Promise<Order> {
  if (typeof customerId !== 'string' || customerId.trim() === '') {
    throw new Error('validation error: customerId is required');
  }
  if (!(fulfilmentDate instanceof Date) || isNaN(fulfilmentDate.getTime())) {
    throw new Error('validation error: fulfilmentDate must be a valid Date');
  }
  ORDER_SEQ += 1;
  const id: string = 'order-' + String(ORDER_SEQ);
  const order: Order = {
    id: id,
    customerId: customerId.trim(),
    createdAt: new Date(0).toISOString(),
    fulfilmentDate: fulfilmentDate.toISOString(),
    status: 'Draft',
    lines: [],
    totalPence: 0
  };
  ORDER_STORE[id] = order;
  ORDER_ID_ORDER.push(id);
  return cloneOrder(order);
}

// req-4
/**
 * Add a product line to a Draft order, capturing the product's current unit price
 * and recomputing the order total from all lines.
 * @param orderId the order id
 * @param productId the product id
 * @param quantity the quantity ordered
 * @returns the updated order
 */
async function addOrderLine(orderId: string, productId: string, quantity: number): Promise<Order> {
  const order: Order = ORDER_STORE[orderId];
  if (order === undefined) {
    throw new Error('not-found error: unknown order id ' + String(orderId));
  }
  if (order.status !== 'Draft') {
    throw new Error('illegal transition: cannot add lines to a ' + order.status + ' order');
  }
  const product: Product = PRODUCT_STORE[productId];
  if (product === undefined) {
    throw new Error('not-found error: unknown product id ' + String(productId));
  }
  if (typeof quantity !== 'number' || !isInt(quantity) || quantity <= 0) {
    throw new Error('validation error: quantity must be a positive integer');
  }
  LINE_SEQ += 1;
  const line: OrderLine = {
    id: 'line-' + String(LINE_SEQ),
    productId: product.id,
    quantity: quantity,
    unitPricePence: product.unitPricePence,
    lineTotalPence: product.unitPricePence * quantity
  };
  const next: Order = cloneOrder(order);
  next.lines.push(line);
  next.totalPence = sumLineTotals(next.lines);
  ORDER_STORE[orderId] = next;
  return cloneOrder(next);
}

// req-4
/**
 * Update the quantity of an existing Draft order line, recomputing line and order totals
 * while preserving the unit price captured at line-add time.
 * @param orderId the order id
 * @param lineId the line id
 * @param quantity the new quantity
 * @returns the updated order
 */
async function updateOrderLine(orderId: string, lineId: string, quantity: number): Promise<Order> {
  const order: Order = ORDER_STORE[orderId];
  if (order === undefined) {
    throw new Error('not-found error: unknown order id ' + String(orderId));
  }
  if (order.status !== 'Draft') {
    throw new Error('illegal transition: cannot edit lines on a ' + order.status + ' order');
  }
  if (typeof quantity !== 'number' || !isInt(quantity) || quantity <= 0) {
    throw new Error('validation error: quantity must be a positive integer');
  }
  const next: Order = cloneOrder(order);
  let found: boolean = false;
  for (let i: number = 0; i < next.lines.length; i += 1) {
    if (next.lines[i].id === lineId) {
      next.lines[i].quantity = quantity;
      next.lines[i].lineTotalPence = next.lines[i].unitPricePence * quantity;
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error('not-found error: unknown line id ' + String(lineId));
  }
  next.totalPence = sumLineTotals(next.lines);
  ORDER_STORE[orderId] = next;
  return cloneOrder(next);
}

function isInt(value: number): boolean {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
}

function isArrayOfStrings(value: object): boolean {
  const arr: any = value as any;
  if (typeof arr.length !== 'number') {
    return false;
  }
  for (let i: number = 0; i < arr.length; i += 1) {
    if (typeof arr[i] !== 'string') {
      return false;
    }
  }
  return true;
}

function cloneProduct(p: Product): Product {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    unitPricePence: p.unitPricePence,
    unit: p.unit,
    stockOnHand: p.stockOnHand,
    reorderLevel: p.reorderLevel,
    allergens: p.allergens.slice(),
    stemCount: p.stemCount,
    active: p.active
  };
}

function cloneOrder(o: Order): Order {
  const lines: OrderLine[] = [];
  for (let i: number = 0; i < o.lines.length; i += 1) {
    const l: OrderLine = o.lines[i];
    lines.push({
      id: l.id,
      productId: l.productId,
      quantity: l.quantity,
      unitPricePence: l.unitPricePence,
      lineTotalPence: l.lineTotalPence
    });
  }
  return {
    id: o.id,
    customerId: o.customerId,
    createdAt: o.createdAt,
    fulfilmentDate: o.fulfilmentDate,
    status: o.status,
    lines: lines,
    totalPence: o.totalPence
  };
}

function sumLineTotals(lines: OrderLine[]): number {
  let total: number = 0;
  for (let i: number = 0; i < lines.length; i += 1) {
    total += lines[i].lineTotalPence;
  }
  return total;
}
export { createProduct, editProduct, deactivateProduct, reactivateProduct, listProducts, createOrder, addOrderLine, updateOrderLine };

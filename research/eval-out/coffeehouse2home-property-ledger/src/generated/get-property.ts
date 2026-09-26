const LEDGER = new Map();
const CONTACTS = new Map();
const BUYER_LEADS = new Map();
const SELLER_LEADS = new Map();
const DEALS = new Map();

const PIPELINE_STAGES = ['lead', 'qualified', 'showing', 'offer', 'negotiation', 'under_contract', 'closed', 'lost'];

function normalizeLedgerRecord(propertyId) {
  return LEDGER.get(propertyId) || null;
}

function ensureHistory(record) {
  if (!Array.isArray(record.history)) {
    record.history = [];
  }
  return record.history;
}

function appendHistory(propertyId, entry) {
  const record = normalizeLedgerRecord(propertyId);
  if (!record) {
    return null;
  }
  const history = ensureHistory(record);
  history.push(entry);
  return entry;
}

/**
 * Retrieve the single shared Property Ledger record for a property id.
 * @param {string} propertyId - The shared property-ledger id.
 * @returns {Promise<Object>} The ledger record for the property.
 */
// req-1
async function getProperty(propertyId) {
  if (typeof propertyId !== 'string' || propertyId.length === 0) {
    throw new Error('propertyId is required');
  }
  const record = normalizeLedgerRecord(propertyId);
  if (!record) {
    throw new Error('property not found');
  }
  return record;
}

/**
 * Update the single shared Property Ledger record, mutating it in place so all domain views see the change.
 * @param {string} propertyId - The shared property-ledger id.
 * @param {Object} changes - Partial ledger record fields to update.
 * @returns {Promise<Object>} The same mutated ledger record.
 */
// req-1
// req-11
async function updateProperty(propertyId, changes) {
  if (typeof propertyId !== 'string' || propertyId.length === 0) {
    throw new Error('propertyId is required');
  }
  const record = normalizeLedgerRecord(propertyId);
  if (!record) {
    throw new Error('property not found');
  }
  if (changes && typeof changes === 'object') {
    Object.keys(changes).forEach(function (key) {
      if (key !== 'propertyId' && key !== 'history') {
        record[key] = changes[key];
      }
    });
  }
  return record;
}

/**
 * Read the full history of a property from its shared ledger record.
 * @param {string} propertyId - The shared property-ledger id.
 * @returns {Promise<Array>} Chronological ledger history entries.
 */
// req-1
// req-10
async function getPropertyHistory(propertyId) {
  const record = await getProperty(propertyId);
  return ensureHistory(record).slice();
}

/**
 * Create a CRM contact.
 * @param {Object} contactInput - Contact fields.
 * @returns {Promise<Object>} The created contact.
 */
// req-2
async function createContact(contactInput) {
  if (!contactInput || typeof contactInput !== 'object') {
    throw new Error('contact input is required');
  }
  const contactId = String(contactInput.contactId || 'contact-' + String(CONTACTS.size + 1));
  const contact = {
    contactId: contactId,
    name: contactInput.name || '',
    email: contactInput.email || '',
    phone: contactInput.phone || ''
  };
  CONTACTS.set(contactId, contact);
  return contact;
}

/**
 * Create a CRM buyer lead referencing the shared property-ledger id.
 * @param {Object} leadInput - Buyer lead fields including propertyId.
 * @returns {Promise<Object>} The created buyer lead.
 */
// req-2
// req-9
async function createBuyerLead(leadInput) {
  if (!leadInput || typeof leadInput !== 'object') {
    throw new Error('buyer lead input is required');
  }
  if (typeof leadInput.propertyId !== 'string' || leadInput.propertyId.length === 0) {
    throw new Error('propertyId is required for a buyer lead');
  }
  const record = normalizeLedgerRecord(leadInput.propertyId);
  if (!record) {
    throw new Error('property not found');
  }
  const leadId = String(leadInput.leadId || 'buyer-lead-' + String(BUYER_LEADS.size + 1));
  const lead = {
    leadId: leadId,
    contactId: leadInput.contactId || null,
    buyerEmail: leadInput.buyerEmail || '',
    propertyId: leadInput.propertyId,
    createdAt: leadInput.createdAt || null
  };
  BUYER_LEADS.set(leadId, lead);
  appendHistory(leadInput.propertyId, {
    type: 'buyer_lead',
    leadId: leadId,
    propertyId: leadInput.propertyId,
    createdAt: lead.createdAt
  });
  return lead;
}

/**
 * Create a CRM seller lead referencing the shared property-ledger id.
 * @param {Object} leadInput - Seller lead fields including propertyId.
 * @returns {Promise<Object>} The created seller lead.
 */
// req-2
async function createSellerLead(leadInput) {
  if (!leadInput || typeof leadInput !== 'object') {
    throw new Error('seller lead input is required');
  }
  if (typeof leadInput.propertyId !== 'string' || leadInput.propertyId.length === 0) {
    throw new Error('propertyId is required for a seller lead');
  }
  const record = normalizeLedgerRecord(leadInput.propertyId);
  if (!record) {
    throw new Error('property not found');
  }
  const leadId = String(leadInput.leadId || 'seller-lead-' + String(SELLER_LEADS.size + 1));
  const lead = {
    leadId: leadId,
    contactId: leadInput.contactId || null,
    sellerEmail: leadInput.sellerEmail || '',
    propertyId: leadInput.propertyId,
    createdAt: leadInput.createdAt || null
  };
  SELLER_LEADS.set(leadId, lead);
  appendHistory(leadInput.propertyId, {
    type: 'seller_lead',
    leadId: leadId,
    propertyId: leadInput.propertyId,
    createdAt: lead.createdAt
  });
  return lead;
}

/**
 * Create a deal referencing a contact and a shared property-ledger id.
 * @param {string} contactId - The CRM contact id.
 * @param {string} propertyId - The shared property-ledger id.
 * @returns {Promise<Object>} The created deal at the first pipeline stage.
 */
// req-2
// req-10
async function createDeal(contactId, propertyId) {
  if (typeof contactId !== 'string' || contactId.length === 0) {
    throw new Error('contactId is required');
  }
  if (typeof propertyId !== 'string' || propertyId.length === 0) {
    throw new Error('propertyId is required');
  }
  if (!CONTACTS.has(contactId)) {
    throw new Error('contact not found');
  }
  const record = normalizeLedgerRecord(propertyId);
  if (!record) {
    throw new Error('property not found');
  }
  const dealId = 'deal-' + String(DEALS.size + 1);
  const deal = {
    dealId: dealId,
    contactId: contactId,
    propertyId: propertyId,
    stage: PIPELINE_STAGES[0],
    stages: PIPELINE_STAGES.slice()
  };
  DEALS.set(dealId, deal);
  appendHistory(propertyId, {
    type: 'deal',
    dealId: dealId,
    propertyId: propertyId,
    stage: deal.stage
  });
  return deal;
}

/**
 * Move a deal to another stage defined in the ordered pipeline.
 * @param {string} dealId - The deal id.
 * @param {string} stage - The target pipeline stage.
 * @returns {Promise<Object>} The updated deal with its current stage.
 */
// req-2
async function moveDealStage(dealId, stage) {
  if (typeof dealId !== 'string' || dealId.length === 0) {
    throw new Error('dealId is required');
  }
  const deal = DEALS.get(dealId);
  if (!deal) {
    throw new Error('deal not found');
  }
  if (PIPELINE_STAGES.indexOf(stage) === -1) {
    throw new Error('stage not defined in pipeline');
  }
  const currentIndex = PIPELINE_STAGES.indexOf(deal.stage);
  const targetIndex = PIPELINE_STAGES.indexOf(stage);
  if (targetIndex > currentIndex + 1) {
    throw new Error('cannot skip a required stage');
  }
  deal.stage = stage;
  appendHistory(deal.propertyId, {
    type: 'deal_stage',
    dealId: deal.dealId,
    propertyId: deal.propertyId,
    stage: stage
  });
  return deal;
}

module.exports.getProperty = getProperty;
module.exports.updateProperty = updateProperty;
module.exports.getPropertyHistory = getPropertyHistory;
module.exports.createContact = createContact;
module.exports.createBuyerLead = createBuyerLead;
module.exports.createSellerLead = createSellerLead;
module.exports.createDeal = createDeal;
module.exports.moveDealStage = moveDealStage;
module.exports._internals = { LEDGER: LEDGER, CONTACTS: CONTACTS, BUYER_LEADS: BUYER_LEADS, SELLER_LEADS: SELLER_LEADS, DEALS: DEALS, PIPELINE_STAGES: PIPELINE_STAGES };
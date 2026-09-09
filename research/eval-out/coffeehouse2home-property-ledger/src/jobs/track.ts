// ---------------------------------------------------------------------------
// src/jobs/track.ts — Implement job “track” against the contract
// machine-generated from RapidTool packet 16692201-777b-4cf6-b02b-a85f02e9c6a3; regenerate, don't hand-edit.
// This file hosts the machine-verified P6 synthesis module (project.generatedSource),
// verbatim below. Its self-tests ran inside the engine isolate at P6 — keep them
// green when you implement the surrounding jobs.
// ---------------------------------------------------------------------------

(function (module, exports) {
"use strict";

/**
 * Minimal deterministic unique identifier generator.
 * Used for entity IDs.
 */
function makeId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/**
 * Simple event emitter.
 */
class EventEmitter {
  constructor() {
    this.events = {};
  }
  on(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
  }
  off(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }
  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }
}

/**
 * Shared Property Ledger with event emitter for cross-domain updates.
 * Each property is stored once, with full history.
 */
// req-1: single shared property ledger
class PropertyLedger extends EventEmitter {
  constructor() {
    super();
    this.properties = new Map();
    this.ledgerEntries = new Map(); // propertyId -> array of entries
  }

  /**
   * Get a property by ID.
   * @param {string} id - property ID
   * @returns {object|null} property object or null
   */
  getProperty(id) {
    return this.properties.get(id) || null;
  }

  /**
   * Add an entry to the property ledger history.
   * @param {string} propertyId - property ID
   * @param {any} entry - entry data
   * @returns {Promise<object>} created ledger entry
   */
  async addLedgerEntry(propertyId, entry) {
    if (!this.properties.has(propertyId)) {
      throw new Error(`Property not found: ${propertyId}`);
    }
    const ledgerEntry = {
      id: makeId(),
      propertyId,
      entry,
      createdAt: new Date().toISOString()
    };
    if (!this.ledgerEntries.has(propertyId)) {
      this.ledgerEntries.set(propertyId, []);
    }
    this.ledgerEntries.get(propertyId).push(ledgerEntry);
    // Emit event for cross-domain listeners
    this.emit('ledgerUpdate', ledgerEntry);
    return ledgerEntry;
  }

  /**
   * Register a property (used by initial setup or domains creating new properties).
   * @param {object} property - property data with id
   * @returns {object} the registered property
   */
  registerProperty(property) {
    if (!property.id) property.id = makeId();
    // Ensure full history array
    if (!this.ledgerEntries.has(property.id)) {
      this.ledgerEntries.set(property.id, []);
    }
    this.properties.set(property.id, property);
    return property;
  }

  /**
   * Get all ledger entries for a property.
   * @param {string} propertyId - property ID
   * @returns {array} array of ledger entries
   */
  getLedgerEntries(propertyId) {
    return this.ledgerEntries.get(propertyId) || [];
  }

  /**
   * Set property status, adding ledger entry.
   * @param {string} propertyId - property ID
   * @param {string} status - new status
   * @returns {Promise<object>} updated property
   */
  async setPropertyStatus(propertyId, status) {
    const property = this.getProperty(propertyId);
    if (!property) throw new Error(`Property not found: ${propertyId}`);
    const oldStatus = property.status;
    property.status = status;
    await this.addLedgerEntry(propertyId, { type: 'statusChange', oldStatus, newStatus: status });
    return property;
  }
}

/**
 * RealEstateCRM with contacts, leads, deals, pipeline.
 */
// req-2: CRM tracks contacts, leads, deals with configurable stages
class RealEstateCRM {
  constructor(ledger) {
    this.ledger = ledger;
    this.contacts = new Map(); // id -> contact
    this.contactsByEmail = new Map(); // email -> contact id
    this.leads = new Map(); // id -> lead
    this.deals = new Map(); // id -> deal
    this.dealStages = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']; // default configurable
    // Listen to ledger events to create buyer leads from showings on flip/rental properties
    this.ledger.on('ledgerUpdate', (entry) => {
      if (entry.entry && entry.entry.type === 'showingOccurred' && entry.entry.buyerEmail) {
        // Check if property is flip or rental (based on status or some marker)
        const property = this.ledger.getProperty(entry.propertyId);
        if (property && (property.status === 'Flip' || property.status === 'Rental' || property.isFlip || property.isRental)) {
          // req-13: automatically create buyer lead
          this.createBuyerLeadFromShowing(entry.propertyId, entry.entry.buyerEmail, entry.entry.showingId).catch(err => console.error(err));
        }
      }
    });
  }

  /**
   * Add a contact; ensure no duplicate email.
   * @param {object} contact - contact data
   * @returns {Promise<object>} created contact
   */
  async addContact(contact) {
    if (!contact.email) throw new Error('Contact email required');
    if (this.contactsByEmail.has(contact.email)) {
      return this.contacts.get(this.contactsByEmail.get(contact.email));
    }
    if (!contact.id) contact.id = makeId();
    this.contacts.set(contact.id, contact);
    this.contactsByEmail.set(contact.email, contact.id);
    return contact;
  }

  /**
   * Create a lead (buyer or seller).
   * @param {object} lead - lead data
   * @returns {Promise<object>} created lead
   */
  async createLead(lead) {
    if (!lead.id) lead.id = makeId();
    this.leads.set(lead.id, lead);
    // If no property reference but valid property, link
    if (lead.propertyId && this.ledger.getProperty(lead.propertyId)) {
      // add ledger entry
      await this.ledger.addLedgerEntry(lead.propertyId, { type: 'leadCreated', leadId: lead.id, leadType: lead.type, buyerEmail: lead.email });
    }
    return lead;
  }

  /**
   * Create a deal linked to a property.
   * @param {object} deal - deal data with propertyId
   * @returns {Promise<object>} created deal
   */
  async createDeal(deal) {
    if (!deal.propertyId) throw new Error('Deal must be linked to a property');
    if (!this.ledger.getProperty(deal.propertyId)) throw new Error('Property not found');
    if (!deal.id) deal.id = makeId();
    // Default stage
    if (!deal.stage) deal.stage = this.dealStages[0];
    this.deals.set(deal.id, deal);
    // Add ledger entry
    await this.ledger.addLedgerEntry(deal.propertyId, { type: 'dealCreated', dealId: deal.id, stage: deal.stage });
    return deal;
  }

  /**
   * Update deal stage.
   * @param {string} dealId - deal ID
   * @param {string} stage - new stage
   * @returns {Promise<object>} updated deal
   */
  async updateDealStage(dealId, stage) {
    const deal = this.deals.get(dealId);
    if (!deal) throw new Error('Deal not found');
    deal.stage = stage;
    await this.ledger.addLedgerEntry(deal.propertyId, { type: 'dealStageUpdated', dealId, stage });
    return deal;
  }

  /**
   * Helper to create buyer lead from showing.
   * @param {string} propertyId - property ID
   * @param {string} buyerEmail - buyer email
   * @param {string} showingId - showing ID
   */
  async createBuyerLeadFromShowing(propertyId, buyerEmail, showingId) {
    // Ensure contact exists (dedupe by email)
    const contact = await this.addContact({ email: buyerEmail });
    // Create lead if not already exists for this showing and email
    const existingLead = [...this.leads.values()].find(l => l.showingId === showingId && l.email === buyerEmail);
    if (!existingLead) {
      const lead = {
        id: makeId(),
        type: 'buyer',
        email: buyerEmail,
        propertyId: propertyId,
        showingId: showingId,
        createdAt: new Date().toISOString()
      };
      await this.createLead(lead);
      return lead;
    }
    return existingLead;
  }
}

/**
 * ShowingManager with slots, bookings, reminders, calendar sync, history.
 */
// req-3: publish showing slots, private/open houses
// req-4: buyer booking with email confirmation
// req-5: reminders at configured interval
// req-6: calendar-sync stub (ICS)
// req-7: per-property showing history with feedback
class ShowingManager {
  constructor(ledger, crm) {
    this.ledger = ledger;
    this.crm = crm;
    this.slots = new Map(); // id -> ShowingSlot (with capacity, remainingCapacity)
    this.bookings = new Map(); // id -> Booking
    this.showingHistory = new Map(); // propertyId -> array of ShowingRecord
    this.reminderIntervalMinutes = 60; // default configurable
    this.maxCapacity = 100; // default max slots per showing? not needed
    // Bookings may have email status pending if email fails
    this.emailServiceAvailable = true; // can be toggled for testing
  }

  /**
   * Publish a showing slot for a property.
   * @param {string} propertyId - property ID
   * @param {object} slot - slot data with type, startTime, locationRef, capacity, etc.
   * @returns {Promise<object>} created slot
   */
  async publishShowing(propertyId, slot) {
    // Verify property exists
    const property = this.ledger.getProperty(propertyId);
    if (!property) throw new Error('Property not found');
    if (!slot) throw new Error('Slot data required');
    if (!slot.startTime) throw new Error('Start time required');
    if (!slot.locationRef) throw new Error('Location reference required');
    if (!slot.type) slot.type = 'private'; // private or open house
    if (!slot.id) slot.id = makeId();
    // Initialize remaining capacity
    if (slot.capacity === undefined) slot.capacity = 1; // default private showing capacity 1
    slot.remainingCapacity = slot.capacity;
    slot.propertyId = propertyId;
    this.slots.set(slot.id, slot);
    await this.ledger.addLedgerEntry(propertyId, { type: 'showingSlotPublished', slotId: slot.id, startTime: slot.startTime });
    return slot;
  }

  /**
   * Book a showing slot atomically.
   * Rejects if slot passed or no capacity.
   * Persists booking even if email fails.
   * Creates buyer lead via CRM if slot property is flip/rental (after booking).
   * @param {string} slotId - slot ID
   * @param {string} buyerEmail - buyer email
   * @returns {Promise<object>} booking
   */
  async bookShowing(slotId, buyerEmail) {
    if (!buyerEmail || typeof buyerEmail !== 'string' || !buyerEmail.includes('@')) {
      throw new Error('Valid buyer email required');
    }
    const slot = this.slots.get(slotId);
    if (!slot) throw new Error('Showing slot not found');
    const now = Date.now();
    const startTime = new Date(slot.startTime).getTime();
    if (startTime <= now) throw new Error('Showing slot has already passed');
    // Atomic capacity check and decrement (using simple flag since JS single-threaded)
    if (slot.remainingCapacity <= 0) {
      throw new Error('No remaining capacity for this slot');
    }
    slot.remainingCapacity--;
    // Create booking
    const booking = {
      id: makeId(),
      slotId: slotId,
      buyerEmail: buyerEmail,
      propertyId: slot.propertyId,
      startTime: slot.startTime,
      bookedAt: new Date().toISOString(),
      emailStatus: 'pending',
      reminderStatus: 'pending',
      feedback: null
    };
    this.bookings.set(booking.id, booking);
    // Try to send confirmation; if email service fails, keep emailStatus 'pending'
    try {
      const emailResult = await this.sendConfirmation(booking);
      booking.emailStatus = emailResult.status;
    } catch (err) {
      booking.emailStatus = 'pending';
    }
    // Record in showing history for property
    await this.recordShowingOccurrence(booking);
    // After booking, if property is flip/rental, create buyer lead (after recording)
    await this.crm.createBuyerLeadFromShowing(slot.propertyId, buyerEmail, slotId).catch(err => console.error(err));
    return booking;
  }

  /**
   * Record showing occurrence in property history.
   * @param {object} booking - booking object
   */
  async recordShowingOccurrence(booking) {
    const showingRecord = {
      id: makeId(),
      bookingId: booking.id,
      propertyId: booking.propertyId,
      buyerEmail: booking.buyerEmail,
      showingTime: booking.startTime,
      status: 'booked', // will be updated to no-show if not attended
      feedback: null,
      feedbackSubmitted: false
    };
    if (!this.showingHistory.has(booking.propertyId)) {
      this.showingHistory.set(booking.propertyId, []);
    }
    this.showingHistory.get(booking.propertyId).push(showingRecord);
    // Emit ledger event for cross-domain (e.g., CRM lead creation already handled separately)
    await this.ledger.addLedgerEntry(booking.propertyId, { type: 'showingOccurred', bookingId: booking.id, showingId: booking.id, buyerEmail: booking.buyerEmail, time: booking.startTime });
    // Return showing record
    return showingRecord;
  }

  /**
   * Send email confirmation for a booking.
   * @param {object} booking - booking object
   * @returns {Promise<object>} email status
   */
  async sendConfirmation(booking) {
    // Stub: check email service availability
    if (this.emailServiceAvailable) {
      return { status: 'sent', bookingId: booking.id };
    } else {
      return { status: 'pending', bookingId: booking.id };
    }
  }

  /**
   * Send reminders for upcoming bookings.
   * @returns {Promise<array>} array of ReminderResult
   */
  async sendReminders() {
    const now = Date.now();
    const results = [];
    for (const booking of this.bookings.values()) {
      const start = new Date(booking.startTime).getTime();
      const diff = start - now;
      if (diff > 0 && diff <= this.reminderIntervalMinutes * 60 * 1000 && booking.reminderStatus !== 'sent') {
        // Send reminder (stub)
        if (this.emailServiceAvailable) {
          booking.reminderStatus = 'sent';
          results.push({ bookingId: booking.id, status: 'sent' });
        } else {
          booking.reminderStatus = 'pending';
          results.push({ bookingId: booking.id, status: 'pending' });
        }
      }
    }
    return results;
  }

  /**
   * Generate calendar sync stub (ICS) for a booking.
   * @param {object} booking - booking object
   * @returns {Promise<string>} ICS content
   */
  async generateCalendarSync(booking) {
    const slot = this.slots.get(booking.slotId);
    if (!slot) throw new Error('Slot not found');
    const uid = `${booking.id}@coffeehouse2home`;
    const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtstart = new Date(slot.startTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    // Assume duration 1 hour
    const dtend = new Date(new Date(slot.startTime).getTime() + 60*60*1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Coffeehouse2Home//Showings//EN\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:${dtstamp}\r\nDTSTART:${dtstart}\r\nDTEND:${dtend}\r\nSUMMARY:Showing at ${slot.locationRef}\r\nLOCATION:${slot.locationRef}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    return ics;
  }

  /**
   * Record buyer feedback for a booking.
   * @param {string} bookingId - booking ID
   * @param {string} feedback - feedback text
   * @returns {Promise<void>}
   */
  async recordFeedback(bookingId, feedback) {
    const booking = this.bookings.get(bookingId);
    if (!booking) throw new Error('Booking not found');
    if (!feedback) throw new Error('Feedback required');
    // Find showing record
    const showingRecords = this.showingHistory.get(booking.propertyId) || [];
    const record = showingRecords.find(r => r.bookingId === bookingId);
    if (!record) throw new Error('Showing record not found');
    record.feedback = feedback;
    record.feedbackSubmitted = true;
    booking.feedback = feedback;
    await this.ledger.addLedgerEntry(booking.propertyId, { type: 'showingFeedback', bookingId, feedback });
  }

  /**
   * Get showing history for a property.
   * @param {string} propertyId - property ID
   * @returns {Promise<array>} array of showing records
   */
  async getShowingHistory(propertyId) {
    return this.showingHistory.get(propertyId) || [];
  }

  /**
   * Mark passed showings with no-show if no feedback/attendance.
   * Called manually or by scheduler (not part of public API per brief, but we can include for internal use?)
   * Edge case: after end time, if no booking or no attendance, mark no-show.
   */
  async markNoShows() {
    const now = Date.now();
    for (const [propertyId, records] of this.showingHistory.entries()) {
      for (const record of records) {
        const recordTime = new Date(record.showingTime).getTime();
        if (recordTime < now && record.status !== 'attended' && record.status !== 'no-show' && !record.feedbackSubmitted) {
          record.status = 'no-show';
        }
      }
    }
  }
}

/**
 * FlipManager with acquisitions, budgets, bids, phases, job cost.
 */
// req-8: flip manager with acquisitions, budgets, bids, phases, job cost
class FlipManager {
  constructor(ledger) {
    this.ledger = ledger;
    this.acquisitions = new Map(); // id -> Acquisition (with propertyId)
    this.budgets = new Map(); // id -> Budget (with propertyId)
    this.lineItems = new Map(); // budgetId -> array of LineItem
    this.bids = new Map(); // projectId -> stored as acquisition or property? We'll store bids by acquisitionId or projectId as provided
    this.phases = new Map(); // projectId -> phase
  }

  /**
   * Record property acquisition.
   * @param {object} acquisition - acquisition data with propertyId
   * @returns {Promise<object>} created acquisition
   */
  async addAcquisition(acquisition) {
    if (!acquisition.propertyId) throw new Error('Property ID required');
    const property = this.ledger.getProperty(acquisition.propertyId);
    if (!property) throw new Error('Property not found');
    if (!acquisition.id) acquisition.id = makeId();
    this.acquisitions.set(acquisition.id, acquisition);
    // Update property status to reflect flip and preserve history
    await this.ledger.setPropertyStatus(acquisition.propertyId, 'Flip');
    await this.ledger.addLedgerEntry(acquisition.propertyId, { type: 'acquisition', acquisitionId: acquisition.id, details: acquisition });
    return acquisition;
  }

  /**
   * Create renovation budget for property.
   * @param {string} propertyId - property ID
   * @param {object} budget - budget data
   * @returns {Promise<object>} created budget
   */
  async createBudget(propertyId, budget) {
    if (!propertyId) throw new Error('Property ID required');
    if (!this.ledger.getProperty(propertyId)) throw new Error('Property not found');
    if (!budget.id) budget.id = makeId();
    budget.propertyId = propertyId;
    this.budgets.set(budget.id, budget);
    await this.ledger.addLedgerEntry(propertyId, { type: 'budgetCreated', budgetId: budget.id, budget });
    return budget;
  }

  /**
   * Add line item to budget.
   * @param {string} budgetId - budget ID
   * @param {object} item - line item data
   * @returns {Promise<object>} created line item
   */
  async addLineItem(budgetId, item) {
    const budget = this.budgets.get(budgetId);
    if (!budget) throw new Error('Budget not found');
    if (!item.id) item.id = makeId();
    if (!this.lineItems.has(budgetId)) {
      this.lineItems.set(budgetId, []);
    }
    this.lineItems.get(budgetId).push(item);
    await this.ledger.addLedgerEntry(budget.propertyId, { type: 'lineItemAdded', budgetId, lineItemId: item.id, item });
    return item;
  }

  /**
   * Record contractor bid.
   * @param {string} projectId - project ID (acquisition/property)
   * @param {object} bid - bid data
   * @returns {Promise<object>} recorded bid
   */
  async recordBid(projectId, bid) {
    // projectId can be acquisition ID or property ID; we'll assume it's acquisition ID for simplicity
    const acquisition = this.acquisitions.get(projectId);
    if (!acquisition) throw new Error('Project/acquisition not found');
    if (!bid.id) bid.id = makeId();
    bid.projectId = projectId;
    if (!this.bids.has(projectId)) {
      this.bids.set(projectId, []);
    }
    this.bids.get(projectId).push(bid);
    await this.ledger.addLedgerEntry(acquisition.propertyId, { type: 'bidRecorded', projectId, bidId: bid.id, bid });
    return bid;
  }

  /**
   * Set flip project phase.
   * @param {string} projectId - project ID
   * @param {string} phase - phase name
   * @returns {Promise<object>} project with updated phase
   */
  async setPhase(projectId, phase) {
    const acquisition = this.acquisitions.get(projectId);
    if (!acquisition) throw new Error('Project/acquisition not found');
    const property = this.ledger.getProperty(acquisition.propertyId);
    if (!property) throw new Error('Property not found');
    property.phase = phase;
    this.phases.set(projectId, phase);
    await this.ledger.addLedgerEntry(property.id, { type: 'phaseSet', projectId, phase });
    return property;
  }

  /**
   * Compute job cost for property: sum line items, bids, work order labor hours.
   * @param {string} propertyId - property ID
   * @returns {Promise<object>} job cost breakdown
   */
  async computeJobCost(propertyId) {
    const property = this.ledger.getProperty(propertyId);
    if (!property) throw new Error('Property not found');
    let materialsCost = 0;
    let laborCost = 0;
    let bidsCost = 0;
    // Sum line items across all budgets for this property
    for (const [budgetId, budget] of this.budgets.entries()) {
      if (budget.propertyId === propertyId) {
        const items = this.lineItems.get(budgetId) || [];
        for (const item of items) {
          if (item.cost) materialsCost += item.cost;
          else if (item.amount) materialsCost += item.amount;
        }
      }
    }
    // Sum bids for acquisitions linked to this property
    for (const [projectId, bids] of this.bids.entries()) {
      const acquisition = this.acquisitions.get(projectId);
      if (acquisition && acquisition.propertyId === propertyId) {
        for (const bid of bids) {
          if (bid.amount) bidsCost += bid.amount;
        }
      }
    }
    // Labor cost from work orders (if fieldOps attached)
    if (this.fieldOps) {
      const workOrders = this.fieldOps.getWorkOrdersForProperty(propertyId);
      for (const wo of workOrders) {
        for (const entry of wo.timeEntries || []) {
          if (entry.approved) {
            laborCost += entry.hours * (entry.hourlyRate || 0);
            if (entry.overtimeHours) {
              laborCost += entry.overtimeHours * (entry.overtimeRate || 0);
            }
          }
        }
      }
    }
    const totalCost = materialsCost + laborCost + bidsCost;
    return {
      propertyId,
      materialsCost,
      laborCost,
      bidsCost,
      totalCost
    };
  }
}

/**
 * RentalPortfolio with leases, tenants, payments, maintenance, vacancy, reminders.
 */
// req-9: rental portfolio with leases, tenants, rent roll, maintenance, vacancy, renewal reminders
class RentalPortfolio {
  constructor(ledger) {
    this.ledger = ledger;
    this.leases = new Map(); // id -> Lease (with propertyId, endDate, status)
    this.tenants = new Map(); // id -> Tenant (with leaseId)
    this.payments = new Map(); // leaseId -> array of Payment
    this.maintenanceRequests = new Map(); // id -> MaintenanceRequest
    this.vacancies = new Map(); // propertyId -> {vacant: bool, since: date}
    this.renewalLookaheadDays = 30; // configurable
  }

  /**
   * Create a lease linked to a property.
   * @param {object} lease - lease data with propertyId, endDate
   * @returns {Promise<object>} created lease
   */
  async createLease(lease) {
    if (!lease.propertyId) throw new Error('Property ID required');
    if (!this.ledger.getProperty(lease.propertyId)) throw new Error('Property not found');
    if (!lease.endDate) throw new Error('Lease end date required');
    if (!lease.id) lease.id = makeId();
    lease.status = 'active';
    this.leases.set(lease.id, lease);
    await this.ledger.setPropertyStatus(lease.propertyId, 'Rental');
    await this.ledger.addLedgerEntry(lease.propertyId, { type: 'leaseCreated', leaseId: lease.id, lease });
    // Clear vacancy if set
    this.vacancies.delete(lease.propertyId);
    return lease;
  }

  /**
   * Add tenant to a lease.
   * @param {object} tenant - tenant data with leaseId
   * @returns {Promise<object>} created tenant
   */
  async addTenant(tenant) {
    if (!tenant.leaseId) throw new Error('Lease ID required');
    if (!this.leases.has(tenant.leaseId)) throw new Error('Lease not found');
    if (!tenant.id) tenant.id = makeId();
    this.tenants.set(tenant.id, tenant);
    const lease = this.leases.get(tenant.leaseId);
    await this.ledger.addLedgerEntry(lease.propertyId, { type: 'tenantAdded', tenantId: tenant.id, tenant });
    return tenant;
  }

  /**
   * Record rent payment for a lease.
   * @param {string} leaseId - lease ID
   * @param {object} payment - payment data with amount, date
   * @returns {Promise<object>} recorded payment
   */
  async recordRentPayment(leaseId, payment) {
    const lease = this.leases.get(leaseId);
    if (!lease) throw new Error('Lease not found');
    if (!payment.id) payment.id = makeId();
    if (!this.payments.has(leaseId)) {
      this.payments.set(leaseId, []);
    }
    this.payments.get(leaseId).push(payment);
    await this.ledger.addLedgerEntry(lease.propertyId, { type: 'rentPayment', leaseId, paymentId: payment.id, amount: payment.amount });
    return payment;
  }

  /**
   * Open maintenance request for a property.
   * @param {object} request - request data with propertyId
   * @returns {Promise<object>} created request
   */
  async openMaintenanceRequest(request) {
    if (!request.propertyId) throw new Error('Property ID required');
    if (!this.ledger.getProperty(request.propertyId)) throw new Error('Property not found');
    if (!request.id) request.id = makeId();
    request.status = 'open';
    this.maintenanceRequests.set(request.id, request);
    await this.ledger.addLedgerEntry(request.propertyId, { type: 'maintenanceRequest', requestId: request.id, request });
    return request;
  }

  /**
   * Set vacancy status for a property.
   * @param {string} propertyId - property ID
   * @param {boolean} vacant - true if vacant
   * @returns {Promise<void>}
   */
  async setVacancy(propertyId, vacant) {
    const property = this.ledger.getProperty(propertyId);
    if (!property) throw new Error('Property not found');
    if (vacant) {
      if (!this.vacancies.has(propertyId)) {
        this.vacancies.set(propertyId, { vacant: true, since: new Date().toISOString() });
      } else {
        this.vacancies.get(propertyId).vacant = true;
      }
    } else {
      this.vacancies.delete(propertyId);
    }
    await this.ledger.addLedgerEntry(propertyId, { type: 'vacancyChange', vacant });
  }

  /**
   * Generate renewal reminders for leases ending within lookahead window.
   * @returns {Promise<array>} array of renewal reminders
   */
  async generateRenewalReminders() {
    const now = Date.now();
    const lookahead = this.renewalLookaheadDays * 24 * 60 * 60 * 1000;
    const reminders = [];
    for (const lease of this.leases.values()) {
      // Must have end date, active status, and not already renewed/terminated
      if (!lease.endDate) continue;
      if (lease.status !== 'active') continue;
      const endTime = new Date(lease.endDate).getTime();
      if (endTime > now && endTime <= now + lookahead) {
        reminders.push({
          leaseId: lease.id,
          propertyId: lease.propertyId,
          endDate: lease.endDate,
          reminderDate: new Date().toISOString()
        });
        // Optionally mark reminder sent? Not required but we can add a property
        lease.renewalReminderSent = true;
      }
    }
    return reminders;
  }

  /**
   * Get rent roll for a property.
   * @param {string} propertyId - property ID
   * @returns {Promise<object>} rent roll with payments
   */
  async getRentRoll(propertyId) {
    const payments = [];
    for (const [leaseId, leasePayments] of this.payments.entries()) {
      const lease = this.leases.get(leaseId);
      if (lease && lease.propertyId === propertyId) {
        payments.push(...leasePayments);
      }
    }
    return {
      propertyId,
      payments,
      totalPayments: payments.reduce((sum, p) => sum + (p.amount || 0), 0)
    };
  }
}

/**
 * FieldOps with work orders, task assignments, time tracking, payroll, materials.
 */
// req-10: work orders become crew task lists
// req-11: weekly payroll with rates, overtime, job cost feed
// req-12: material tracking with reorder flags
class FieldOps {
  constructor(ledger) {
    this.ledger = ledger;
    this.workOrders = new Map(); // id -> WorkOrder (with tasks, timeEntries, materialConsumptions)
    this.timeEntries = new Map(); // id -> TimeEntry (with workOrderId, crewId, date, hours, approved)
    this.materials = new Map(); // supplyId -> {name, quantity, threshold, reorderFlag}
    this.purchases = new Map(); // purchaseId -> Purchase
    this.overtimeThresholdHours = 8; // daily
    this.overtimeMultiplier = 1.5;
  }

  /**
   * Create a work order from any property context.
   * @param {string} propertyId - property ID
   * @param {string} source - source type e.g. 'flip', 'maintenance', 'buyer-repair'
   * @param {string} description - description
   * @returns {Promise<object>} created work order
   */
  async createWorkOrder(propertyId, source, description) {
    if (!propertyId) throw new Error('Property ID required');
    if (!this.ledger.getProperty(propertyId)) throw new Error('Property not found');
    const wo = {
      id: makeId(),
      propertyId,
      source,
      description,
      status: 'open',
      tasks: [], // task ids
      timeEntries: [], // time entry ids
      materialConsumptions: [], // {supplyId, quantityChange}
      createdAt: new Date().toISOString()
    };
    this.workOrders.set(wo.id, wo);
    await this.ledger.addLedgerEntry(propertyId, { type: 'workOrderCreated', workOrderId: wo.id, source, description });
    return wo;
  }

  /**
   * Assign a task to crew on a work order.
   * @param {string} workOrderId - work order ID
   * @param {string} crewId - crew member ID
   * @returns {Promise<void>}
   */
  async assignTask(workOrderId, crewId) {
    const wo = this.workOrders.get(workOrderId);
    if (!wo) throw new Error('Work order not found');
    const task = {
      id: makeId(),
      workOrderId,
      crewId,
      status: 'assigned',
      assignedAt: new Date().toISOString()
    };
    wo.tasks.push(task.id);
    // Store tasks separately? We'll use a tasks map for convenience
    if (!this.tasks) this.tasks = new Map();
    this.tasks.set(task.id, task);
    await this.ledger.addLedgerEntry(wo.propertyId, { type: 'taskAssigned', workOrderId, taskId: task.id, crewId });
  }

  /**
   * Log time for a crew member on a work order.
   * @param {string} workOrderId - work order ID
   * @param {string} crewId - crew member ID
   * @param {Date} date - date of work (date part only)
   * @param {number} hours - hours worked
   * @returns {Promise<object>} time entry
   */
  async logTime(workOrderId, crewId, date, hours) {
    if (hours < 0) throw new Error('Hours cannot be negative');
    const wo = this.workOrders.get(workOrderId);
    if (!wo) throw new Error('Work order not found');
    // Create time entry, initially unapproved
    const entry = {
      id: makeId(),
      workOrderId,
      crewId,
      date: new Date(date),
      hours,
      approved: false, // must be approved manually
      hourlyRate: 20 // default, but could be crew-specific; for simplicity fixed or store in crew rates map
    };
    // If crewId rate known, use it; otherwise default 20. But we may store crew rates externally; for now assume 20.
    this.timeEntries.set(entry.id, entry);
    wo.timeEntries.push(entry.id);
    await this.ledger.addLedgerEntry(wo.propertyId, { type: 'timeLogged', workOrderId, timeEntryId: entry.id, crewId, hours });
    return entry;
  }

  /**
   * Approve a time entry (not in spec but needed for only approved time counts).
   * This method is not exported per constraints, but we can have an internal method.
   * We'll add it as a non-exported function inside class.
   */
  approveTimeEntry(timeEntryId) {
    const entry = this.timeEntries.get(timeEntryId);
    if (entry) {
      entry.approved = true;
    }
  }

  /**
   * Calculate weekly payroll for a given week.
   * Only approved time entries count.
   * Overtime: daily overtime threshold.
   * @param {Date} weekStart - start of week (inclusive)
   * @param {Date} weekEnd - end of week (inclusive)
   * @returns {Promise<object>} payroll record
   */
  async calculateWeeklyPayroll(weekStart, weekEnd) {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    // Normalize to dates
    const payroll = {
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      records: [], // per crew per day
      totals: {
        regularHours: 0,
        overtimeHours: 0,
        regularPay: 0,
        overtimePay: 0,
        totalPay: 0
      }
    };
    // Group approved entries by crew and date
    const entriesByCrewDate = new Map(); // key: crewId|dateString
    for (const entry of this.timeEntries.values()) {
      if (!entry.approved) continue;
      const entryDate = new Date(entry.date);
      if (entryDate >= start && entryDate <= end) {
        const dateKey = entryDate.toISOString().split('T')[0];
        const key = `${entry.crewId}|${dateKey}`;
        if (!entriesByCrewDate.has(key)) {
          entriesByCrewDate.set(key, { crewId: entry.crewId, date: dateKey, hours: 0 });
        }
        entriesByCrewDate.get(key).hours += entry.hours;
      }
    }
    // For each crew-date, apply overtime
    for (const group of entriesByCrewDate.values()) {
      const regularHours = Math.min(group.hours, this.overtimeThresholdHours);
      const overtimeHours = Math.max(0, group.hours - this.overtimeThresholdHours);
      // hourly rate: for simplicity use default 20, but we could look up crew rate if stored
      const rate = 20; // default; in real system crew rates map.
      const regularPay = regularHours * rate;
      const overtimePay = overtimeHours * rate * this.overtimeMultiplier;
      payroll.records.push({
        crewId: group.crewId,
        date: group.date,
        regularHours,
        overtimeHours,
        regularPay,
        overtimePay,
        totalPay: regularPay + overtimePay
      });
      payroll.totals.regularHours += regularHours;
      payroll.totals.overtimeHours += overtimeHours;
      payroll.totals.regularPay += regularPay;
      payroll.totals.overtimePay += overtimePay;
      payroll.totals.totalPay += regularPay + overtimePay;
    }
    return payroll;
  }

  /**
   * Track material usage or adjustment.
   * @param {string} supplyId - supply ID
   * @param {number} quantityChange - positive for addition, negative for consumption
   * @returns {Promise<void>}
   */
  async trackMaterial(supplyId, quantityChange) {
    if (!this.materials.has(supplyId)) {
      // initialize with default threshold 0? But reorder flag should be set if below threshold.
      this.materials.set(supplyId, { id: supplyId, quantity: 0, threshold: 0, reorderFlag: false });
    }
    const material = this.materials.get(supplyId);
    material.quantity += quantityChange;
    if (material.quantity < 0) material.quantity = 0;
    // Check reorder flag
    if (material.quantity <= material.threshold) {
      material.reorderFlag = true;
    } else {
      material.reorderFlag = false;
    }
    // Also record in purchases if addition? Not here; purchase handled separately.
  }

  /**
   * Record a material purchase.
   * @param {object} purchase - purchase data with supplyId, quantity, cost
   * @returns {Promise<void>}
   */
  async purchaseMaterial(purchase) {
    if (!purchase.supplyId) throw new Error('Supply ID required');
    if (!this.materials.has(purchase.supplyId)) {
      this.materials.set(purchase.supplyId, { id: purchase.supplyId, quantity: 0, threshold: 0, reorderFlag: false });
    }
    const material = this.materials.get(purchase.supplyId);
    material.quantity += purchase.quantity;
    // Clear reorder flag if now above threshold
    if (material.quantity > material.threshold) {
      material.reorderFlag = false;
    }
    if (!purchase.id) purchase.id = makeId();
    purchase.date = purchase.date || new Date().toISOString();
    this.purchases.set(purchase.id, purchase);
  }

  /**
   * Check reorder flags for materials below threshold.
   * @param {Map<string, number>} thresholdMap - supplyId -> threshold
   * @returns {Promise<array>} array of reorder flags
   */
  async checkReorder(thresholdMap) {
    const flags = [];
    for (const [supplyId, threshold] of thresholdMap.entries()) {
      const material = this.materials.get(supplyId);
      if (material) {
        material.threshold = threshold;
        if (material.quantity <= threshold) {
          material.reorderFlag = true;
          flags.push({ supplyId, quantity: material.quantity, threshold, reorderFlag: true });
        } else {
          material.reorderFlag = false;
        }
      } else {
        // If material not yet tracked, consider quantity 0 and flag if threshold >=0
        this.materials.set(supplyId, { id: supplyId, quantity: 0, threshold, reorderFlag: true });
        flags.push({ supplyId, quantity: 0, threshold, reorderFlag: true });
      }
    }
    return flags;
  }

  /**
   * Get work orders for a property (used by FlipManager job cost).
   * @param {string} propertyId - property ID
   * @returns {array} work orders
   */
  getWorkOrdersForProperty(propertyId) {
    return [...this.workOrders.values()].filter(wo => wo.propertyId === propertyId);
  }
}

// Export classes
module.exports.PropertyLedger = PropertyLedger;
module.exports.RealEstateCRM = RealEstateCRM;
module.exports.ShowingManager = ShowingManager;
module.exports.FlipManager = FlipManager;
module.exports.RentalPortfolio = RentalPortfolio;
module.exports.FieldOps = FieldOps;
})(module, module.exports);

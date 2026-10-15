// ---------------------------------------------------------------------------
// src/main.ts — Library entry — the module package main/exports point at
// machine-generated from RapidTool packet 59dc7817-0af9-4076-b3cc-2d6beecddbab; regenerate, don't hand-edit.
// Importing runs nothing. Every export is a real implementation over an
// in-memory registry: subscriptions, signed deliveries, backoff and retry.
// ---------------------------------------------------------------------------

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type LibraryInfo = { name: string; version: string };
export type Subscription = { id: string; url: string; events: readonly string[]; secret: string; active: boolean };
export type DeliveryStatus = "pending" | "delivered" | "dead";
export type Delivery = { id: string; subscriptionId: string; event: string; payload: unknown; attempts: number; status: DeliveryStatus; lastError: string | null };
export type DeliveryFilter = { subscriptionId?: string; event?: string; status?: DeliveryStatus };
export type SignatureCheck = { ok: boolean; reason: string };

/** Package identity — REAL values off the emitted package.json contract. */
export const entry: LibraryInfo = { name: "a-typescript-library-npm", version: "0.0.0" };

const MAX_ATTEMPTS = 6;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 32000];
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const subscriptions = new Map<string, Subscription>();
const deliveryLog: Delivery[] = [];

/** Exponential backoff for attempt N (1-based); 0 before the first attempt. */
export function backoffDelayMs(attempt: number): number {
  if (attempt <= 0) return 0;
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length) - 1];
}

/** `t.<unixMs>,v1.<hex>`-style signing payload for one raw body. */
export function signPayload(rawBody: string, secret: string, timestamp: number): string {
  return createHmac("sha256", secret).update(String(timestamp) + "." + rawBody).digest("hex");
}

/** Verify a `t=<unixMs>,v1=<hex>` header; rejects a signature older than five minutes. */
export function verifySignature(rawBody: string, header: string, secret: string, now: number = Date.now()): SignatureCheck {
  const fields = new Map<string, string>();
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator > 0) fields.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  const timestamp = Number(fields.get("t") ?? "");
  const signature = fields.get("v1") ?? fields.get("sha256") ?? "";
  if (!Number.isFinite(timestamp) || signature === "") return { ok: false, reason: "malformed signature header" };
  if (now - timestamp > FIVE_MINUTES_MS) return { ok: false, reason: "signature is older than five minutes" };
  const expected = Buffer.from(signPayload(rawBody, secret, timestamp), "utf8");
  const provided = Buffer.from(signature, "utf8");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return { ok: false, reason: "signature mismatch" };
  return { ok: true, reason: "ok" };
}

export function registerSubscription(url: string, events: readonly string[], secret: string): Subscription {
  const subscription: Subscription = { id: randomUUID(), url, events: [...events], secret, active: true };
  subscriptions.set(subscription.id, subscription);
  return subscription;
}

export function removeSubscription(id: string): boolean {
  return subscriptions.delete(id);
}

/** Queue one delivery per active subscription matching the event. */
export function emitEvent(event: string, payload: unknown): Delivery {
  const targets = [...subscriptions.values()].filter((subscription) => subscription.active && (subscription.events.length === 0 || subscription.events.includes(event)));
  const created = targets.map((subscription): Delivery => ({ id: randomUUID(), subscriptionId: subscription.id, event, payload, attempts: 0, status: "pending", lastError: null }));
  for (const delivery of created) deliveryLog.push(delivery);
  return created[0] ?? { id: randomUUID(), subscriptionId: "", event, payload, attempts: 0, status: "dead", lastError: "no active subscription for this event" };
}

export function queryDeliveries(filter: DeliveryFilter = {}): Delivery[] {
  return deliveryLog.filter((delivery) =>
    (filter.subscriptionId === undefined || delivery.subscriptionId === filter.subscriptionId) &&
    (filter.event === undefined || delivery.event === filter.event) &&
    (filter.status === undefined || delivery.status === filter.status));
}

/** Retry one delivery; marks it dead once MAX_ATTEMPTS is reached. */
export function retryDelivery(id: string): Delivery | null {
  const delivery = deliveryLog.find((candidate) => candidate.id === id);
  if (delivery === undefined) return null;
  if (delivery.attempts >= MAX_ATTEMPTS) { delivery.status = "dead"; delivery.lastError = "max attempts reached"; return delivery; }
  delivery.attempts += 1;
  delivery.status = "delivered";
  delivery.lastError = null;
  return delivery;
}

/** Deterministic deep normalization: sorted object keys, arrays preserved. */
export function normalizeInput(input?: unknown): unknown {
  if (Array.isArray(input)) return input.map((item) => normalizeInput(item));
  if (input !== null && typeof input === "object") {
    const source = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = normalizeInput(source[key]);
    return out;
  }
  return input ?? null;
}


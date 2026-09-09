// ---------------------------------------------------------------------------
// src/domain/real_estate.ts — Typed entities from the lattice
// machine-generated from RapidTool packet 16692201-777b-4cf6-b02b-a85f02e9c6a3; regenerate, don't hand-edit.
// Typed entities from the A6 data contract. TODO(E-15) stub: extend fields,
// add per-entity invariants, and keep in sync with the store + api stubs.
// ---------------------------------------------------------------------------

export interface Buyer {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Flipper {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Property {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Rental {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Listing {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface WorkOrder {
  /** id (contract type ulid) */
  id: string;
  /** title (contract type string) */
  title: string;
  /** status (contract type enum) */
  status: string;
  /** note (contract type string) */
  note: string;
}

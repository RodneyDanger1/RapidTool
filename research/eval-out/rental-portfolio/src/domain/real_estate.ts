// ---------------------------------------------------------------------------
// src/domain/real_estate.ts — Typed entities from the lattice
// machine-generated from RapidTool packet 75285bd4-ced2-42be-9d00-caf3f9f243a7; regenerate, don't hand-edit.
// Typed entities from the A6 data contract. TODO(E-15 stub): extend fields,
// add per-entity invariants, and keep in sync with the store + api stubs.
// ---------------------------------------------------------------------------

export interface Portfolio {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Manager {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Tenant {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Dashboard {
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

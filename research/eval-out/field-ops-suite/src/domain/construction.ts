// ---------------------------------------------------------------------------
// src/domain/construction.ts — Typed entities from the lattice
// machine-generated from RapidTool packet 1bf0e807-f549-4335-938e-25dd71643cc2; regenerate, don't hand-edit.
// Typed entities from the A6 data contract. TODO(E-15) stub: extend fields,
// add per-entity invariants, and keep in sync with the store + api stubs.
// ---------------------------------------------------------------------------

export interface Crew {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Member {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Task {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Material {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Payroll {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Supply {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

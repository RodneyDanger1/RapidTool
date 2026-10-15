// ---------------------------------------------------------------------------
// src/domain/finance_ops.ts — Typed entities from the lattice
// machine-generated from RapidTool packet 4dbb30be-da7b-47ae-8ae5-19aa54a69b46; regenerate, don't hand-edit.
// REAL domain module (fixes/352): the typed entities recorded in the A6
// data contract. This module owns only these types — it never re-exports
// the generated tree. Extend the field list as the contract grows.
// ---------------------------------------------------------------------------

export interface Invoice {
  /** id (contract type ulid) */
  id: string;
  /** totalCents (contract type int) */
  totalCents: number;
  /** approvedBy (contract type ulid?) */
  approvedBy: string | null;
}

export interface Command {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Vendor {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Summary {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Convert {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Export {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

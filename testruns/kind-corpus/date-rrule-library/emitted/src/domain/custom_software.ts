// ---------------------------------------------------------------------------
// src/domain/custom_software.ts — Typed entities from the lattice
// machine-generated from RapidTool packet 59dc7817-0af9-4076-b3cc-2d6beecddbab; regenerate, don't hand-edit.
// REAL domain module (fixes/352): the typed entities recorded in the A6
// data contract. This module owns only these types — it never re-exports
// the generated tree. Extend the field list as the contract grows.
// ---------------------------------------------------------------------------

export interface Package {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Rule {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Library {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Compute {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

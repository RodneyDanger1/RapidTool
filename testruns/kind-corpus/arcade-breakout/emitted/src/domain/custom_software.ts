// ---------------------------------------------------------------------------
// src/domain/custom_software.ts — Typed entities from the lattice
// machine-generated from RapidTool packet 4a2c2dc2-9537-46ef-9cd2-8ebd9ba44272; regenerate, don't hand-edit.
// REAL domain module (fixes/352): the typed entities recorded in the A6
// data contract. This module owns only these types — it never re-exports
// the generated tree. Extend the field list as the contract grows.
// ---------------------------------------------------------------------------

export interface Score {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Player {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Game {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Track {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Drag {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

export interface Persist {
  /** id (contract type ulid) */
  id: string;
  /** status (contract type enum) */
  status: string;
  /** updatedAt (contract type datetime) */
  updatedAt: string;
}

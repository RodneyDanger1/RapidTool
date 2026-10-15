// ---------------------------------------------------------------------------
// src/main.ts — Browser entry — boots the game shell
// machine-generated from RapidTool packet 729ce422-bcaa-4b79-9ec6-4840b61a458e; regenerate, don't hand-edit.
// Assets are NOT engine-generated — see assets/manifest.json.
// ---------------------------------------------------------------------------

import { bootGame } from "./ui/console";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("RT_E_VALIDATION · missing #root element — index.html did not load");
const handle = bootGame(rootEl);
void handle; // keep the GameHandle reachable for future HMR/dev wiring

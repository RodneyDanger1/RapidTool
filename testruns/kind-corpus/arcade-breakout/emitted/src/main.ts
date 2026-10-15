// ---------------------------------------------------------------------------
// src/main.ts — Browser entry — boots the game shell
// machine-generated from RapidTool packet 4a2c2dc2-9537-46ef-9cd2-8ebd9ba44272; regenerate, don't hand-edit.
// Assets are NOT engine-generated — see assets/manifest.json.
// ---------------------------------------------------------------------------

import { bootGame } from "./ui/console";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("RT_E_VALIDATION · missing #root element — index.html did not load");
const handle = bootGame(rootEl);
void handle; // keep the GameHandle reachable for future HMR/dev wiring

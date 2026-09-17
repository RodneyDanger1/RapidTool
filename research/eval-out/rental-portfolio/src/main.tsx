// ---------------------------------------------------------------------------
// src/main.tsx — Browser entry — mounts the UI shell (P8 interface contract)
// machine-generated from RapidTool packet 5587eca3-156b-4c57-9ea4-23879f548cb5; regenerate, don't hand-edit.
// The mounted surface is the contract-level Console shell from src/ui; wiring
// it to the store/job modules is the build work ahead (see README honest
// boundaries).
// ---------------------------------------------------------------------------

import { createRoot } from "react-dom/client";

import Console from "./ui/console";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root element — index.html did not load");
createRoot(rootEl).render(<Console />);

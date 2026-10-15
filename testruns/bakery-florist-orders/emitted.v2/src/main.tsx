// ---------------------------------------------------------------------------
// src/main.tsx — Browser entry — mounts the UI shell (P8 interface contract)
// machine-generated from RapidTool packet 54661844-e75e-47c2-bc63-3f3608fe21a2; regenerate, don't hand-edit.
// The mounted surface is the contract-level Console shell from src/ui; wiring
// it to the store/job modules is the build work ahead (see README honest
// boundaries).
// ---------------------------------------------------------------------------

import { createRoot } from "react-dom/client";
import "./styles.css";

import Console from "./ui/console";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("RT_E_VALIDATION · missing #root element — index.html did not load");
createRoot(rootEl).render(<Console />);

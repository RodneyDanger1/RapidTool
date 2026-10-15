// ---------------------------------------------------------------------------
// src/main.tsx — Browser entry — mounts the UI shell (P8 interface contract)
// machine-generated from RapidTool packet 1e776d25-d838-4a5a-aabd-ad54938787b1; regenerate, don't hand-edit.
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

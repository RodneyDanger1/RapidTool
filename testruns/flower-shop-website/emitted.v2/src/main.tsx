// ---------------------------------------------------------------------------
// src/main.tsx — Browser entry — mounts the UI shell (P8 interface contract)
// machine-generated from RapidTool packet f7e488bf-0b68-47eb-8515-ad3b83ec387e; regenerate, don't hand-edit.
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

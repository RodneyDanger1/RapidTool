import { createFileRoute } from "@tanstack/react-router";
import { RunScreen } from "@/components/console.tsx";

export const Route = createFileRoute("/run/$id")({
  component: RunPage,
  head: () => ({
    meta: [{ title: "RapidTool — Delivery run" }],
  }),
});

function RunPage() {
  const { id } = Route.useParams();
  // UI-1: `key={id}` forces a fresh RunScreen per project, so local UI state
  // (HITL note draft, error, active tab, artifact selection, viewPhase) never
  // leaks across project/clone navigation on the same route.
  return <RunScreen key={id} id={id} />;
}

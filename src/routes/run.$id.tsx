import { createFileRoute } from "@tanstack/react-router";
import { RunScreen } from "@/components/console.tsx";
import { useRapid } from "@/lib/store";

export const Route = createFileRoute("/run/$id")({
  component: RunPage,
  head: ({ params }) => {
    // 336-5: the tab title is STATE-AWARE. The store is client-only, so an
    // evaluation before hydration (SSR, or a pre-hydration client render)
    // cannot know whether the build exists and keeps the neutral run title.
    // Once hydrated, a missing id names itself instead of the tab promising a
    // delivery run while the body says the build does not exist (335-5 §5.4).
    const state = useRapid.getState();
    const exists = state.hydrated ? state.hasProject(params.id) : true;
    return {
      meta: [{ title: exists ? "RapidTool — Delivery run" : "RapidTool — build not found" }],
    };
  },
});

function RunPage() {
  const { id } = Route.useParams();
  // UI-1: `key={id}` forces a fresh RunScreen per project, so local UI state
  // (HITL note draft, error, active tab, artifact selection, viewPhase) never
  // leaks across project/clone navigation on the same route.
  return <RunScreen key={id} id={id} />;
}

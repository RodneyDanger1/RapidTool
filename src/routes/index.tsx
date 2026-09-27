import { createFileRoute } from "@tanstack/react-router";
import { HomeScreen } from "@/components/console.tsx";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    // R6-f02 (W-11): never "autonomous software agency/factory" while `doctor`
    // prints autonomousSoftwareFactory:false — declare-or-strike.
    meta: [{ title: "RapidTool — governed 13-phase delivery harness" }],
  }),
});

function Home() {
  return <HomeScreen />;
}

import { createFileRoute } from "@tanstack/react-router";
import { HomeScreen } from "@/components/console.tsx";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [{ title: "RapidTool — autonomous software agency" }],
  }),
});

function Home() {
  return <HomeScreen />;
}

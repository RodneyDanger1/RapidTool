import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent, AppNotFoundComponent } from "@/lib/error-component.tsx";
import { installRtClient } from "@/lib/rt-client.ts";
import { routeTree } from "./routeTree.gen.ts";

// CAP-1: global window error/unhandledrejection capture (idempotent,
// browser-only). Module scope installs before any route can crash.
installRtClient();

export function getRouter() {
  return createRouter({
    routeTree,
    // Render an accessible error state anywhere a route render/load throws,
    // instead of unmounting the shell to a blank page.
    defaultErrorComponent: AppErrorComponent,
    // Backstop for programmatic route.notFound() throws raised by routes that
    // do not define their own notFoundComponent (the root route also defines
    // one, which wins for plain unmatched URLs).
    defaultNotFoundComponent: AppNotFoundComponent,
  });
}

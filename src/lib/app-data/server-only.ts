export function assertAppDataServerOnly(
  context = "app-data/client.server",
): void {
  if (typeof window !== "undefined") {
    // Coded (RT_E_INTERNAL): a browser load of a server-only module is a
    // build/wiring failure, not caller input.
    throw Object.assign(
      new Error(
        `@/lib/${context} is server-only. Call connector tools from a createServerFn handler (dynamic import of @/lib/app-data/client.server), never from a React component, useEffect, or browser fetch. Types and login helpers are client-safe via @/lib/app-data.`,
      ),
      { code: "RT_E_INTERNAL" },
    );
  }
}

assertAppDataServerOnly("app-data/client.server");

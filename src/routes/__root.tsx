import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { AppNotFoundComponent } from "@/lib/error-component";
import { installRtClient } from "@/lib/rt-client";
// Cross-component imports carry explicit extensions, per the in-repo convention
// (console.tsx docs the same rule; routes import "@/components/console.tsx").
import { PreviewHostBridge } from "@/components/preview-host-bridge.tsx";
import appCss from "../styles.css?url";

const APP_NAME = "RapidTool";

/**
 * CAP-1 late-safe telemetry boot (fixes/124 A3-01): router.tsx installs the
 * global capture handlers at module scope so nothing can crash before them;
 * this layout effect re-arms the host after hydration for cases where the
 * router module evaluated on the server only (SSR bail-out / soft nav).
 * installRtClient is idempotent (module latch), so exactly ONE install ever
 * runs — the ring + Long-Tasks observer + heartbeat + crash snapshot are live
 * in the browser either way.
 */
function TelemetryBoot() {
  useEffect(() => {
    installRtClient();
  }, []);
  return null;
}

export const Route = createRootRoute({
  // Unmatched URLs render this inside the app shell (html/body/AuthProvider
  // stay mounted) instead of a blank page.
  notFoundComponent: AppNotFoundComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "RapidTool is a governed delivery harness. Research, architect, isolate, and ship through a 13-phase audited graph.",
      },
      { name: "theme-color", content: "#0a0c0b" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Apply the persisted theme before React hydrates so there is no
            flash of the wrong theme. `data-theme` lives on <html>, whose
            suppressHydrationWarning covers this client-only attribute. The
            theme-color meta defaults to the dark --color-bg (#0a0c0b — the
            exact value @theme declares in styles.css); when the persisted
            theme is light it is moved to the light --color-bg (#edf3f0) so
            browser/PWA chrome matches the surface. W24 U2: both hexes used to
            be stale copies of an older palette (#0b0c0e / #f6f7f4) that no
            token in styles.css matched, so the chrome tint drifted from the
            painted background in both themes. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("rapid.theme");if(t==="light"){document.documentElement.setAttribute("data-theme","light");var m=document.querySelector("meta[name=theme-color]");if(m)m.setAttribute("content","#edf3f0");}else if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");}}catch(e){/* best-effort flash prevention: localStorage.getItem throws SecurityError when storage is blocked (sandboxed preview / privacy mode). Ignoring it leaves the default dark theme, which is the documented default; the hydrated toggle in console.tsx still applies and persists the choice for the session. */}',
          }}
        />
      </head>
      <body className="bg-bg font-sans text-fg">
        <TelemetryBoot />
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});

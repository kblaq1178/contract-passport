"use client";

import { useEffect, useRef } from "react";
import "@/passport/passport.css";

/** Mirrors PassportMode in @/passport/main without statically importing it. */
type PassportMode = "landing" | "dashboard";

/**
 * Mounts the original Contract Passport UI (ported from web/) inside the Next.js
 * app.
 *
 * The ported app is plain DOM code, so it is imported dynamically inside the
 * effect: that keeps it out of the server bundle and guarantees it only touches
 * `window` in the browser. The `#app` shell below is exactly what web/index.html
 * used to provide, so the ported code runs unchanged.
 */
export default function PassportApp({ mode }: { mode: PassportMode }) {
  const mounted = useRef(false);

  useEffect(() => {
    // React StrictMode runs effects twice in development. The ported app binds
    // DOM listeners when it mounts, so only the first pass may run.
    if (mounted.current) return;
    mounted.current = true;

    void import("@/passport/main").then(({ mountPassportApp }) => {
      mountPassportApp(mode);
    });
  }, [mode]);

  return <div id="app" className="app-shell passport-root" />;
}

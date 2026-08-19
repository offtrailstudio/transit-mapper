"use client";

import { useEffect, useState } from "react";

function getPreferredScheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Tracks the OS/browser prefers-color-scheme. Reads the real value synchronously
 * on the client's first render (not just after an effect) so consumers like the
 * Mapbox style prop don't mount with a guessed value and immediately swap it —
 * switching a mapbox-gl style while its sprite is still loading throws.
 */
export function useColorScheme(): "light" | "dark" {
  const [scheme, setScheme] = useState<"light" | "dark">(getPreferredScheme);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setScheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return scheme;
}

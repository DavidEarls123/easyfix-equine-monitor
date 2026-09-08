/* A hash router, because the app is a single static page and the URL should
   still say where you are — a stall alert links straight to the animal. */

import { useEffect, useState } from "react";

export function parse(hash) {
  const raw = (hash || "").replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const q = Object.fromEntries(new URLSearchParams(query));
  return { parts, q, at: parts[0] || "dashboard", id: parts[1] || null };
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function go(to) {
  window.location.hash = to.startsWith("#") ? to : `#/${to.replace(/^\//, "")}`;
}

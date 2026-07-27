"use client";

import * as React from "react";

/**
 * Returns an incrementing value whenever the browser reports that it has
 * reconnected. Data-loading effects can depend on this value to retry a live
 * fetch without coupling their cache fallback to the rendered online state.
 */
export function useReconnectTrigger(): number {
  const [trigger, setTrigger] = React.useState(0);

  React.useEffect(() => {
    const handleOnline = () => setTrigger((current) => current + 1);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return trigger;
}

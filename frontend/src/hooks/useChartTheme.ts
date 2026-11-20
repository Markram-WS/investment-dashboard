import { useEffect, useMemo, useState } from "react";
import type { ChartTheme } from "ztd-charts";
import { chartTheme } from "../components/chartTheme";

/**
 * Chart theme for the app's current colour mode. Re-renders when the `dark`
 * class on <html> changes, so a theme toggle restyles charts without a remount.
 */
export default function useChartTheme(): Partial<ChartTheme> {
  const [mode, setMode] = useState<"light" | "dark">(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return useMemo(() => chartTheme(mode), [mode]);
}

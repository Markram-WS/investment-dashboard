export type SideDirection = "long" | "short" | "flat";

/** L / S / B / S: the side as one letter; colour carries the direction. */
export const sideCode = (side?: string | null): { letter: string; dir: SideDirection } => {
  const s = (side ?? "").trim().toUpperCase();
  if (s === "LONG" || s === "BUY") return { letter: s.charAt(0), dir: "long" };
  if (s === "SHORT" || s === "SELL") return { letter: s.charAt(0), dir: "short" };
  return { letter: s.charAt(0) || "—", dir: "flat" };
};

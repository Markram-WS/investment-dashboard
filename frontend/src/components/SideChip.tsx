import React from "react";

export type SideDirection = "long" | "short" | "flat";

/** L / S / B / S: the side as one letter; colour carries the direction. */
export const sideCode = (side?: string | null): { letter: string; dir: SideDirection } => {
  const s = (side ?? "").trim().toUpperCase();
  if (s === "LONG" || s === "BUY") return { letter: s.charAt(0), dir: "long" };
  if (s === "SHORT" || s === "SELL") return { letter: s.charAt(0), dir: "short" };
  return { letter: s.charAt(0) || "—", dir: "flat" };
};

/** The side as a one-letter chip: L / B positive, S negative. */
const SideChip: React.FC<{ side?: string | null }> = ({ side }) => {
  const { letter, dir } = sideCode(side);
  return <span className="at-side" data-dir={dir}>{letter}</span>;
};

export default SideChip;

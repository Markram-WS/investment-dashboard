import React from "react";
import { sideCode } from "./sideCode";

/** The side as a one-letter chip: L / B positive, S negative. */
const SideChip: React.FC<{ side?: string | null }> = ({ side }) => {
  const { letter, dir } = sideCode(side);
  return <span className="at-side" data-dir={dir}>{letter}</span>;
};

export default SideChip;

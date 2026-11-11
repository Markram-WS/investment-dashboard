import type { ReactNode } from "react";

/**
 * Shared page header: the 26px dashboard page title on the left and optional
 * page-level meta (status dots, counts) on the right, baseline-aligned.
 * Contract lives in DESIGN.md — do not size page titles anywhere else.
 */
export default function PageHeader({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
      <h1
        className="m-0 text-ink"
        style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em" }}
      >
        {title}
      </h1>
      {meta ? <div className="flex flex-wrap items-center gap-6">{meta}</div> : null}
    </header>
  );
}

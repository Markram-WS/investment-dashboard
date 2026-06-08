import type { ReactNode } from "react";

export default function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      {children}
    </div>
  );
}

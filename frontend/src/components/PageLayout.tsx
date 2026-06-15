import type { ReactNode } from "react";

export default function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-10">
      {children}
    </div>
  );
}

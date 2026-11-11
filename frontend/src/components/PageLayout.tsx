import { createContext, useContext } from "react";
import type { ReactNode } from "react";

/** True when an ancestor already rendered the page shell, so nested layouts render bare. */
const InPageLayout = createContext(false);

export default function PageLayout({ children }: { children: ReactNode }) {
  const nested = useContext(InPageLayout);
  if (nested) return <>{children}</>;
  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-10">
      <InPageLayout.Provider value>{children}</InPageLayout.Provider>
    </div>
  );
}

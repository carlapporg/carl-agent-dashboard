import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  /** Wider for list-heavy screens like Tasks */
  wide?: boolean;
};

export function PageShell({ children, className, wide }: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        wide ? "max-w-[1400px]" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

interface SectionLabelProps {
  children?: ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[2.4px] text-dust">
      {children}
    </div>
  );
}

export default SectionLabel;

import type { ReactNode } from "react";

interface SectionLabelProps {
  children?: ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div className="font-mono text-[9px] uppercase tracking-[2.5px] text-dust">
      {children}
    </div>
  );
}

export default SectionLabel;

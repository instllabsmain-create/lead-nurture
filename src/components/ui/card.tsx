import type { ReactNode } from "react";

interface CardProps {
  children?: ReactNode;
}

export function Card({ children }: CardProps) {
  return (
    <div className="rounded-2xl border border-border/80 bg-white/95 p-5 shadow-[0_14px_40px_rgba(41,28,16,0.04)]">
      {children}
    </div>
  );
}

export default Card;

import type { ReactNode } from "react";

interface CardProps {
  children?: ReactNode;
}

export function Card({ children }: CardProps) {
  return <div className="rounded-xl border border-border bg-white p-5">{children}</div>;
}

export default Card;

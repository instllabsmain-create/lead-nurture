"use client";

interface LoadingDotsProps {
  className?: string;
}

export function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <span className={className} aria-label="Loading">
      <span className="inline-flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
    </span>
  );
}

export default LoadingDots;

interface LeadScoreProps {
  score: number;
}

function getScoreBadgeClassName(score: number): string {
  if (score > 80) {
    return "bg-saffron text-white";
  }

  if (score >= 50) {
    return "bg-ember text-ember-text";
  }

  return "bg-parchment text-dust";
}

function getScoreBarWidth(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function LeadScore({ score }: LeadScoreProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[9px] uppercase tracking-[2px] text-dust">
          Lead score
        </div>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${getScoreBadgeClassName(score)}`}
        >
          {score}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-saffron transition-[width] duration-200"
          style={{ width: `${getScoreBarWidth(score)}%` }}
        />
      </div>
    </div>
  );
}

export default LeadScore;

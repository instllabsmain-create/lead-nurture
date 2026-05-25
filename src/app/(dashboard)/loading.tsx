function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-white/70 shadow-[0_14px_40px_rgba(41,28,16,0.04)] ${className}`}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-8 sm:p-10">
      <div className="space-y-3">
        <SkeletonBlock className="h-3 w-28" />
        <SkeletonBlock className="h-10 w-full max-w-xl" />
        <SkeletonBlock className="h-4 w-full max-w-2xl" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="w-full space-y-6 p-6 animate-pulse select-none">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-800/60">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-slate-800/80" />
          <div className="h-4 w-64 rounded bg-slate-800/50" />
        </div>
        <div className="h-9 w-28 rounded bg-slate-800/80" />
      </div>

      {/* Grid Cards / Table Skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-32 rounded-xl border border-slate-800/80 bg-slate-900/30 p-5 space-y-3">
          <div className="h-4 w-1/3 rounded bg-slate-800/80" />
          <div className="h-6 w-1/2 rounded bg-slate-800/80" />
          <div className="h-3.5 w-3/4 rounded bg-slate-800/50" />
        </div>
        <div className="h-32 rounded-xl border border-slate-800/80 bg-slate-900/30 p-5 space-y-3">
          <div className="h-4 w-1/4 rounded bg-slate-800/80" />
          <div className="h-6 w-2/3 rounded bg-slate-800/80" />
          <div className="h-3.5 w-1/2 rounded bg-slate-800/50" />
        </div>
        <div className="h-32 rounded-xl border border-slate-800/80 bg-slate-900/30 p-5 space-y-3 sm:col-span-2 lg:col-span-1">
          <div className="h-4 w-1/2 rounded bg-slate-800/80" />
          <div className="h-6 w-1/3 rounded bg-slate-800/80" />
          <div className="h-3.5 w-2/3 rounded bg-slate-800/50" />
        </div>
      </div>

      {/* Main Body Skeleton */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/20 p-6 space-y-4">
        <div className="h-5 w-36 rounded bg-slate-800/80" />
        <div className="space-y-2.5">
          <div className="h-4 w-full rounded bg-slate-800/50" />
          <div className="h-4 w-full rounded bg-slate-800/50" />
          <div className="h-4 w-3/4 rounded bg-slate-800/40" />
          <div className="h-4 w-2/3 rounded bg-slate-800/40" />
        </div>
      </div>
    </div>
  );
}

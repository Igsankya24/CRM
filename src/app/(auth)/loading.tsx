import { Loader2 } from 'lucide-react';

export default function AuthLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6 bg-slate-950 select-none">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-8 flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
      </div>
    </div>
  );
}

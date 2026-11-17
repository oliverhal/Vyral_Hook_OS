import { Lock } from "lucide-react";

export default function ArtieRestricted() {
  return (
    <div className="flex-1 min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="card p-8 w-full max-w-sm text-center">
        <div className="flex justify-center mb-6"><div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center"><Lock className="w-5 h-5 text-red-500" /></div></div>
        <h1 className="text-lg font-bold text-slate-900 mb-1">Access restricted</h1>
        <p className="text-sm text-slate-400">Artie creator pay data is only available to reviewers. Ask an admin for access.</p>
      </div>
    </div>
  );
}

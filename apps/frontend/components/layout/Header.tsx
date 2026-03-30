'use client';

import { usePreOpStore } from '@/lib/store';

export function Header() {
  const isDemoMode = usePreOpStore((s) => s.isDemoMode);

  return (
    <header className="sticky top-0 z-50 border-b border-clinical-border bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-clinical-text-primary">
            PreOp Intel
          </span>
          <span className="text-xs text-clinical-text-muted">
            Perioperative Risk Intelligence
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isDemoMode && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              Demo Mode
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

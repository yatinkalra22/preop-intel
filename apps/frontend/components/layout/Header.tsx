// App header — sticky, shows app name, demo mode badge, and powered-by info.

'use client';

import { useRouter } from 'next/navigation';
import { usePreOpStore } from '@/lib/store';

export function Header() {
  const router = useRouter();
  const isDemoMode = usePreOpStore((s) => s.isDemoMode);

  return (
    <header className="sticky top-0 z-50 border-b border-clinical-border bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <span className="text-lg font-bold text-clinical-text-primary">
            PreOp Intel
          </span>
          <span className="hidden text-xs text-clinical-text-muted sm:inline">
            Perioperative Risk Intelligence
          </span>
        </button>
        <div className="flex items-center gap-3">
          {isDemoMode && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              Demo Mode
            </span>
          )}
          <span className="hidden text-xs text-clinical-text-muted lg:inline">
            Powered by Claude AI + MCP + A2A
          </span>
        </div>
      </div>
    </header>
  );
}

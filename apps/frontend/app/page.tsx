'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePreOpStore } from '@/lib/store';

export default function LaunchPage() {
  const router = useRouter();
  const enableDemoMode = usePreOpStore((s) => s.enableDemoMode);

  useEffect(() => {
    enableDemoMode();
    router.push('/dashboard');
  }, [router, enableDemoMode]);

  return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-2xl font-bold text-clinical-text-primary">
          PreOp Intel
        </div>
        <p className="animate-pulse text-clinical-text-muted">Loading...</p>
      </div>
    </div>
  );
}

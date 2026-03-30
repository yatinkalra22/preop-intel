'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePreOpStore } from '@/lib/store';

function LaunchContent() {
  const router = useRouter();
  const params = useSearchParams();
  const enableDemoMode = usePreOpStore((s) => s.enableDemoMode);

  useEffect(() => {
    const iss = params.get('iss');
    const launch = params.get('launch');

    if (iss && launch) {
      sessionStorage.setItem('fhir_iss', iss);
      window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/launch?iss=${encodeURIComponent(iss)}&launch=${encodeURIComponent(launch)}`;
    } else {
      enableDemoMode();
      router.push('/dashboard');
    }
  }, [params, router, enableDemoMode]);

  return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-2xl font-bold text-clinical-text-primary">
          PreOp Intel
        </div>
        <p className="animate-pulse text-clinical-text-muted">Launching...</p>
      </div>
    </div>
  );
}

export default function LaunchPage() {
  return (
    <Suspense fallback={<div className="flex h-[80vh] items-center justify-center"><p className="animate-pulse text-clinical-text-muted">Loading...</p></div>}>
      <LaunchContent />
    </Suspense>
  );
}

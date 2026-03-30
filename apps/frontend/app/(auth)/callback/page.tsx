'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePreOpStore } from '@/lib/store';

function CallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const setFhirContext = usePreOpStore((s) => s.setFhirContext);

  useEffect(() => {
    const code = params.get('code');
    if (!code) return;

    const iss = sessionStorage.getItem('fhir_iss') ?? '';
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/callback?code=${code}&iss=${encodeURIComponent(iss)}`)
      .then((res) => res.json())
      .then((data) => {
        setFhirContext(data.accessToken, data.fhirBaseUrl, data.patientId);
        router.push(`/patient/${data.patientId}/assessment`);
      })
      .catch(() => {
        router.push('/dashboard');
      });
  }, [params, router, setFhirContext]);

  return (
    <div className="flex h-[80vh] items-center justify-center">
      <p className="animate-pulse text-clinical-text-muted">Completing authentication...</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="flex h-[80vh] items-center justify-center"><p className="animate-pulse text-clinical-text-muted">Loading...</p></div>}>
      <CallbackContent />
    </Suspense>
  );
}

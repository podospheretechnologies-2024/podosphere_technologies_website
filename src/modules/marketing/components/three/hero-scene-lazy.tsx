'use client';

import { useState, useEffect } from 'react';
import { useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';

const HeroScene = dynamic(() => import('./hero-scene'), {
  ssr: false,
  loading: () => <HeroFallback />,
});

function HeroFallback() {
  return (
    <div className="border-border bg-surface absolute inset-0 flex items-center justify-center rounded-2xl border">
      <div className="text-muted-foreground text-sm">Loading scene…</div>
    </div>
  );
}

/** Loads the WebGL scene only in the browser; static fallback for reduced motion. */
export function HeroSceneLazy() {
  const [mounted, setMounted] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <HeroFallback />;
  }

  return reducedMotion ? <HeroFallback /> : <HeroScene />;
}

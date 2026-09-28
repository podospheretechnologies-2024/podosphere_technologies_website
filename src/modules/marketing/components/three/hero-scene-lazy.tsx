'use client';

import { useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';

const HeroScene = dynamic(() => import('./hero-scene'), {
  ssr: false,
  loading: () => <HeroFallback />,
});

function HeroFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="size-64 rounded-full bg-gradient-to-br from-primary/40 via-ai/30 to-transparent blur-2xl" />
    </div>
  );
}

/** Loads the WebGL scene only in the browser; static fallback for reduced motion. */
export function HeroSceneLazy() {
  const reducedMotion = useReducedMotion();
  return reducedMotion ? <HeroFallback /> : <HeroScene />;
}

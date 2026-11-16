'use client';

import { useEffect, useState } from 'react';
import { HeroSceneLazy } from './three/hero-scene-lazy';

/** Desktop: WebGL scene. Mobile: static product frame (no shrunk 3D). */
export function HeroVisual() {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (!desktop) {
    return (
      <div className="border-border bg-surface relative overflow-hidden rounded-2xl border shadow-sm">
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#E8E8E4]" />
          <span className="size-2.5 rounded-full bg-[#E8E8E4]" />
          <span className="size-2.5 rounded-full bg-[#E8E8E4]" />
          <span className="text-muted-foreground ml-2 text-xs">Podo Social · Calendar</span>
        </div>
        <div className="space-y-3 p-4">
          {['Mon · Diwali offer carousel', 'Wed · WhatsApp broadcast', 'Fri · Meta ads check-in'].map(
            (row) => (
              <div key={row} className="border-border rounded-xl border bg-[#F7F7F5] px-4 py-3">
                <p className="text-sm font-medium">{row}</p>
                <p className="text-muted-foreground mt-1 text-xs">Waiting for approval</p>
              </div>
            )
          )}
          <div className="rounded-xl bg-foreground px-4 py-3 text-sm text-white">
            8 platforms · client workspaces · GST invoices
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[420px] md:h-[560px]">
      <HeroSceneLazy />
    </div>
  );
}

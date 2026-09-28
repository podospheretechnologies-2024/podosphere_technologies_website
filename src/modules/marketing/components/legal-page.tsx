import type { ReactNode } from 'react';
import { legal } from '../config/legal';

interface LegalPageProps {
  title: string;
  intro: ReactNode;
  children: ReactNode;
}

/** Shared layout for the Privacy, Terms and Data deletion pages. */
export function LegalPage({ title, intro, children }: LegalPageProps) {
  return (
    <article className="mx-auto max-w-3xl px-6 pt-32 pb-24">
      <p className="text-primary text-sm font-medium">{legal.product}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">Last updated: {legal.lastUpdated}</p>
      <div className="text-muted-foreground mt-6 text-base leading-relaxed">{intro}</div>
      <div className="[&_h2]:text-foreground [&_li]:text-muted-foreground [&_p]:text-muted-foreground mt-10 space-y-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:mt-3 [&_p]:leading-relaxed [&_section>ol]:mt-3 [&_section>ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
      <footer className="border-border text-muted-foreground mt-16 border-t pt-6 text-sm">
        {legal.company} · {legal.address} · {legal.contactEmail}
      </footer>
    </article>
  );
}

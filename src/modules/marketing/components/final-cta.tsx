import Link from 'next/link';
import { legal } from '../config/legal';

export function FinalCta({
  title = 'Ready to run client social from one desk?',
  text = 'Create a workspace in a minute. Connect channels, invite your team, and keep every approval in one queue.',
}: {
  title?: string;
  text?: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="border-border bg-foreground text-background rounded-3xl border px-8 py-14 text-center md:px-16">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/70 md:text-base">
          {text}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90"
          >
            Start free
          </Link>
          <a
            href={legal.whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/20 px-6 py-3 text-sm font-medium hover:bg-white/10"
          >
            Book a WhatsApp demo
          </a>
        </div>
      </div>
    </section>
  );
}

import Link from 'next/link';
import {
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  Inbox,
  Megaphone,
  PenLine,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import { HeroSceneLazy } from '@/modules/marketing/components/three/hero-scene-lazy';
import { Reveal, Stagger, StaggerItem } from '@/shared/components/motion/reveal';

const features = [
  { icon: PenLine, title: 'Write & publish everywhere', text: 'One composer for Facebook, Instagram, LinkedIn, YouTube and Google Business Profile, with captions tailored to each platform.' },
  { icon: CalendarClock, title: 'Calendar autopilot', text: 'Podo AI plans next week from your brand kit and last month’s best posts. You approve, it schedules.' },
  { icon: Inbox, title: 'Unified inbox', text: 'Comments, DMs, WhatsApp chats and reviews in one place. AI labels, prioritises and drafts every reply.' },
  { icon: Target, title: 'Leads that score themselves', text: 'Meta and LinkedIn lead forms flow in, get scored 0–100 with reasons, and sync to PodoCRM.' },
  { icon: Megaphone, title: 'Ads that watch themselves', text: 'Daily spend, CTR and fatigue checks. Pause/budget suggestions wait for your approval, never auto-applied.' },
  { icon: BarChart3, title: 'Reports clients read', text: 'Weekly and monthly performance reports written in plain language: wins, losses, next steps.' },
];

const steps = [
  { title: 'Connect', text: 'Link Pages, Instagram, WhatsApp and ad accounts in a few clicks.' },
  { title: 'Teach', text: 'Fill in the brand kit: voice, audience, words to avoid, FAQs.' },
  { title: 'Approve', text: 'Podo AI drafts posts, replies and ad changes. You approve with one click.' },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(97,43,211,0.18),transparent_60%)]" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-2">
          <div>
            <Reveal>
              <span className="border-border bg-surface text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
                <Bot className="size-3.5" /> Meet Podo AI, your social media marketing agent
              </span>
            </Reveal>
            <Reveal delay={0.1}>
              <h1 className="mt-6 text-5xl leading-[1.05] font-semibold tracking-tight md:text-6xl">
                Social media that <span className="from-primary to-ai bg-gradient-to-r bg-clip-text text-transparent">runs itself</span>, with you in control.
              </h1>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                Podo AI plans content, writes on-brand posts, answers your inbox, scores leads and watches your
                ads across every platform. Nothing goes live without your approval.
              </p>
            </Reveal>
            <Reveal delay={0.3} className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="bg-primary text-primary-foreground rounded-xl px-6 py-3 font-medium shadow-lg shadow-primary/30 hover:opacity-90"
              >
                Start free
              </Link>
              <Link href="#agent" className="border-border bg-surface hover:bg-surface-muted rounded-xl border px-6 py-3 font-medium">
                See how it works
              </Link>
            </Reveal>
          </div>
          <div className="relative h-[420px] md:h-[560px]">
            <HeroSceneLazy />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-28">
        <Reveal className="max-w-2xl">
          <h2 className="text-4xl font-semibold tracking-tight">Everything an agency does, now faster.</h2>
          <p className="mt-4 text-muted-foreground">Built for agencies managing many clients, Pages and ad accounts.</p>
        </Reveal>
        <Stagger className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <StaggerItem key={f.title} className="border-border bg-surface group rounded-2xl border p-6 transition hover:-translate-y-1 hover:border-primary">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/20">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Agent */}
      <section id="agent" className="relative py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(216,45,126,0.10),transparent_65%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-4xl font-semibold tracking-tight">
              An agent that works like <span className="from-primary to-ai bg-gradient-to-r bg-clip-text text-transparent">your best marketer</span>.
            </h2>
            <ol className="mt-10 space-y-6">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={0.15} className="border-border bg-surface rounded-3xl border p-6 shadow-xl">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="size-4 text-ai" /> Podo AI · Approval queue
            </div>
            <div className="mt-5 space-y-3">
              {[
                ['Instagram post for Tue 7:30 PM', 'Diwali offer carousel, 3 captions drafted'],
                ['Reply to comment on “Seed Funding”', '“Thanks! DM us your city and we’ll share the details.”'],
                ['Pause ad set “Retargeting 30d”', 'CTR fell 42% in 5 days: creative fatigue'],
              ].map(([title, text]) => (
                <div key={title} className="border-border bg-background rounded-2xl border p-4">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                  <div className="mt-3 flex gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-success/15 text-success px-2 py-1">
                      <CheckCircle2 className="size-3.5" /> Approve
                    </span>
                    <span className="bg-surface-muted text-muted-foreground rounded-lg px-2 py-1">Edit</span>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <Stagger className="grid gap-5 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'You stay in control', text: 'Approval queue for anything public or paid. Full audit log.' },
            { icon: Users, title: 'Built for agencies', text: 'Workspaces per client, brand kits, and a client API.' },
            { icon: Bot, title: 'Powered by Claude', text: 'Anthropic’s Claude writes, reasons and analyses behind the scenes.' },
          ].map((t) => (
            <StaggerItem key={t.title} className="border-border rounded-2xl border p-6">
              <t.icon className="size-5 text-ai" />
              <h3 className="mt-4 font-semibold">{t.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </>
  );
}

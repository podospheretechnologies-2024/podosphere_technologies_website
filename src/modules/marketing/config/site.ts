import { legal } from './legal';

export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
  'https://social.podospheretechnologies.com';

export const API_BASE_URL = `${SITE_URL}/api/v1`;

export const PLATFORMS = [
  'Facebook',
  'Instagram',
  'Threads',
  'LinkedIn',
  'YouTube',
  'Pinterest',
  'Google Business Profile',
  'WhatsApp',
] as const;

export const PRODUCT_NAV = [
  { href: '/features/publish', label: 'Publish' },
  { href: '/features/inbox', label: 'Engage' },
  { href: '/features/growth-desk', label: 'Grow' },
  { href: '/features/ads', label: 'Ads' },
  { href: '/features/reports', label: 'Reports' },
  { href: '/features/client-portal', label: 'Client portal' },
] as const;

export const FEATURE_PILLARS = [
  {
    href: '/features/publish',
    title: 'Publish',
    text: 'Compose, schedule and evergreen posts across eight platforms, with CSV bulk and a festival calendar.',
  },
  {
    href: '/features/ai',
    title: 'Podo AI',
    text: 'Drafts, brand kits, weekly plans and a Copilot that waits for your approval before acting.',
  },
  {
    href: '/features/inbox',
    title: 'Inbox & WhatsApp',
    text: 'FB/IG comments and DMs plus WhatsApp chats, broadcasts and keyword auto-replies in one place.',
  },
  {
    href: '/features/leads',
    title: 'Leads',
    text: 'Meta and LinkedIn forms in, AI score 0–100 with reasons, pipeline, push to PodoCRM.',
  },
  {
    href: '/features/ads',
    title: 'Ads & Growth',
    text: 'Meta + Google Ads readouts, fatigue watch, and a per-client Growth Desk with Shopify and GA4.',
  },
  {
    href: '/features/client-portal',
    title: 'Reports & Client portal',
    text: 'PDF reports clients actually read, plus a white-label portal where each client sees only their data.',
  },
] as const;

export const FAQ_ITEMS = [
  {
    q: 'Which platforms are supported?',
    a: `Facebook, Instagram, Threads, LinkedIn, YouTube, Pinterest, Google Business Profile and WhatsApp — ${PLATFORMS.length} surfaces in one workspace.`,
  },
  {
    q: 'Does anything go live without my approval?',
    a: 'No. Posts, replies and ad change suggestions sit in an approval queue until you approve or edit them.',
  },
  {
    q: 'Can my clients log in?',
    a: 'Yes. The client portal supports email + password or a magic link. Each client only sees their own channels, ads, leads and reports.',
  },
  {
    q: "Is my clients' data separate?",
    a: 'Yes. Every query is scoped per client and organisation. Team members can be limited to assigned clients.',
  },
  {
    q: 'Do you support WhatsApp broadcasts? What does it cost?',
    a: 'Yes — templates, broadcasts with a per-message cost estimate, and keyword auto-replies. Meta template messages are billed separately at Meta’s rate (we show an estimate around ₹0.80/msg in the product).',
  },
  {
    q: 'Can I use my own domain and brand?',
    a: 'Agency plans support white-label portal title, brand colour and a custom domain for the client portal.',
  },
  {
    q: 'Do you have an API?',
    a: 'Yes on Agency Pro: posts, analytics, leads and WhatsApp send under /api/v1 with per-key permissions and IP allowlists.',
  },
  {
    q: 'Which AI do you use?',
    a: 'Claude by Anthropic powers captions, triage, lead scores and report narratives. Usage is tracked per client.',
  },
  {
    q: 'Do you give GST invoices?',
    a: 'Yes. Razorpay checkout in INR with GST invoices (CGST/SGST or IGST split) for Indian agencies.',
  },
  {
    q: 'How do I get support?',
    a: `WhatsApp (${legal.whatsappNumber}) or ${legal.contactEmail}. ${legal.supportHours}.`,
  },
] as const;

export const INDIA_EDGE = [
  {
    title: 'WhatsApp built in',
    text: 'Inbox, templates, broadcasts and keyword auto-replies — not a bolted-on chat widget.',
  },
  {
    title: 'India festival calendar',
    text: 'Plan Diwali, Holi, Eid and regional festivals alongside your usual content calendar.',
  },
  {
    title: '₹ pricing via Razorpay',
    text: 'Plans billed in INR. No USD surprise for Indian agencies.',
  },
  {
    title: 'GST invoices',
    text: 'CGST/SGST or IGST split printed on invoices your clients and finance teams expect.',
  },
] as const;

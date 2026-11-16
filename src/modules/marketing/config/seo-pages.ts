export const FOR_PAGES = {
  agencies: {
    slug: 'agencies',
    title: 'For agencies',
    headline: 'Run every client’s social from one Indian agency desk',
    description:
      'Client workspaces, approvals, WhatsApp, ads, Growth Desk and a white-label portal — built for multi-client agencies.',
    points: [
      'Client switcher, templates and Owner / Admin / Member roles',
      'Approval queue so juniors draft and seniors ship',
      'WhatsApp broadcasts and Meta/Google ads in the same login',
      'Client portal with per-client tab visibility',
    ],
  },
  'd2c-brands': {
    slug: 'd2c-brands',
    title: 'For D2C brands',
    headline: 'Content, ads and Shopify growth in one loop',
    description:
      'Publish across platforms, watch Meta and Google ads, and connect Shopify + GA4 in Growth Desk.',
    points: [
      'Calendar + evergreen for always-on offers',
      'Growth Desk: ROAS, sessions, purchases and daily AI insights',
      'Inbox and WhatsApp for post-purchase and community',
      'Reports your founder can skim on Monday morning',
    ],
  },
  'coaching-institutes': {
    slug: 'coaching-institutes',
    title: 'For coaching institutes',
    headline: 'Leads from Meta forms to PodoCRM without the spreadsheet mess',
    description:
      'Score inbound leads, reply from one inbox, and keep counselling WhatsApp chats organised.',
    points: [
      'Meta + LinkedIn lead forms with AI score 0–100',
      'WhatsApp templates and keyword auto-replies',
      'Batch schedule course launches with CSV bulk',
      'Client portal if you run multiple institute brands',
    ],
  },
  'local-business': {
    slug: 'local-business',
    title: 'For local business',
    headline: 'Google Business Profile, WhatsApp and local festivals covered',
    description:
      'Post to GBP and social, answer WhatsApp, and plan around Indian festivals without a big team.',
    points: [
      'GBP + Facebook/Instagram in one composer',
      'India festival calendar for offers',
      'WhatsApp inbox for walk-ins and orders',
      'Solo plan priced for smaller teams',
    ],
  },
} as const;

export type ForSlug = keyof typeof FOR_PAGES;

export const COMPARE_PAGES = {
  buffer: {
    slug: 'buffer',
    title: 'Podo Social vs Buffer',
    headline: 'Buffer vs Podo Social',
    description:
      'Honest comparison: Buffer is strong at scheduling; Podo Social adds WhatsApp, GST billing, client portal and Growth Desk for Indian agencies.',
    rows: [
      ['Primary focus', 'Scheduling & analytics', 'Agency desk: publish, WhatsApp, ads, portal'],
      ['WhatsApp inbox & broadcasts', 'Not core', 'Built in'],
      ['Client portal / white-label', 'Limited / add-ons', 'Included on agency plans'],
      ['INR + GST invoices', 'USD-centric', 'Razorpay + GST'],
      ['Meta + Google Ads desk', 'Separate tools', 'In-product (Growth / Ads)'],
      ['Public API', 'Yes', 'Agency Pro'],
    ] as [string, string, string][],
  },
  hootsuite: {
    slug: 'hootsuite',
    title: 'Podo Social vs Hootsuite',
    headline: 'Hootsuite vs Podo Social',
    description:
      'Hootsuite is a mature enterprise suite. Podo Social is priced and shaped for Indian multi-client agencies with WhatsApp and GST.',
    rows: [
      ['Best fit', 'Enterprise / global teams', 'Indian agencies & multi-brand ops'],
      ['WhatsApp', 'Integrations / partners', 'Native inbox, templates, broadcasts'],
      ['Pricing currency', 'USD tiers', 'INR plans + GST invoice'],
      ['Client portal', 'Add-on ecosystems', 'First-class portal tabs'],
      ['Growth / Shopify / GA4', 'Via integrations', 'Growth Desk in-product'],
      ['Learning curve', 'Broad suite', 'Agency-shaped workflows'],
    ] as [string, string, string][],
  },
  later: {
    slug: 'later',
    title: 'Podo Social vs Later',
    headline: 'Later vs Podo Social',
    description:
      'Later excels at visual Instagram planning. Podo Social covers full agency ops including WhatsApp, leads, ads and reporting.',
    rows: [
      ['Strength', 'Visual IG / TikTok calendar', 'Multi-client agency operations'],
      ['Platforms', 'Strong on visual networks', 'FB, IG, Threads, LI, YT, Pinterest, GBP, WA'],
      ['WhatsApp & leads', 'Not the focus', 'Inbox, broadcasts, scored leads'],
      ['Ads & ROAS', 'Limited', 'Meta + Google + Growth Desk'],
      ['Client approvals', 'Basic', 'Portal + approval queue'],
      ['India billing', 'USD', 'Razorpay INR + GST'],
    ] as [string, string, string][],
  },
} as const;

export type CompareSlug = keyof typeof COMPARE_PAGES;

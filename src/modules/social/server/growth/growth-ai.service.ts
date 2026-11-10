import 'server-only';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { askAI } from '../ai/claude.client';
import { getSettings, overview } from './growth.service';
import { dayToDate, localDay } from './growth-metrics';
import { adPlanService, blogsService, insightsService } from './records.service';
import { tasksService, TASK_AREAS } from './tasks.service';
import type { GrowthClient } from './growth-scope';

/**
 * Every AI call on the Growth Desk. Shared rules: use ONLY facts in the context, never invent
 * offers / discount codes / prices / reviews / results, no medical or before/after claims, never
 * copy competitors or use celebrity names. The desk only guides; it changes nothing by itself.
 */
const RULES = [
  'Use only facts given in CONTEXT about the business and its numbers. Never invent offers, discount codes, prices, reviews, stock or results.',
  'No medical or cure claims and no before/after promises. Do not copy other brands\' ads or use celebrity names.',
  'Write plainly, like an experienced marketer briefing a small team in India. Short sentences.',
  'This is guidance for people. Nothing you write is published or changed automatically.',
].join('\n');

const areaEnum = z.enum(TASK_AREAS);
const taskSchema = z.object({
  title: z.string(),
  detail: z.string(),
  area: areaEnum,
  priority: z.enum(['high', 'med', 'low']),
});

async function buildContext(gc: GrowthClient): Promise<string> {
  const { organizationId, customerId } = gc;
  const [settings, last30, last7, changes, openTasks, adPlan, blogs, snapshot, posts, competitors] = await Promise.all([
    getSettings(organizationId, customerId),
    overview(gc, { preset: '30d', from: null, to: null }),
    overview(gc, { preset: '7d', from: null, to: null }),
    prisma.socialChangeLog.findMany({
      where: { organizationId, customerId, createdAt: { gte: new Date(Date.now() - 21 * 86400000) } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.socialTask.findMany({
      where: { organizationId, customerId, status: { in: ['todo', 'review'] } },
      select: { title: true, area: true, status: true },
      take: 40,
    }),
    prisma.socialAdPlanItem.findMany({
      where: { organizationId, customerId },
      select: { adName: true, headline: true, status: true, campaignName: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.socialBlog.findMany({
      where: { organizationId, customerId },
      select: { title: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.shopifyTrafficSnapshot.findFirst({ where: { organizationId, customerId }, orderBy: { createdAt: 'desc' } }),
    prisma.socialIntegration
      .findMany({ where: { organizationId, customerId, deletedAt: null }, select: { id: true } })
      .then((integrations) =>
        prisma.socialExternalPost.findMany({
      where: { integrationId: { in: integrations.map((i) => i.id) } },
      orderBy: { publishedAt: 'desc' },
      take: 25,
      select: { type: true, caption: true, publishedAt: true, reach: true, likes: true, comments: true, shares: true, saves: true, videoViews: true, engagementRate: true },
        })
      ),
    prisma.socialCompetitor.findMany({ where: { organizationId, customerId }, select: { name: true, platform: true }, take: 10 }),
  ]);

  const kpi = (o: Awaited<ReturnType<typeof overview>>) => ({
    period: `${o.range.from} to ${o.range.to}`,
    shopify_sales: o.totals.sales,
    orders: o.totals.orders,
    aov: o.totals.aov,
    sessions: o.totals.sessions,
    add_to_cart_sessions: o.totals.atc,
    meta_spend: o.totals.spend,
    roas_shopify_sales_over_meta_spend: o.totals.roas,
    meta_reported_purchases: o.totals.metaPurchases,
    meta_reported_revenue: o.totals.metaRevenue,
    meta_reported_roas: o.totals.metaRoas,
  });

  const context = {
    client: gc.customerName,
    today: localDay(new Date(), last30.store.timeZone ?? 'Asia/Kolkata'),
    store: last30.store.connected ? { url: last30.store.primaryUrl, currency: last30.store.currency } : 'not connected',
    brand_facts: settings.brandContext ?? '(none given)',
    goals: { target_roas: settings.targetRoas, daily_budget: settings.dailyBudget, budget_cap: settings.budgetCap },
    last_7_days: kpi(last7),
    last_30_days: kpi(last30),
    campaigns_last_30_days: last30.campaigns.slice(0, 15).map((c) => ({
      name: c.name,
      status: c.status,
      objective: c.objective,
      spend: c.spend,
      purchases: c.purchases,
      revenue: c.revenue,
      roas: c.roas,
      ctr: c.ctr == null ? null : Math.round(c.ctr * 10000) / 100,
      add_to_cart: c.atc,
    })),
    website: snapshot
      ? {
          period: `${snapshot.periodStart.toISOString().slice(0, 10)} to ${snapshot.periodEnd.toISOString().slice(0, 10)}`,
          sessions: snapshot.sessions,
          add_to_cart: snapshot.addToCart,
          orders: snapshot.orders,
          landing_pages: snapshot.landing,
          sources: snapshot.sources,
          devices: snapshot.devices,
        }
      : 'no traffic data',
    recent_changes: changes.map((c) => ({ when: c.createdAt.toISOString().slice(0, 10), where: c.place, what: c.what, why: c.why })),
    open_tasks: openTasks,
    ad_plan: adPlan,
    blogs,
    recent_posts: posts.map((p) => ({
      type: p.type,
      date: p.publishedAt.toISOString().slice(0, 10),
      caption: (p.caption ?? '').slice(0, 120),
      reach: p.reach,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      plays: p.videoViews,
      engagement_rate: p.engagementRate?.toNumber() ?? null,
    })),
    competitors,
  };
  return JSON.stringify(context);
}

// ---------------- daily insights + tasks ----------------

const insightsSchema = z.object({
  insights: z.array(
    z.object({ severity: z.enum(['good', 'warn', 'bad', 'info']), title: z.string(), body: z.string() })
  ),
  tasks: z.array(taskSchema),
});

export async function generateInsights(gc: GrowthClient) {
  const context = await buildContext(gc);
  const result = await askAI({
    scope: gc.scope,
    feature: 'growth-insights',
    schema: insightsSchema,
    effort: 'medium',
    task: [
      'You are the performance-marketing assistant for this e-commerce client.',
      'Read CONTEXT and write 3 to 6 findings for today, each with a number from the data. Compare the last 7 days with the 30-day picture and with the ROAS target.',
      'Look at: ROAS vs target, campaigns wasting spend (spend with no purchases), cart rate and order rate, landing pages with traffic but no carts, recent changes and whether they helped, content that performed well.',
      'Then write 2 to 6 concrete tasks for today (who does what, where). Do not repeat any title already in open_tasks.',
      'If data is missing (store not connected, no ads), say so as an "info" finding and make a task to fix that.',
      RULES,
    ].join('\n'),
    input: context,
  });

  const settings = await prisma.socialGrowthSettings.findUnique({ where: { customerId: gc.customerId }, select: { id: true } });
  const today = localDay(new Date(), 'Asia/Kolkata');
  await prisma.$transaction([
    prisma.socialGrowthInsight.deleteMany({
      where: { organizationId: gc.organizationId, customerId: gc.customerId, date: dayToDate(today) },
    }),
    prisma.socialGrowthInsight.createMany({
      data: result.insights.slice(0, 8).map((i) => ({
        organizationId: gc.organizationId,
        customerId: gc.customerId,
        date: dayToDate(today),
        severity: i.severity,
        title: i.title.slice(0, 255),
        body: i.body,
      })),
    }),
  ]);
  let tasksAdded = 0;
  for (const [index, task] of result.tasks.slice(0, 8).entries()) {
    if (
      await tasksService.ensureGenerated(gc.organizationId, gc.customerId, `insight:${today}:${index}`, {
        source: 'bot',
        area: task.area,
        priority: task.priority,
        title: task.title,
        detail: task.detail,
        dueDate: today,
      })
    )
      tasksAdded += 1;
  }
  if (settings) {
    await prisma.socialGrowthSettings.update({ where: { id: settings.id }, data: { lastInsightsAt: new Date() } });
  } else {
    await prisma.socialGrowthSettings.create({
      data: { organizationId: gc.organizationId, customerId: gc.customerId, lastInsightsAt: new Date() },
    });
  }
  return { insights: await insightsService.list(gc.organizationId, gc.customerId), tasksAdded };
}

// ---------------- campaign plan ----------------

const adPlanSchema = z.object({
  ads: z.array(
    z.object({
      campaignName: z.string(),
      objective: z.string(),
      budgetNote: z.string(),
      adsetName: z.string(),
      audience: z.string(),
      adName: z.string(),
      format: z.string(),
      hook: z.string(),
      primaryText: z.string(),
      headline: z.string(),
      description: z.string(),
      cta: z.string(),
      landingPage: z.string(),
      product: z.string(),
      placements: z.string(),
      imageNote: z.string(),
      rationale: z.string(),
    })
  ),
});

export async function generateAdPlan(gc: GrowthClient, brief: string | null) {
  const context = await buildContext(gc);
  const result = await askAI({
    scope: gc.scope,
    feature: 'growth-ad-plan',
    schema: adPlanSchema,
    effort: 'high',
    task: [
      'Propose 3 to 6 new Meta ads for this client, grouped as campaign -> ad set -> ad, for the owner to approve.',
      'Use clear naming like "Sales | Retargeting | Winter Trio | Carousel". Keep the daily budget and cap in mind (goals).',
      'Each ad: format, hook, primary text (under 125 words), headline (under 40 characters), description, CTA, landing page (only a URL that appears in CONTEXT or the store URL; otherwise leave it empty), audience, placements, what image or video to use, and why this ad (with numbers from CONTEXT).',
      'Do not repeat ads already in ad_plan.',
      brief ? `The owner asked for: ${brief}` : '',
      RULES,
    ].join('\n'),
    input: context,
  });
  const valid = result.ads.filter((a) => a.campaignName && a.adsetName && a.adName).slice(0, 8);
  const cleaned = valid.map((a) => ({ ...a, landingPage: /^https:\/\//.test(a.landingPage) ? a.landingPage : null }));
  return adPlanService.createMany(gc.organizationId, gc.customerId, cleaned, 'bot');
}

// ---------------- blogs ----------------

const blogIdeasSchema = z.object({
  ideas: z.array(z.object({ title: z.string(), angle: z.string(), keywords: z.string() })),
});

export async function generateBlogIdeas(gc: GrowthClient) {
  const settings = await getSettings(gc.organizationId, gc.customerId);
  const context = await buildContext(gc);
  const result = await askAI({
    scope: gc.scope,
    feature: 'growth-blog-ideas',
    schema: blogIdeasSchema,
    effort: 'medium',
    task: [
      `Suggest ${settings.blogsPerMonth} SEO blog topics for this store's blog for the coming month: questions shoppers in India search for now (season, festivals, weddings, routines).`,
      'Each: a clear title, the angle (who it helps and which store products or categories it can link to, only ones known from CONTEXT), and 3-6 comma-separated keywords.',
      'Do not repeat titles already in blogs.',
      RULES,
    ].join('\n'),
    input: context,
  });
  return blogsService.createIdeas(gc.organizationId, gc.customerId, result.ideas.slice(0, 10));
}

const blogDraftSchema = z.object({
  title: z.string(),
  slug: z.string(),
  metaDescription: z.string(),
  keywords: z.string(),
  bodyHtml: z.string(),
  productLinks: z.array(z.object({ text: z.string(), url: z.string() })),
});

export async function writeBlogDraft(gc: GrowthClient, blogId: string) {
  const blog = await blogsService.get(gc.organizationId, gc.customerId, blogId);
  if (blog.status === 'published') throw new HttpError(409, 'This blog is already published.');
  const context = await buildContext(gc);
  const result = await askAI({
    scope: gc.scope,
    feature: 'growth-blog-draft',
    schema: blogDraftSchema,
    effort: 'high',
    task: [
      'Write an SEO blog post for this store\'s Shopify blog.',
      `Topic: ${blog.title}`,
      blog.angle ? `Angle: ${blog.angle}` : '',
      blog.keywords ? `Keywords: ${blog.keywords}` : '',
      blog.feedback ? `The owner asked for these changes on the last draft: ${blog.feedback}` : '',
      'Length 900 to 1300 words. bodyHtml uses only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <a href>. No <h1> (Shopify adds the title). Helpful, honest, easy to read; end with a short FAQ (3 questions).',
      'Link to the store only with URLs known from CONTEXT (store url). List those links in productLinks too. slug: lowercase-with-dashes. metaDescription under 155 characters.',
      RULES,
    ].join('\n'),
    input: context,
  });
  const safeLinks = result.productLinks.filter((l) => /^https:\/\//.test(l.url)).slice(0, 12);
  const slug = result.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 200);
  const bodyHtml = result.bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '');
  return blogsService.saveDraft(blogId, { ...result, slug, bodyHtml, productLinks: safeLinks });
}

// ---------------- idea box ----------------

const briefSchema = z.object({
  title: z.string(),
  summary: z.string(),
  ideas: z.array(z.string()),
  creative: z.string(),
  script: z.string(),
  copy: z.array(z.object({ label: z.string(), text: z.string() })),
  tasks: z.array(z.object({ title: z.string(), detail: z.string(), area: areaEnum })),
});

export async function runBrief(gc: GrowthClient, area: string, ask: string, userId: string) {
  let output: z.infer<typeof briefSchema> | null = null;
  let error: string | null = null;
  try {
    const context = await buildContext(gc);
    output = await askAI({
      scope: gc.scope,
      feature: 'growth-brief',
      schema: briefSchema,
      effort: 'medium',
      task: [
        `The owner typed a rough idea or question for the area "${area}". Turn it into a worked brief the team can act on today.`,
        'Build on the owner\'s idea rather than replacing it. Give: a short title, a 2-3 sentence summary, 3-5 sharper ideas, creative direction, a script if it is a video/reel (else empty), ready copy pieces (caption, ad text, headline, etc.) and 2-6 tasks for the team.',
        RULES,
      ].join('\n'),
      input: `CONTEXT:\n${context}\n\nOWNER'S IDEA:\n${ask}`,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : 'The AI is not available right now.';
  }
  const row = await prisma.socialBrief.create({
    data: {
      organizationId: gc.organizationId,
      customerId: gc.customerId,
      area: area.slice(0, 40),
      ask,
      output: output ?? undefined,
      createdById: userId,
    },
  });
  return { id: row.id, area: row.area, ask: row.ask, output, tasksAdded: false, createdAt: row.createdAt.toISOString(), error };
}

// ---------------- content ideas (from post results) ----------------

const contentIdeasSchema = z.object({
  ideas: z.array(z.object({ title: z.string(), type: z.string(), description: z.string(), products: z.string(), why: z.string() })),
});

export async function generateContentIdeas(gc: GrowthClient, userId: string) {
  const context = await buildContext(gc);
  const result = await askAI({
    scope: gc.scope,
    feature: 'growth-content-ideas',
    schema: contentIdeasSchema,
    effort: 'medium',
    task: [
      'Propose 6 new Instagram/Facebook content ideas for the next two weeks.',
      'Favour the formats and topics with the best engagement rate in recent_posts; if there are no results yet, say so in each "why" and base ideas on the store and website data.',
      'type is one of: Reel, Carousel, Static post, Story. products: only products/categories known from CONTEXT, else "brand-level".',
      RULES,
    ].join('\n'),
    input: context,
  });
  const row = await prisma.socialBrief.create({
    data: {
      organizationId: gc.organizationId,
      customerId: gc.customerId,
      area: 'content-ideas',
      ask: 'Content ideas from results',
      output: {
        title: 'Content ideas from results',
        summary: '',
        ideas: [],
        creative: '',
        script: '',
        copy: [],
        contentIdeas: result.ideas,
        tasks: result.ideas.map((i) => ({
          title: `Create ${i.type}: ${i.title}`.slice(0, 255),
          detail: `${i.description}\nProducts: ${i.products}\nWhy: ${i.why}`,
          area: i.type.toLowerCase().includes('reel') ? 'video' : 'design',
        })),
      },
      createdById: userId,
    },
  });
  return { id: row.id, ideas: result.ideas };
}

// ---------------- video ideas ----------------

const videoSchema = z.object({
  videos: z.array(
    z.object({
      title: z.string(),
      length: z.string(),
      hook: z.string(),
      tool: z.string(),
      product: z.string(),
      landingPage: z.string(),
      prompts: z.array(z.object({ label: z.string(), text: z.string() })),
    })
  ),
});

export async function generateVideoIdeas(gc: GrowthClient) {
  const context = await buildContext(gc);
  const result = await askAI({
    scope: gc.scope,
    feature: 'growth-video-ideas',
    schema: videoSchema,
    effort: 'high',
    task: [
      'Write 3 short AI-video ideas (Reels/ads, 15-30 seconds) for this client.',
      'Each: title, length, hook (the first line said or shown), tool (e.g. "Gemini / Google Flow (Veo)"), product, landing page (only a URL known from CONTEXT, else empty) and 4-7 ordered prompts.',
      'Each prompt is ready to paste into the video tool: scene, camera, lighting, on-screen text, and when to attach the real product photo ("Attach the product photo"). Keep products realistic; no celebrity likeness.',
      RULES,
    ].join('\n'),
    input: context,
  });
  const created = [];
  for (const v of result.videos.slice(0, 5)) {
    const row = await prisma.socialVideoIdea.create({
      data: {
        organizationId: gc.organizationId,
        customerId: gc.customerId,
        title: v.title.slice(0, 255),
        length: v.length.slice(0, 40),
        hook: v.hook,
        tool: v.tool.slice(0, 120),
        product: v.product.slice(0, 255),
        landingPage: /^https:\/\//.test(v.landingPage) ? v.landingPage.slice(0, 2048) : null,
        prompts: v.prompts.slice(0, 10),
      },
    });
    created.push(row.id);
  }
  return { created: created.length };
}

// ---------------- 15-day report ----------------

const reportSchema = z.object({
  summary: z.string(),
  insights: z.array(z.string()),
  poa: z.array(z.object({ phase: z.string(), dates: z.string(), focus: z.string(), actions: z.array(z.string()) })),
  targets: z.array(z.string()),
});

export async function generateGrowthReport(gc: GrowthClient) {
  const settings = await getSettings(gc.organizationId, gc.customerId);
  const days = settings.reportEveryDays;
  const store = await prisma.socialShopifyStore.findFirst({
    where: { organizationId: gc.organizationId, customerId: gc.customerId },
    select: { timeZone: true },
  });
  const tz = store?.timeZone ?? 'Asia/Kolkata';
  const to = localDay(new Date(), tz);
  const fromDate = new Date(`${to}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
  const from = fromDate.toISOString().slice(0, 10);
  const period = await overview(gc, { preset: 'custom', from, to });

  const doneTasks = await prisma.socialTask.findMany({
    where: {
      organizationId: gc.organizationId,
      customerId: gc.customerId,
      status: { in: ['done', 'review'] },
      doneAt: { gte: dayToDate(from) },
    },
    select: { title: true, doneNote: true },
    take: 60,
  });
  const done = doneTasks.map((t) => (t.doneNote ? `${t.title} — ${t.doneNote}` : t.title));
  const kpis = {
    sales: period.totals.sales,
    orders: period.totals.orders,
    aov: period.totals.aov,
    sessions: period.totals.sessions,
    spend: period.totals.spend,
    roas: period.totals.roas,
    metaRoas: period.totals.metaRoas,
    metaPurchases: period.totals.metaPurchases,
    targetRoas: settings.targetRoas,
  };

  let out: z.infer<typeof reportSchema>;
  let by = 'ai';
  try {
    const context = await buildContext(gc);
    out = await askAI({
      scope: gc.scope,
      feature: 'growth-report',
      schema: reportSchema,
      effort: 'high',
      task: [
        `Write a ${days}-day Meta ads and website performance report for the client, period ${from} to ${to}.`,
        'Use ONLY the numbers in PERIOD_KPIS and CONTEXT; never invent figures. Say plainly where performance stands against the ROAS target.',
        'summary: max 60 words. insights: 5 to 8, each with a number. poa: plan for the next 30 days in 3 phases (Week 1, Week 2, Weeks 3-4) with dates and 3-6 specific actions each. targets: 3-5 measurable targets for the next period.',
        RULES,
      ].join('\n'),
      input: `PERIOD_KPIS:\n${JSON.stringify(kpis)}\n\nWORK_DONE:\n${JSON.stringify(done)}\n\nCONTEXT:\n${context}`,
    });
  } catch {
    by = 'numbers';
    const insights = await insightsService.list(gc.organizationId, gc.customerId);
    out = {
      summary: 'Numbers-only report: the AI writer was not available, so insights are copied from the desk.',
      insights: insights.slice(0, 8).map((i) => `${i.title}: ${i.body}`),
      poa: [],
      targets: [`Reach the ${settings.targetRoas}x ROAS target on Shopify sales ÷ Meta spend`],
    };
  }

  const row = await prisma.socialGrowthReport.create({
    data: {
      organizationId: gc.organizationId,
      customerId: gc.customerId,
      title: `${days}-day report`,
      periodStart: dayToDate(from),
      periodEnd: dayToDate(to),
      kpis,
      summary: out.summary,
      insights: out.insights,
      done,
      poa: out.poa,
      targets: out.targets,
      by,
    },
  });
  return { id: row.id };
}

/** Worker helper: GrowthClient from stored ids. */
export async function growthClientForWorker(scope: ClientScope, customerName: string): Promise<GrowthClient> {
  const customerId = scope.customerIds === 'all' ? '' : scope.customerIds[0];
  return { scope, organizationId: scope.organizationId, customerId, customerName };
}

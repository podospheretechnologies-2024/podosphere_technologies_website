import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import type { Prisma } from '@/generated/prisma/client';
import { tasksService } from './tasks.service';
import { createArticle, listBlogs } from './shopify.client';
import { resolveStoreToken } from './shopify.service';

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;
const dec = (v: { toNumber(): number } | null | undefined) => (v == null ? null : v.toNumber());

// ---------------- change log ----------------

export const changeLogService = {
  async list(organizationId: string, customerId: string) {
    const rows = await prisma.socialChangeLog.findMany({
      where: { organizationId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return rows.map((r) => ({ id: r.id, place: r.place, what: r.what, why: r.why, byName: r.byName, createdAt: r.createdAt.toISOString() }));
  },
  async add(
    organizationId: string,
    customerId: string,
    input: { place: string; what: string; why?: string | null; byName?: string | null },
    userId: string
  ) {
    const r = await prisma.socialChangeLog.create({
      data: { organizationId, customerId, place: input.place, what: input.what, why: input.why ?? null, byName: input.byName ?? null, userId },
    });
    return { id: r.id, place: r.place, what: r.what, why: r.why, byName: r.byName, createdAt: r.createdAt.toISOString() };
  },
  async remove(organizationId: string, customerId: string, id: string) {
    const res = await prisma.socialChangeLog.deleteMany({ where: { id, organizationId, customerId } });
    if (!res.count) throw new HttpError(404, 'Not found');
  },
};

// ---------------- insights ----------------

export const insightsService = {
  async list(organizationId: string, customerId: string) {
    const rows = await prisma.socialGrowthInsight.findMany({
      where: { organizationId, customerId },
      orderBy: [{ date: 'desc' }, { createdAt: 'asc' }],
      take: 40,
    });
    return rows.map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), severity: r.severity, title: r.title, body: r.body }));
  },
};

// ---------------- ad plan ----------------

export type AdPlanStatus = 'pending' | 'approved' | 'rejected' | 'live';

export interface AdPlanInput {
  campaignName: string;
  objective?: string | null;
  budgetNote?: string | null;
  adsetName: string;
  audience?: string | null;
  adName: string;
  format?: string | null;
  hook?: string | null;
  primaryText?: string | null;
  headline?: string | null;
  description?: string | null;
  cta?: string | null;
  landingPage?: string | null;
  product?: string | null;
  placements?: string | null;
  imageNote?: string | null;
  imageUrl?: string | null;
  rationale?: string | null;
}

function adDto(r: Prisma.SocialAdPlanItemGetPayload<object>) {
  return {
    id: r.id,
    campaignName: r.campaignName,
    objective: r.objective,
    budgetNote: r.budgetNote,
    adsetName: r.adsetName,
    audience: r.audience,
    adName: r.adName,
    format: r.format,
    hook: r.hook,
    primaryText: r.primaryText,
    headline: r.headline,
    description: r.description,
    cta: r.cta,
    landingPage: r.landingPage,
    product: r.product,
    placements: r.placements,
    imageNote: r.imageNote,
    imageUrl: r.imageUrl,
    rationale: r.rationale,
    status: r.status,
    feedback: r.feedback,
    decidedAt: iso(r.decidedAt),
    liveAt: iso(r.liveAt),
    source: r.source,
    createdAt: r.createdAt.toISOString(),
  };
}
export type AdPlanDto = ReturnType<typeof adDto>;

export const adPlanService = {
  async list(organizationId: string, customerId: string) {
    const rows = await prisma.socialAdPlanItem.findMany({
      where: { organizationId, customerId },
      orderBy: [{ campaignName: 'asc' }, { adsetName: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    });
    return rows.map(adDto);
  },
  async createMany(organizationId: string, customerId: string, items: AdPlanInput[], source: string) {
    const created: AdPlanDto[] = [];
    for (const item of items) {
      const r = await prisma.socialAdPlanItem.create({
        data: {
          organizationId,
          customerId,
          source,
          campaignName: item.campaignName.slice(0, 255),
          adsetName: item.adsetName.slice(0, 255),
          adName: item.adName.slice(0, 255),
          objective: item.objective?.slice(0, 120) ?? null,
          budgetNote: item.budgetNote?.slice(0, 255) ?? null,
          audience: item.audience ?? null,
          format: item.format?.slice(0, 120) ?? null,
          hook: item.hook ?? null,
          primaryText: item.primaryText ?? null,
          headline: item.headline?.slice(0, 255) ?? null,
          description: item.description?.slice(0, 512) ?? null,
          cta: item.cta?.slice(0, 64) ?? null,
          landingPage: item.landingPage?.slice(0, 2048) ?? null,
          product: item.product?.slice(0, 255) ?? null,
          placements: item.placements?.slice(0, 255) ?? null,
          imageNote: item.imageNote ?? null,
          imageUrl: item.imageUrl?.slice(0, 2048) ?? null,
          rationale: item.rationale ?? null,
        },
      });
      created.push(adDto(r));
    }
    return created;
  },
  async decide(
    organizationId: string,
    customerId: string,
    id: string,
    status: AdPlanStatus,
    feedback: string | null,
    userId: string
  ) {
    const item = await prisma.socialAdPlanItem.findFirst({ where: { id, organizationId, customerId } });
    if (!item) throw new HttpError(404, 'Not found');
    const allowed: Record<AdPlanStatus, string[]> = {
      approved: ['pending', 'rejected'],
      rejected: ['pending', 'approved'],
      live: ['approved'],
      pending: ['approved', 'rejected'],
    };
    if (!allowed[status].includes(item.status)) {
      throw new HttpError(409, `This ad is "${item.status}" and cannot be moved to "${status}".`);
    }
    const now = new Date();
    const r = await prisma.socialAdPlanItem.update({
      where: { id },
      data:
        status === 'live'
          ? { status, liveAt: now }
          : { status, feedback: feedback ?? item.feedback, decidedAt: now, decidedById: userId },
    });
    if (status === 'approved') {
      await tasksService.ensureGenerated(organizationId, customerId, `ad:${id}:build`, {
        source: 'ad_plan',
        area: 'ads',
        priority: 'high',
        title: `Build in Ads Manager: ${r.adName}`.slice(0, 255),
        detail: `Campaign: ${r.campaignName}\nAd set: ${r.adsetName}${r.audience ? `\nAudience: ${r.audience}` : ''}\nOpen the Campaign plan tab to copy the names and text, build it, then press "Mark as live".`,
        link: r.landingPage,
      });
    }
    if (status === 'live') await tasksService.closeGenerated(customerId, `ad:${id}:build`, 'Marked live in the campaign plan');
    if (status === 'rejected') await tasksService.closeGenerated(customerId, `ad:${id}:build`, 'Ad rejected');
    return adDto(r);
  },
  async remove(organizationId: string, customerId: string, id: string) {
    const res = await prisma.socialAdPlanItem.deleteMany({ where: { id, organizationId, customerId } });
    if (!res.count) throw new HttpError(404, 'Not found');
  },
};

// ---------------- blogs ----------------

export type BlogStatus = 'idea' | 'draft' | 'changes' | 'approved' | 'published' | 'rejected';

function blogDto(r: Prisma.SocialBlogGetPayload<object>) {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    metaDescription: r.metaDescription,
    keywords: r.keywords,
    angle: r.angle,
    bodyHtml: r.bodyHtml,
    productLinks: (r.productLinks as { text: string; url: string }[] | null) ?? [],
    coverImageUrl: r.coverImageUrl,
    status: r.status,
    feedback: r.feedback,
    writeNext: r.writeNext,
    publishedUrl: r.publishedUrl,
    publishedAt: iso(r.publishedAt),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
export type BlogDto = ReturnType<typeof blogDto>;

export const blogsService = {
  async list(organizationId: string, customerId: string) {
    const rows = await prisma.socialBlog.findMany({
      where: { organizationId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(blogDto);
  },
  async get(organizationId: string, customerId: string, id: string) {
    const r = await prisma.socialBlog.findFirst({ where: { id, organizationId, customerId } });
    if (!r) throw new HttpError(404, 'Not found');
    return r;
  },
  async createIdeas(organizationId: string, customerId: string, ideas: { title: string; angle?: string; keywords?: string }[]) {
    const out: BlogDto[] = [];
    for (const idea of ideas) {
      const r = await prisma.socialBlog.create({
        data: {
          organizationId,
          customerId,
          title: idea.title.slice(0, 255),
          angle: idea.angle ?? null,
          keywords: idea.keywords?.slice(0, 512) ?? null,
          status: 'idea',
        },
      });
      out.push(blogDto(r));
    }
    return out;
  },
  async update(
    organizationId: string,
    customerId: string,
    id: string,
    input: Partial<{
      title: string;
      slug: string | null;
      metaDescription: string | null;
      keywords: string | null;
      bodyHtml: string | null;
      coverImageUrl: string | null;
      status: BlogStatus;
      feedback: string | null;
      writeNext: boolean;
    }>
  ) {
    const blog = await this.get(organizationId, customerId, id);
    if (blog.status === 'published' && input.status && input.status !== 'published') {
      throw new HttpError(409, 'This blog is already published on the store. Edit it in Shopify.');
    }
    if (input.status === 'published') throw new HttpError(400, 'Use Publish to post the blog to the store.');
    if (input.status === 'approved' && !(input.bodyHtml ?? blog.bodyHtml)) {
      throw new HttpError(400, 'Write the draft before approving it.');
    }
    const r = await prisma.socialBlog.update({
      where: { id },
      data: {
        ...input,
        ...(input.title !== undefined ? { title: input.title.slice(0, 255) } : {}),
      },
    });
    return blogDto(r);
  },
  async saveDraft(
    id: string,
    draft: { title: string; slug: string; metaDescription: string; keywords: string; bodyHtml: string; productLinks: { text: string; url: string }[] }
  ) {
    const r = await prisma.socialBlog.update({
      where: { id },
      data: {
        title: draft.title.slice(0, 255),
        slug: draft.slug.slice(0, 255),
        metaDescription: draft.metaDescription.slice(0, 512),
        keywords: draft.keywords.slice(0, 512),
        bodyHtml: draft.bodyHtml,
        productLinks: draft.productLinks,
        status: 'draft',
        writeNext: false,
      },
    });
    return blogDto(r);
  },
  /** The only write to the client's store: an approved blog, when a person presses Publish. */
  async publish(organizationId: string, customerId: string, id: string, author: string) {
    const blog = await this.get(organizationId, customerId, id);
    if (blog.status !== 'approved') throw new HttpError(409, 'Approve the blog before publishing it.');
    if (!blog.bodyHtml) throw new HttpError(400, 'This blog has no text yet.');
    const store = await prisma.socialShopifyStore.findFirst({ where: { organizationId, customerId } });
    if (!store) throw new HttpError(400, 'Connect the client\'s Shopify store first.');
    const scopes = (store.scopes ?? '').split(',');
    if (scopes.length > 1 && !scopes.includes('write_content')) {
      throw new HttpError(400, 'The Shopify app needs the write_content permission to publish blogs.');
    }
    const token = await resolveStoreToken(store);
    try {
      const blogs = await listBlogs(store.shopDomain, token);
      const target = blogs[0];
      if (!target) throw new HttpError(400, 'The store has no blog yet. Create one in Shopify → Online Store → Blog posts.');
      const article = await createArticle(store.shopDomain, token, {
        blogId: target.id,
        title: blog.title,
        bodyHtml: blog.bodyHtml,
        summary: blog.metaDescription,
        handle: blog.slug,
        imageUrl: blog.coverImageUrl,
        author,
        tags: blog.keywords ? blog.keywords.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 10) : [],
      });
      const base = (store.primaryUrl ?? `https://${store.shopDomain}`).replace(/\/$/, '');
      const r = await prisma.socialBlog.update({
        where: { id },
        data: {
          status: 'published',
          shopifyBlogId: target.id,
          shopifyArticleId: article.id,
          publishedUrl: `${base}/blogs/${article.blogHandle}/${article.handle}`,
          publishedAt: new Date(),
        },
      });
      return blogDto(r);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, error instanceof Error ? error.message : 'Shopify did not accept the blog');
    }
  },
  async remove(organizationId: string, customerId: string, id: string) {
    const blog = await this.get(organizationId, customerId, id);
    if (blog.status === 'published') throw new HttpError(409, 'Published blogs stay; remove them in Shopify.');
    await prisma.socialBlog.delete({ where: { id } });
  },
};

// ---------------- briefs & video ideas ----------------

export const briefsService = {
  async list(organizationId: string, customerId: string) {
    const rows = await prisma.socialBrief.findMany({
      where: { organizationId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    return rows.map((r) => ({ id: r.id, area: r.area, ask: r.ask, output: r.output, tasksAdded: r.tasksAdded, createdAt: r.createdAt.toISOString() }));
  },
  async addTasks(organizationId: string, customerId: string, id: string, userId: string) {
    const brief = await prisma.socialBrief.findFirst({ where: { id, organizationId, customerId } });
    if (!brief) throw new HttpError(404, 'Not found');
    if (brief.tasksAdded) return { added: 0 };
    const output = brief.output as { title?: string; tasks?: { title: string; detail?: string; area?: string }[] } | null;
    const tasks = output?.tasks ?? [];
    let added = 0;
    for (const [index, task] of tasks.entries()) {
      const area = (['ads', 'website', 'content', 'smm', 'seo', 'design', 'video', 'other'] as const).find(
        (a) => a === String(task.area ?? '').toLowerCase()
      );
      const made = await tasksService.ensureGenerated(organizationId, customerId, `brief:${id}:${index}`, {
        source: 'brief',
        area: area ?? 'other',
        priority: 'med',
        title: String(task.title || 'Task').slice(0, 255),
        detail: `${task.detail ?? ''}\nFrom the Idea box: ${output?.title ?? brief.ask.slice(0, 80)}`.trim(),
      });
      if (made) added += 1;
    }
    await prisma.socialBrief.update({ where: { id }, data: { tasksAdded: true } });
    void userId;
    return { added };
  },
  async remove(organizationId: string, customerId: string, id: string) {
    const res = await prisma.socialBrief.deleteMany({ where: { id, organizationId, customerId } });
    if (!res.count) throw new HttpError(404, 'Not found');
  },
};

export const videoIdeasService = {
  async list(organizationId: string, customerId: string) {
    const rows = await prisma.socialVideoIdea.findMany({
      where: { organizationId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      length: r.length,
      hook: r.hook,
      tool: r.tool,
      product: r.product,
      landingPage: r.landingPage,
      prompts: (r.prompts as { label: string; text: string }[]) ?? [],
      createdAt: r.createdAt.toISOString(),
    }));
  },
  async remove(organizationId: string, customerId: string, id: string) {
    const res = await prisma.socialVideoIdea.deleteMany({ where: { id, organizationId, customerId } });
    if (!res.count) throw new HttpError(404, 'Not found');
  },
};

// ---------------- reports ----------------

export const growthReportsService = {
  async list(organizationId: string, customerId: string) {
    const rows = await prisma.socialGrowthReport.findMany({
      where: { organizationId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      periodStart: r.periodStart.toISOString().slice(0, 10),
      periodEnd: r.periodEnd.toISOString().slice(0, 10),
      kpis: r.kpis,
      summary: r.summary,
      insights: r.insights,
      done: r.done,
      poa: r.poa,
      targets: r.targets,
      by: r.by,
      createdAt: r.createdAt.toISOString(),
    }));
  },
  async remove(organizationId: string, customerId: string, id: string) {
    const res = await prisma.socialGrowthReport.deleteMany({ where: { id, organizationId, customerId } });
    if (!res.count) throw new HttpError(404, 'Not found');
  },
};

// ---------------- content tracker (posts + boosts) ----------------

export type ContentStage = 'draft' | 'internal_review' | 'client_review' | 'rejected' | 'scheduled' | 'posted' | 'failed';

export function contentStage(post: { state: string; approvalStep: string | null }): ContentStage {
  if (post.state === 'PUBLISHED') return 'posted';
  if (post.state === 'ERROR') return 'failed';
  if (post.approvalStep === 'INTERNAL') return 'internal_review';
  if (post.approvalStep === 'CLIENT') return 'client_review';
  if (post.approvalStep === 'REJECTED') return 'rejected';
  if (post.state === 'QUEUE') return 'scheduled';
  return 'draft';
}

function postTitle(post: { title: string | null; content: string }): string {
  const raw = post.title?.trim() || post.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return (raw || 'Untitled post').slice(0, 90);
}

export const contentService = {
  async tracker(organizationId: string, customerId: string) {
    const now = Date.now();
    const posts = await prisma.socialPost.findMany({
      where: {
        organizationId,
        customerId,
        deletedAt: null,
        parentPostId: null,
        publishDate: { gte: new Date(now - 45 * 86400000), lte: new Date(now + 60 * 86400000) },
      },
      orderBy: { publishDate: 'asc' },
      take: 400,
      select: {
        id: true,
        group: true,
        state: true,
        approvalStep: true,
        publishDate: true,
        title: true,
        content: true,
        releaseUrl: true,
        integration: { select: { name: true, providerIdentifier: true } },
      },
    });
    const ids = posts.map((p) => p.id);
    const [boosts, metrics] = await Promise.all([
      prisma.socialPostBoost.findMany({ where: { organizationId, customerId, postId: { in: ids } } }),
      prisma.socialExternalPost.findMany({
        where: { socialPostId: { in: ids } },
        select: {
          socialPostId: true,
          type: true,
          reach: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
          videoViews: true,
          engagementRate: true,
          permalink: true,
        },
      }),
    ]);
    const boostBy = new Map(boosts.map((b) => [b.postId, b]));
    const metricsBy = new Map(metrics.map((m) => [m.socialPostId, m]));
    return posts.map((p) => {
      const b = boostBy.get(p.id);
      const m = metricsBy.get(p.id);
      return {
        id: p.id,
        group: p.group,
        title: postTitle(p),
        stage: contentStage(p),
        late: !['posted', 'scheduled'].includes(contentStage(p)) && p.publishDate.getTime() < now,
        publishDate: p.publishDate.toISOString(),
        channel: p.integration.name,
        provider: p.integration.providerIdentifier,
        url: m?.permalink ?? p.releaseUrl,
        boost: b ? { boost: b.boost, budget: dec(b.budget), spend: dec(b.spend), note: b.note } : null,
        metrics: m
          ? {
              type: m.type,
              reach: m.reach,
              plays: m.videoViews,
              likes: m.likes,
              comments: m.comments,
              shares: m.shares,
              saves: m.saves,
              engagementRate: dec(m.engagementRate),
            }
          : null,
      };
    });
  },

  async setBoost(
    organizationId: string,
    customerId: string,
    postId: string,
    input: { boost: boolean; budget?: number | null; spend?: number | null; note?: string | null }
  ) {
    const post = await prisma.socialPost.findFirst({
      where: { id: postId, organizationId, customerId, deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new HttpError(404, 'Not found');
    if (input.boost && !(input.budget && input.budget > 0)) throw new HttpError(400, 'Enter the boost budget.');
    const data = {
      boost: input.boost,
      budget: input.budget == null ? null : input.budget.toFixed(2),
      spend: input.spend == null ? null : input.spend.toFixed(2),
      note: input.note ?? null,
    };
    await prisma.socialPostBoost.upsert({
      where: { postId },
      update: data,
      create: { organizationId, customerId, postId, ...data },
    });
    return { ok: true };
  },

  /**
   * Keeps one open task per post group and stage (worker, hourly). Tasks close themselves when the
   * post moves on, so the team never has to tidy them.
   */
  async syncTasks(organizationId: string, customerId: string): Promise<number> {
    const now = Date.now();
    const posts = await prisma.socialPost.findMany({
      where: {
        organizationId,
        customerId,
        deletedAt: null,
        parentPostId: null,
        publishDate: { gte: new Date(now - 7 * 86400000), lte: new Date(now + 21 * 86400000) },
      },
      orderBy: { publishDate: 'asc' },
      select: { id: true, group: true, state: true, approvalStep: true, publishDate: true, title: true, content: true },
    });
    const boosts = await prisma.socialPostBoost.findMany({
      where: { organizationId, customerId, boost: true, postId: { in: posts.map((p) => p.id) } },
    });
    const boosted = new Map(boosts.map((b) => [b.postId, b]));
    const seen = new Set<string>();
    let created = 0;

    const STAGE_TASKS: Record<string, { key: string; area: 'content' | 'smm'; priority: 'high' | 'med'; title: string; detail: string }> = {
      draft: {
        key: 'finish',
        area: 'content',
        priority: 'med',
        title: 'Finish and send for approval',
        detail: 'Make the creative and caption, then send the post for approval in the Calendar.',
      },
      internal_review: {
        key: 'review',
        area: 'content',
        priority: 'high',
        title: 'Approve post',
        detail: 'This post is waiting for internal approval in the Calendar.',
      },
      client_review: {
        key: 'client',
        area: 'smm',
        priority: 'med',
        title: 'Chase client approval',
        detail: 'Waiting for the client to approve. Send them the approval link if they have not seen it.',
      },
      rejected: {
        key: 'redo',
        area: 'content',
        priority: 'high',
        title: 'Redo rejected post',
        detail: 'The post was rejected. Read the comments in the Calendar, fix it and send it again.',
      },
      failed: {
        key: 'fix',
        area: 'smm',
        priority: 'high',
        title: 'Fix failed post',
        detail: 'Publishing failed. Open the post in the Calendar, read the error and retry.',
      },
    };

    for (const post of posts) {
      if (seen.has(post.group)) continue;
      seen.add(post.group);
      const stage = contentStage(post);
      const title = postTitle(post);
      const when = post.publishDate.toISOString().slice(0, 10);
      for (const [stageName, spec] of Object.entries(STAGE_TASKS)) {
        const ref = `post:${post.group}:${spec.key}`;
        if (stage === stageName) {
          if (
            await tasksService.ensureGenerated(organizationId, customerId, ref, {
              source: 'post',
              area: spec.area,
              priority: spec.priority,
              title: `${spec.title}: ${title}`.slice(0, 255),
              detail: `${spec.detail}\nPlanned for ${when}.`,
              dueDate: when,
              link: `/dashboard/social/calendar`,
            })
          )
            created += 1;
        } else {
          await tasksService.closeGenerated(customerId, ref, 'Closed automatically: the post moved on');
        }
      }
      const boost = boosted.get(post.id);
      if (stage === 'posted' && boost) {
        if (
          await tasksService.ensureGenerated(organizationId, customerId, `post:${post.group}:boost`, {
            source: 'post',
            area: 'ads',
            priority: 'med',
            title: `Boost post: ${title}`.slice(0, 255),
            detail: `Boost only if the post beats the account's usual engagement after 24 hours. Budget: ${boost.budget?.toString() ?? 'not set'}. Use the retargeting or lookalike audience from the campaign plan and log the boost in the change log.`,
          })
        )
          created += 1;
      }
    }
    return created;
  },
};

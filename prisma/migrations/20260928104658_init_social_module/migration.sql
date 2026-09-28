-- CreateEnum
CREATE TYPE "SocialPostState" AS ENUM ('DRAFT', 'QUEUE', 'PUBLISHED', 'ERROR');

-- CreateEnum
CREATE TYPE "SocialCreationMethod" AS ENUM ('WEB', 'API', 'AI', 'AUTOPOST', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SocialMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "SocialMediaStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "providerIdentifier" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "rootInternalId" TEXT,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "picture" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiration" TIMESTAMP(3),
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "inBetweenSteps" BOOLEAN NOT NULL DEFAULT false,
    "refreshNeeded" BOOLEAN NOT NULL DEFAULT false,
    "postingTimes" JSONB NOT NULL DEFAULT '[{"time":120},{"time":400},{"time":700}]',
    "additionalSettings" JSONB NOT NULL DEFAULT '[]',
    "customInstanceDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "social_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_customers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "social_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "parentPostId" TEXT,
    "state" "SocialPostState" NOT NULL DEFAULT 'QUEUE',
    "publishDate" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "delay" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "media" JSONB NOT NULL DEFAULT '[]',
    "title" TEXT,
    "description" TEXT,
    "releaseId" TEXT,
    "releaseUrl" TEXT,
    "error" TEXT,
    "intervalInDays" INTEGER,
    "creationMethod" "SocialCreationMethod" NOT NULL DEFAULT 'WEB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT,
    "path" TEXT NOT NULL,
    "type" "SocialMediaType" NOT NULL DEFAULT 'IMAGE',
    "mimeType" TEXT,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "thumbnail" TEXT,
    "thumbnailTimestamp" INTEGER,
    "alt" TEXT,
    "status" "SocialMediaStatus" NOT NULL DEFAULT 'READY',
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "social_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_tags" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "social_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_tags_on_posts" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_tags_on_posts_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "social_signatures" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "autoAdd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "social_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_sets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_auto_posts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastUrl" TEXT,
    "content" TEXT,
    "integrationIds" TEXT[],
    "onSlot" BOOLEAN NOT NULL DEFAULT true,
    "syncLast" BOOLEAN NOT NULL DEFAULT false,
    "addPicture" BOOLEAN NOT NULL DEFAULT false,
    "generateContent" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "social_auto_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_webhooks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "social_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_webhook_integrations" (
    "webhookId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,

    CONSTRAINT "social_webhook_integrations_pkey" PRIMARY KEY ("webhookId","integrationId")
);

-- CreateTable
CREATE TABLE "social_notifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "social_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_errors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "body" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "social_integrations_organizationId_idx" ON "social_integrations"("organizationId");

-- CreateIndex
CREATE INDEX "social_integrations_providerIdentifier_idx" ON "social_integrations"("providerIdentifier");

-- CreateIndex
CREATE INDEX "social_integrations_customerId_idx" ON "social_integrations"("customerId");

-- CreateIndex
CREATE INDEX "social_integrations_deletedAt_idx" ON "social_integrations"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_integrations_organizationId_providerIdentifier_inter_key" ON "social_integrations"("organizationId", "providerIdentifier", "internalId");

-- CreateIndex
CREATE INDEX "social_customers_organizationId_idx" ON "social_customers"("organizationId");

-- CreateIndex
CREATE INDEX "social_posts_organizationId_idx" ON "social_posts"("organizationId");

-- CreateIndex
CREATE INDEX "social_posts_integrationId_idx" ON "social_posts"("integrationId");

-- CreateIndex
CREATE INDEX "social_posts_group_idx" ON "social_posts"("group");

-- CreateIndex
CREATE INDEX "social_posts_parentPostId_idx" ON "social_posts"("parentPostId");

-- CreateIndex
CREATE INDEX "social_posts_state_idx" ON "social_posts"("state");

-- CreateIndex
CREATE INDEX "social_posts_publishDate_idx" ON "social_posts"("publishDate");

-- CreateIndex
CREATE INDEX "social_posts_deletedAt_idx" ON "social_posts"("deletedAt");

-- CreateIndex
CREATE INDEX "social_media_organizationId_idx" ON "social_media"("organizationId");

-- CreateIndex
CREATE INDEX "social_media_type_idx" ON "social_media"("type");

-- CreateIndex
CREATE INDEX "social_media_deletedAt_idx" ON "social_media"("deletedAt");

-- CreateIndex
CREATE INDEX "social_tags_organizationId_idx" ON "social_tags"("organizationId");

-- CreateIndex
CREATE INDEX "social_signatures_organizationId_idx" ON "social_signatures"("organizationId");

-- CreateIndex
CREATE INDEX "social_sets_organizationId_idx" ON "social_sets"("organizationId");

-- CreateIndex
CREATE INDEX "social_auto_posts_organizationId_idx" ON "social_auto_posts"("organizationId");

-- CreateIndex
CREATE INDEX "social_webhooks_organizationId_idx" ON "social_webhooks"("organizationId");

-- CreateIndex
CREATE INDEX "social_notifications_organizationId_idx" ON "social_notifications"("organizationId");

-- CreateIndex
CREATE INDEX "social_notifications_createdAt_idx" ON "social_notifications"("createdAt");

-- CreateIndex
CREATE INDEX "social_post_errors_organizationId_idx" ON "social_post_errors"("organizationId");

-- CreateIndex
CREATE INDEX "social_post_errors_postId_idx" ON "social_post_errors"("postId");

-- AddForeignKey
ALTER TABLE "social_integrations" ADD CONSTRAINT "social_integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_integrations" ADD CONSTRAINT "social_integrations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "social_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_customers" ADD CONSTRAINT "social_customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "social_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_parentPostId_fkey" FOREIGN KEY ("parentPostId") REFERENCES "social_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media" ADD CONSTRAINT "social_media_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_tags" ADD CONSTRAINT "social_tags_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_tags_on_posts" ADD CONSTRAINT "social_tags_on_posts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_tags_on_posts" ADD CONSTRAINT "social_tags_on_posts_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "social_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_signatures" ADD CONSTRAINT "social_signatures_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_sets" ADD CONSTRAINT "social_sets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_auto_posts" ADD CONSTRAINT "social_auto_posts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_webhooks" ADD CONSTRAINT "social_webhooks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_webhook_integrations" ADD CONSTRAINT "social_webhook_integrations_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "social_webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_webhook_integrations" ADD CONSTRAINT "social_webhook_integrations_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "social_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_notifications" ADD CONSTRAINT "social_notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post_errors" ADD CONSTRAINT "social_post_errors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post_errors" ADD CONSTRAINT "social_post_errors_postId_fkey" FOREIGN KEY ("postId") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

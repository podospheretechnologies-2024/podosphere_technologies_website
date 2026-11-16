import { notFound } from 'next/navigation';
import {
  FeaturePage,
  featureMetadata,
} from '@/modules/marketing/components/feature-page';
import { FEATURES, FEATURE_SLUGS, type FeatureSlug } from '@/modules/marketing/config/features';

export function generateStaticParams() {
  return FEATURE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = FEATURES[slug as FeatureSlug];
  if (!content) return {};
  return featureMetadata(content);
}

export default async function MarketingFeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = FEATURES[slug as FeatureSlug];
  if (!content) notFound();
  return <FeaturePage content={content} />;
}

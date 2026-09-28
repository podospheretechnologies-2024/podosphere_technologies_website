import type { Metadata } from 'next';
import { ChannelsManager } from '@/modules/social/components/channels/channels-manager';
import { socialSections } from '@/modules/social/config/navigation';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Channels',
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChannelsPage({
  searchParams,
}: PageProps<'/dashboard/social/channels'>) {
  const { connected, error } = await searchParams;
  const { label, description } = socialSections.channels;

  return (
    <>
      <PageHeader title={label} description={description} />
      <ChannelsManager connected={firstValue(connected)} connectError={firstValue(error)} />
    </>
  );
}

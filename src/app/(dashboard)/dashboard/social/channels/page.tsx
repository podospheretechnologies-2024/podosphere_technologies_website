import type { Metadata } from 'next';
import { ChannelsManager } from '@/modules/social/components/channels/channels-manager';

export const metadata: Metadata = {
  title: 'Integrations',
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChannelsPage({
  searchParams,
}: PageProps<'/dashboard/social/channels'>) {
  const { connected, error } = await searchParams;

  return <ChannelsManager connected={firstValue(connected)} connectError={firstValue(error)} />;
}

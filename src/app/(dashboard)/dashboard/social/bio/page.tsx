import type { Metadata } from 'next';
import { BioPagesPanel } from '@/modules/social/components/bio/bio-pages-panel';

export const metadata: Metadata = {
  title: 'Bio Link',
};

export default function BioPage() {
  return <BioPagesPanel />;
}

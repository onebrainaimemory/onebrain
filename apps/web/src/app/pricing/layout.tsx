import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Free & Pro Plans',
  description:
    'OneBrain pricing plans. Start free with 100 memories, upgrade for unlimited storage, DeepRecall semantic search, SkillForge, and BrainPulse briefings. Self-hosting available.',
  alternates: { canonical: 'https://onebrain.rocks/pricing' },
  openGraph: {
    title: 'OneBrain Pricing — Free & Pro Plans',
    description: 'Start free, upgrade when you need more. AI memory for individuals and teams.',
    url: 'https://onebrain.rocks/pricing',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

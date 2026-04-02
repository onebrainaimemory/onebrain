import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ — Frequently Asked Questions',
  description:
    'OneBrain FAQ — answers to common questions about AI memory, agents, privacy, MCP, DeepRecall, SkillForge, BrainPulse, and more. Simple explanations for everyone.',
  alternates: { canonical: 'https://onebrain.rocks/faq' },
  openGraph: {
    title: 'OneBrain — FAQ',
    description:
      'All your questions about OneBrain answered. AI memory, agents, privacy, integrations, and more.',
    url: 'https://onebrain.rocks/faq',
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}

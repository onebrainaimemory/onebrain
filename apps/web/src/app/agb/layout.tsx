import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AGB / Terms of Service',
  description:
    'OneBrain Terms of Service — account rules, acceptable use, API key policies, liability, agent provisioning. Beta project, no paid plans.',
  alternates: { canonical: 'https://onebrain.rocks/agb' },
  openGraph: {
    title: 'OneBrain — Terms of Service',
    description: 'Terms of Service for OneBrain AI memory layer. German law applicable.',
    url: 'https://onebrain.rocks/agb',
  },
};

export default function AgbLayout({ children }: { children: React.ReactNode }) {
  return children;
}

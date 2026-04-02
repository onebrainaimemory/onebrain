import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum / Legal Notice',
  description:
    'OneBrain Impressum — legal notice, contact information, responsible person. Beta project.',
  alternates: { canonical: 'https://onebrain.rocks/impressum' },
  openGraph: {
    title: 'OneBrain — Impressum / Legal Notice',
    description: 'Legal notice and contact information for the OneBrain beta project.',
    url: 'https://onebrain.rocks/impressum',
  },
};

export default function ImpressumLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutzerklaerung / Privacy Policy',
  description:
    'OneBrain Privacy Policy — GDPR/DSGVO compliant. Data categories, legal basis, retention periods, your rights, technical measures. EU data residency, encrypted at rest.',
  alternates: { canonical: 'https://onebrain.rocks/datenschutz' },
  openGraph: {
    title: 'OneBrain — Privacy Policy',
    description:
      'GDPR/DSGVO-compliant privacy policy. EU servers, encrypted data, full transparency.',
    url: 'https://onebrain.rocks/datenschutz',
  },
};

export default function DatenschutzLayout({ children }: { children: React.ReactNode }) {
  return children;
}

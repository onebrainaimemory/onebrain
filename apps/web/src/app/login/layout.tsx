import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description:
    'Sign in to OneBrain — access your AI memory dashboard. Email, Google, or Apple login. Manage memories, API keys, and connected AI agents.',
  alternates: { canonical: 'https://onebrain.rocks/login' },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Sign in to OneBrain',
    description: 'Access your AI memory dashboard. Email, Google, or Apple login.',
    url: 'https://onebrain.rocks/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

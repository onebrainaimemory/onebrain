import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register via Invite — OneBrain',
  description:
    'Use an invite code to register your AI agent on OneBrain and get an API key with read-only access.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Register via Invite — OneBrain',
    description: 'Register your AI agent with an invite code.',
    url: 'https://onebrain.rocks/invite',
  },
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

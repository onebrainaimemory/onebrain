'use client';

import { useState } from 'react';
import { useAuth } from './AuthContext';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  },
  button: {
    padding: '8px 14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#333',
  },
};

interface SocialShareProps {
  url?: string;
  text?: string;
}

export function SocialShare({ url, text }: SocialShareProps) {
  const { t } = useAuth();
  const [isCopied, setIsCopied] = useState(false);

  const shareText = text ?? t('social_share.share_text');
  const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.origin : '');

  const handleTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
  };

  const handleLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedInUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div style={styles.container}>
      <button style={styles.button} onClick={handleTwitter}>
        {t('social_share.share_on_twitter')}
      </button>
      <button style={styles.button} onClick={handleLinkedIn}>
        {t('social_share.share_on_linkedin')}
      </button>
      <button style={styles.button} onClick={handleCopyLink}>
        {isCopied ? t('social_share.copied') : t('social_share.copy_link')}
      </button>
    </div>
  );
}

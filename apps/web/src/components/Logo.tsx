'use client';

import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
  className?: string;
}

const sizes = {
  sm: { width: 200, height: 34 },
  md: { width: 280, height: 48 },
  lg: { width: 360, height: 62 },
};

const iconSizes = {
  sm: 28,
  md: 40,
  lg: 56,
};

export function Logo({ href = '/', size = 'md', iconOnly = false, className }: LogoProps) {
  const content = iconOnly ? (
    <Image
      src="/icons/icon.svg"
      alt="OneBrain"
      width={iconSizes[size]}
      height={iconSizes[size]}
      priority
    />
  ) : (
    <Image
      src="/icons/logo.svg"
      alt="OneBrain.rocks"
      width={sizes[size].width}
      height={sizes[size].height}
      priority
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        {content}
      </Link>
    );
  }

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
      {content}
    </span>
  );
}

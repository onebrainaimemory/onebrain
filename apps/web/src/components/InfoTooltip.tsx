'use client';

import styles from './InfoTooltip.module.css';

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  if (!text) return null;

  return (
    <span className={styles.wrapper}>
      <span className={styles.icon} aria-label="Info" role="img">
        i
      </span>
      <span className={styles.tooltip}>{text}</span>
    </span>
  );
}

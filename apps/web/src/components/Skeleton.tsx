'use client';

import styles from './Skeleton.module.css';

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.skeletonGroup} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={styles.skeletonLine}
          style={{ width: index === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className={styles.skeletonCard} aria-busy="true" aria-label="Loading">
      <div className={styles.skeletonLine} style={{ width: '40%' }} />
      <div className={styles.skeletonLine} style={{ width: '100%' }} />
      <div className={styles.skeletonLine} style={{ width: '75%' }} />
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className={styles.skeletonGroup} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={styles.skeletonListItem}>
          <div className={styles.skeletonCircle} />
          <div className={styles.skeletonListContent}>
            <div className={styles.skeletonLine} style={{ width: '50%' }} />
            <div className={styles.skeletonLine} style={{ width: '80%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

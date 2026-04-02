'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import styles from './onboarding.module.css';

type Step = 0 | 1 | 2 | 3;

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const { t } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(0);

  useEffect(() => {
    const completed = localStorage.getItem('onboarding_completed');
    if (completed === 'true') {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleSkip = useCallback(() => {
    localStorage.setItem('onboarding_completed', 'true');
    router.push('/dashboard');
  }, [router]);

  const handleNext = useCallback(() => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as Step);
      return;
    }
    localStorage.setItem('onboarding_completed', 'true');
    router.push('/dashboard');
  }, [currentStep, router]);

  const handleAction = useCallback(() => {
    localStorage.setItem('onboarding_completed', 'true');
    const routes = [
      '/dashboard',
      '/dashboard/brain',
      '/dashboard/ingest',
      '/dashboard/integrations',
    ];
    router.push(routes[currentStep]!);
  }, [currentStep, router]);

  const stepKeys = [
    {
      title: 'onboarding_wizard.step1_title',
      desc: 'onboarding_wizard.step1_desc',
      action: 'onboarding_wizard.step1_action',
    },
    {
      title: 'onboarding_wizard.step2_title',
      desc: 'onboarding_wizard.step2_desc',
      action: 'onboarding_wizard.step2_action',
    },
    {
      title: 'onboarding_wizard.step3_title',
      desc: 'onboarding_wizard.step3_desc',
      action: 'onboarding_wizard.step3_action',
    },
    {
      title: 'onboarding_wizard.step4_title',
      desc: 'onboarding_wizard.step4_desc',
      action: 'onboarding_wizard.step4_action',
    },
  ];

  const step = stepKeys[currentStep]!;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <span
              key={index}
              className={`${styles.dot} ${index === currentStep ? styles.dotActive : ''} ${index < currentStep ? styles.dotDone : ''}`}
            />
          ))}
        </div>

        <h1 className={styles.title}>{t(step.title)}</h1>
        <p className={styles.description}>{t(step.desc)}</p>

        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={handleAction}>
            {t(step.action)}
          </button>
        </div>

        <div className={styles.navigation}>
          <button className={styles.skipBtn} onClick={handleSkip}>
            {t('onboarding_wizard.skip')}
          </button>
          <button className={styles.nextBtn} onClick={handleNext}>
            {currentStep < 3 ? t('common.next') : t('onboarding_wizard.finish')}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { useTheme } from '@/components/ThemeProvider';
import { SunIcon, MoonIcon } from '@/components/Icons';
import styles from './pricing.module.css';

interface PlanData {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  trialDays: number;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  limits: Array<{ key: string; value: number; period: string }>;
  features: Array<{ key: string; value: string }>;
}

interface CouponResult {
  valid: boolean;
  couponId: string;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: string;
}

export default function PricingPage() {
  const { t, token } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [isYearly, setIsYearly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  useEffect(() => {
    apiClient
      .get<PlanData[]>('/v1/plans/public')
      .then((res) => {
        if (res.data) setPlans(res.data);
      })
      .catch(() => {
        /* network error — show empty plans */
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleCheckout = async (plan: PlanData) => {
    const priceId = isYearly ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

    if (!priceId) {
      window.location.href = '/login';
      return;
    }

    const body: Record<string, string> = { priceId };
    if (couponResult?.valid && couponResult.couponId) {
      body['couponCode'] = couponResult.couponId;
    }

    const res = await apiClient.post<{ url: string }>('/v1/billing/checkout', body);

    if (res.data?.url) {
      window.location.href = res.data.url;
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setIsValidatingCoupon(true);
    setCouponError('');
    setCouponResult(null);

    const res = await apiClient.post<CouponResult>('/v1/billing/apply-coupon', {
      couponCode: couponCode.trim(),
    });

    setIsValidatingCoupon(false);

    if (res.data?.valid) {
      setCouponResult(res.data);
    } else {
      setCouponError(res.error?.message ?? t('billing.coupon.invalid'));
    }
  };

  const formatPrice = (cents: number | null) => {
    if (cents === null || cents === 0) return t('pricing.free_title');
    return `€${(cents / 100).toFixed(2).replace('.00', '')}`;
  };

  const formatCouponDiscount = (coupon: CouponResult): string => {
    if (coupon.percentOff) {
      return `${coupon.percentOff}% off`;
    }
    if (coupon.amountOff && coupon.currency) {
      return `${(coupon.amountOff / 100).toFixed(2)} ${coupon.currency.toUpperCase()} off`;
    }
    return '';
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo href="/" size="sm" />
        <div className={styles.headerActions}>
          <LanguageSwitcher />
          <button
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={t('theme.toggle')}
            title={t('theme.toggle')}
          >
            {theme === 'light' ? (
              <MoonIcon width={18} height={18} />
            ) : (
              <SunIcon width={18} height={18} />
            )}
          </button>
          {token ? (
            <Link href="/dashboard" className={styles.headerCta}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={styles.headerLink}>
                {t('auth.login.title')}
              </Link>
              <Link href="/login" className={styles.headerCta}>
                {t('landing.get_started')}
              </Link>
            </>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>{t('pricing.title')}</h1>
        <p className={styles.subtitle}>{t('pricing.subtitle')}</p>

        {/* Monthly/Yearly Toggle */}
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${!isYearly ? styles.toggleActive : ''}`}
            onClick={() => setIsYearly(false)}
          >
            {t('pricing.monthly')}
          </button>
          <button
            className={`${styles.toggleBtn} ${isYearly ? styles.toggleActive : ''}`}
            onClick={() => setIsYearly(true)}
          >
            {t('pricing.yearly')}
          </button>
        </div>

        {/* Coupon Input */}
        {token && (
          <div className={styles.couponSection}>
            <div className={styles.couponRow}>
              <input
                type="text"
                className={styles.couponInput}
                placeholder={t('billing.coupon.placeholder')}
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                maxLength={255}
              />
              <button
                className={styles.couponBtn}
                onClick={handleApplyCoupon}
                disabled={isValidatingCoupon || !couponCode.trim()}
              >
                {isValidatingCoupon ? t('common.loading') : t('billing.coupon.apply')}
              </button>
            </div>
            {couponResult?.valid && (
              <p className={styles.couponSuccess}>
                {t('billing.coupon.applied')}: {formatCouponDiscount(couponResult)}
              </p>
            )}
            {couponError && <p className={styles.couponError}>{couponError}</p>}
          </div>
        )}

        {isLoading ? (
          <p style={{ textAlign: 'center', padding: '2rem' }}>{t('common.loading')}</p>
        ) : (
          <div className={styles.grid}>
            {plans.map((plan) => {
              const price = isYearly ? plan.priceYearly : plan.priceMonthly;
              const isFree = !price || price === 0;
              const isPopular = plan.name === 'pro';

              return (
                <div
                  key={plan.id}
                  className={`${styles.card} ${isPopular ? styles.cardPopular : ''}`}
                >
                  {isPopular && <span className={styles.badge}>{t('pricing.popular')}</span>}
                  <h3 className={styles.planName}>{plan.displayName}</h3>
                  {plan.description && <p className={styles.planDesc}>{plan.description}</p>}

                  <div className={styles.price}>
                    <span className={styles.priceAmount}>
                      {isFree ? t('pricing.free_title') : `${formatPrice(price)}`}
                    </span>
                    {!isFree && (
                      <span className={styles.pricePeriod}>
                        {isYearly ? t('pricing.per_year') : t('pricing.per_month')}
                      </span>
                    )}
                  </div>

                  {plan.trialDays > 0 && !isFree && (
                    <p className={styles.trialBadge}>
                      {t('billing.trial.days_free').replace('{days}', String(plan.trialDays))}
                    </p>
                  )}

                  <ul className={styles.featureList}>
                    {plan.limits.map((limit) => (
                      <li key={limit.key}>
                        {limit.value === -1
                          ? `${t('billing.unlimited')} ${limit.key.replace(/_/g, ' ')}`
                          : `${limit.value} ${limit.key.replace(/_/g, ' ')} / ${limit.period}`}
                      </li>
                    ))}
                    {plan.features
                      .filter((f) => f.value === 'true')
                      .map((feature) => (
                        <li key={feature.key}>{feature.key.replace(/_/g, ' ')}</li>
                      ))}
                  </ul>

                  {isFree ? (
                    <Link href="/login" className={styles.cta}>
                      {t('pricing.get_started')}
                    </Link>
                  ) : token ? (
                    <button onClick={() => handleCheckout(plan)} className={styles.cta}>
                      {t('pricing.upgrade')}
                    </button>
                  ) : (
                    <Link href="/login" className={styles.cta}>
                      {t('pricing.get_started')}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Self-Hosted Callout */}
        <div className={styles.selfHosted}>
          <h3>{t('pricing.self_hosted_title')}</h3>
          <p>{t('pricing.self_hosted_desc')}</p>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <Link href="/impressum">{t('legal.impressum.title')}</Link>
          <Link href="/datenschutz">{t('legal.privacy.title')}</Link>
          <Link href="/agb">{t('legal.terms.title')}</Link>
        </div>
      </footer>
    </div>
  );
}

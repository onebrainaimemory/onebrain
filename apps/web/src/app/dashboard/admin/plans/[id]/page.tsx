'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import styles from '../../admin.module.css';

interface PlanDetail {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  priceMonthly: number | null;
  priceYearly: number | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  trialDays: number;
  stripeCouponId: string | null;
  updatedAt: string;
}

interface PlanLimit {
  id: string;
  planId: string;
  key: string;
  value: number;
  period: string;
}

interface PlanFeature {
  id: string;
  planId: string;
  key: string;
  value: string;
}

type TabType = 'settings' | 'pricing' | 'limits' | 'features';

/** All known plan limit keys with human-readable labels */
const KNOWN_LIMIT_KEYS = [
  { key: 'context_calls_per_month', label: 'Context Calls / Month' },
  { key: 'memory_writes_per_month', label: 'Memory Writes / Month' },
  { key: 'extract_calls_per_month', label: 'Extract Calls / Month' },
] as const;

/** Feature value type configuration per feature key */
type FeatureValueType =
  | { type: 'boolean' }
  | { type: 'enum'; options: string[] }
  | { type: 'number' };

const KNOWN_FEATURE_KEYS: Array<{
  key: string;
  label: string;
  valueType: FeatureValueType;
}> = [
  { key: 'deep_recall', label: 'DeepRecall', valueType: { type: 'boolean' } },
  { key: 'skill_forge', label: 'SkillForge', valueType: { type: 'boolean' } },
  {
    key: 'brain_pulse',
    label: 'BrainPulse',
    valueType: { type: 'enum', options: ['false', 'weekly_email', 'full'] },
  },
  {
    key: 'brain_pulse_max_schedules',
    label: 'BrainPulse Max Schedules',
    valueType: { type: 'number' },
  },
  { key: 'allow_deep_context', label: 'Deep Context', valueType: { type: 'boolean' } },
  { key: 'priority_processing', label: 'Priority Processing', valueType: { type: 'boolean' } },
  {
    key: 'max_context_depth',
    label: 'Max Context Depth',
    valueType: { type: 'enum', options: ['basic', 'assistant', 'full'] },
  },
  {
    key: 'max_entities_in_context',
    label: 'Max Entities in Context',
    valueType: { type: 'number' },
  },
  { key: 'api_access', label: 'API Access', valueType: { type: 'boolean' } },
  { key: 'export_data', label: 'Data Export', valueType: { type: 'boolean' } },
];

function formatPrice(cents: number | null): string {
  if (cents === null || cents === undefined) return '—';
  return (cents / 100).toFixed(2);
}

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useAuth();

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [limits, setLimits] = useState<PlanLimit[]>([]);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [editPlan, setEditPlan] = useState({
    displayName: '',
    description: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const [editPricing, setEditPricing] = useState({
    priceMonthly: '',
    priceYearly: '',
    trialDays: '',
    stripePriceIdMonthly: '',
    stripePriceIdYearly: '',
    stripeCouponId: '',
  });

  const [newLimit, setNewLimit] = useState({
    key: '',
    value: '',
    period: 'monthly',
  });

  const [newFeature, setNewFeature] = useState({ key: '', value: '' });

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function fetchPlan() {
    const listRes = await apiClient.get<PlanDetail[]>('/v1/admin/plans');
    if (listRes.data) {
      const found = listRes.data.find((p) => p.id === id);
      if (found) {
        setPlan(found);
        setEditPlan({
          displayName: found.displayName,
          description: found.description ?? '',
          isActive: found.isActive,
        });
        setEditPricing({
          priceMonthly: found.priceMonthly !== null ? String(found.priceMonthly) : '',
          priceYearly: found.priceYearly !== null ? String(found.priceYearly) : '',
          trialDays: String(found.trialDays ?? 0),
          stripePriceIdMonthly: found.stripePriceIdMonthly ?? '',
          stripePriceIdYearly: found.stripePriceIdYearly ?? '',
          stripeCouponId: found.stripeCouponId ?? '',
        });
      }
    }
  }

  async function fetchLimits() {
    const res = await apiClient.get<PlanLimit[]>(`/v1/admin/plans/${id}/limits`);
    if (res.data) setLimits(res.data);
  }

  async function fetchFeatures() {
    const res = await apiClient.get<PlanFeature[]>(`/v1/admin/plans/${id}/features`);
    if (res.data) setFeatures(res.data);
  }

  useEffect(() => {
    async function load() {
      await Promise.all([fetchPlan(), fetchLimits(), fetchFeatures()]);
      setIsLoading(false);
    }
    load();
  }, [id]);

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await apiClient.patch<PlanDetail>(`/v1/admin/plans/${id}`, {
      displayName: editPlan.displayName,
      description: editPlan.description || null,
      isActive: editPlan.isActive,
    });

    if (res.data) {
      setPlan((prev) => (prev ? { ...prev, ...res.data } : prev));
      showSuccess(t('admin.plan_saved'));
    } else if (res.error) {
      setError(res.error.message);
    }

    setSaving(false);
  }

  async function handleSavePricing(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await apiClient.patch<PlanDetail>(`/v1/admin/plans/${id}`, {
      priceMonthly: editPricing.priceMonthly ? parseInt(editPricing.priceMonthly, 10) : null,
      priceYearly: editPricing.priceYearly ? parseInt(editPricing.priceYearly, 10) : null,
      trialDays: parseInt(editPricing.trialDays || '0', 10),
      stripePriceIdMonthly: editPricing.stripePriceIdMonthly || null,
      stripePriceIdYearly: editPricing.stripePriceIdYearly || null,
      stripeCouponId: editPricing.stripeCouponId || null,
    });

    if (res.data) {
      setPlan((prev) => (prev ? { ...prev, ...res.data } : prev));
      showSuccess(t('admin.plan_saved'));
    } else if (res.error) {
      setError(res.error.message);
    }

    setSaving(false);
  }

  async function handleAddLimit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const res = await apiClient.post<PlanLimit>(`/v1/admin/plans/${id}/limits`, {
      key: newLimit.key,
      value: parseInt(newLimit.value, 10),
      period: newLimit.period,
    });

    if (res.data) {
      setNewLimit({ key: '', value: '', period: 'monthly' });
      showSuccess(t('admin.limit_added'));
      await fetchLimits();
    } else if (res.error) {
      setError(res.error.message);
    }
  }

  async function handleUpdateLimit(limitId: string, value: number) {
    const res = await apiClient.patch<PlanLimit>(`/v1/admin/plan-limits/${limitId}`, { value });
    if (res.data) {
      showSuccess(t('admin.limit_saved'));
      await fetchLimits();
    }
  }

  async function handleDeleteLimit(limitId: string) {
    const res = await apiClient.delete(`/v1/admin/plan-limits/${limitId}`);
    if (!res.error) {
      showSuccess(t('admin.limit_deleted'));
      await fetchLimits();
    } else {
      setError(res.error.message);
    }
  }

  async function handleAddFeature(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const res = await apiClient.post<PlanFeature>(`/v1/admin/plans/${id}/features`, {
      key: newFeature.key,
      value: newFeature.value,
    });

    if (res.data) {
      setNewFeature({ key: '', value: '' });
      showSuccess(t('admin.feature_added'));
      await fetchFeatures();
    } else if (res.error) {
      setError(res.error.message);
    }
  }

  async function handleUpdateFeature(featureId: string, value: string) {
    const res = await apiClient.patch<PlanFeature>(`/v1/admin/plan-features/${featureId}`, {
      value,
    });
    if (res.data) {
      showSuccess(t('admin.feature_saved'));
      await fetchFeatures();
    }
  }

  async function handleDeleteFeature(featureId: string) {
    const res = await apiClient.delete(`/v1/admin/plan-features/${featureId}`);
    if (!res.error) {
      showSuccess(t('admin.feature_deleted'));
      await fetchFeatures();
    } else {
      setError(res.error.message);
    }
  }

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  if (!plan) {
    return <p className={styles.error}>{t('admin.plan_not_found')}</p>;
  }

  return (
    <div className={styles.container}>
      <Link href="/dashboard/admin/plans" className={styles.backLink}>
        &larr; {t('admin.nav_plans')}
      </Link>

      <div className={styles.planHeader}>
        <h1 className={styles.title}>{plan.displayName}</h1>
        <span className={styles.planName}>{plan.name}</span>
        <span
          className={`${styles.badge} ${plan.isActive ? styles.badgeActive : styles.badgeInactive}`}
        >
          {plan.isActive ? t('admin.active') : t('admin.inactive')}
        </span>
        {plan.priceMonthly !== null && (
          <span className={styles.planName}>
            {formatPrice(plan.priceMonthly)}
            {t('admin.per_month')}
          </span>
        )}
      </div>

      {successMsg && <div className={styles.successMessage}>{successMsg}</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.tabs}>
        {(['settings', 'pricing', 'limits', 'features'] as TabType[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(`admin.tab_${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'settings' && (
        <form className={styles.form} onSubmit={handleSavePlan}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('admin.display_name')}</label>
            <input
              className={styles.formInput}
              value={editPlan.displayName}
              onChange={(e) => setEditPlan({ ...editPlan, displayName: e.target.value })}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('admin.description')}</label>
            <input
              className={styles.formInput}
              value={editPlan.description}
              onChange={(e) => setEditPlan({ ...editPlan, description: e.target.value })}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('admin.status')}</label>
            <select
              className={styles.formSelect}
              value={editPlan.isActive ? 'active' : 'inactive'}
              onChange={(e) =>
                setEditPlan({
                  ...editPlan,
                  isActive: e.target.value === 'active',
                })
              }
            >
              <option value="active">{t('admin.active')}</option>
              <option value="inactive">{t('admin.inactive')}</option>
            </select>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'pricing' && (
        <form className={styles.form} onSubmit={handleSavePricing}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('admin.price_monthly')}</label>
              <input
                className={styles.formInput}
                type="number"
                min="0"
                value={editPricing.priceMonthly}
                onChange={(e) =>
                  setEditPricing({
                    ...editPricing,
                    priceMonthly: e.target.value,
                  })
                }
                placeholder="990"
              />
              {editPricing.priceMonthly && (
                <span className={styles.priceHint}>
                  = {formatPrice(parseInt(editPricing.priceMonthly, 10))} EUR
                </span>
              )}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('admin.price_yearly')}</label>
              <input
                className={styles.formInput}
                type="number"
                min="0"
                value={editPricing.priceYearly}
                onChange={(e) =>
                  setEditPricing({
                    ...editPricing,
                    priceYearly: e.target.value,
                  })
                }
                placeholder="9900"
              />
              {editPricing.priceYearly && (
                <span className={styles.priceHint}>
                  = {formatPrice(parseInt(editPricing.priceYearly, 10))} EUR
                </span>
              )}
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('admin.trial_days')}</label>
            <input
              className={styles.formInput}
              type="number"
              min="0"
              max="365"
              value={editPricing.trialDays}
              onChange={(e) =>
                setEditPricing({
                  ...editPricing,
                  trialDays: e.target.value,
                })
              }
              placeholder="0"
            />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('admin.stripe_price_id_monthly')}</label>
              <input
                className={styles.formInput}
                value={editPricing.stripePriceIdMonthly}
                onChange={(e) =>
                  setEditPricing({
                    ...editPricing,
                    stripePriceIdMonthly: e.target.value,
                  })
                }
                placeholder="price_..."
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('admin.stripe_price_id_yearly')}</label>
              <input
                className={styles.formInput}
                value={editPricing.stripePriceIdYearly}
                onChange={(e) =>
                  setEditPricing({
                    ...editPricing,
                    stripePriceIdYearly: e.target.value,
                  })
                }
                placeholder="price_..."
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('admin.stripe_coupon_id')}</label>
            <input
              className={styles.formInput}
              value={editPricing.stripeCouponId}
              onChange={(e) =>
                setEditPricing({
                  ...editPricing,
                  stripeCouponId: e.target.value,
                })
              }
              placeholder="coupon_..."
            />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'limits' && (
        <div className={styles.section}>
          <form className={styles.form} onSubmit={handleAddLimit}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('admin.limit_key')}</label>
                <select
                  className={styles.formSelect}
                  value={newLimit.key}
                  onChange={(e) => setNewLimit({ ...newLimit, key: e.target.value })}
                  required
                >
                  <option value="">{t('admin.select_limit_key')}</option>
                  {KNOWN_LIMIT_KEYS.filter((lk) => !limits.some((l) => l.key === lk.key)).map(
                    (lk) => (
                      <option key={lk.key} value={lk.key}>
                        {lk.label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('admin.limit_value')}</label>
                <div className={styles.numberStepper}>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={() => {
                      const v = parseInt(newLimit.value || '0', 10);
                      if (v > 0) setNewLimit({ ...newLimit, value: String(v - 10) });
                    }}
                  >
                    -
                  </button>
                  <input
                    className={styles.stepperInput}
                    type="number"
                    value={newLimit.value}
                    onChange={(e) => setNewLimit({ ...newLimit, value: e.target.value })}
                    placeholder="100"
                    required
                  />
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={() => {
                      const v = parseInt(newLimit.value || '0', 10);
                      setNewLimit({ ...newLimit, value: String(v + 10) });
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('admin.limit_period')}</label>
                <select
                  className={styles.formSelect}
                  value={newLimit.period}
                  onChange={(e) => setNewLimit({ ...newLimit, period: e.target.value })}
                >
                  <option value="monthly">{t('admin.monthly')}</option>
                  <option value="weekly">{t('admin.weekly')}</option>
                  <option value="daily">{t('admin.daily')}</option>
                </select>
              </div>
            </div>
            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={!newLimit.key || !newLimit.value}
              >
                {t('admin.add_limit')}
              </button>
            </div>
          </form>

          {limits.length === 0 ? (
            <p className={styles.empty}>{t('admin.no_limits')}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('admin.limit_key')}</th>
                  <th>{t('admin.limit_value')}</th>
                  <th>{t('admin.limit_period')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {limits.map((limit) => (
                  <LimitRow
                    key={limit.id}
                    limit={limit}
                    onSave={handleUpdateLimit}
                    onDelete={handleDeleteLimit}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'features' && (
        <div className={styles.section}>
          <form className={styles.form} onSubmit={handleAddFeature}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('admin.feature_key')}</label>
                <select
                  className={styles.formSelect}
                  value={newFeature.key}
                  onChange={(e) => {
                    const selectedKey = e.target.value;
                    const def = KNOWN_FEATURE_KEYS.find((f) => f.key === selectedKey);
                    let defaultValue = 'true';
                    if (def?.valueType.type === 'enum') {
                      defaultValue = def.valueType.options[0] ?? 'false';
                    } else if (def?.valueType.type === 'number') {
                      defaultValue = '1';
                    }
                    setNewFeature({ key: selectedKey, value: defaultValue });
                  }}
                  required
                >
                  <option value="">{t('admin.select_feature_key')}</option>
                  {KNOWN_FEATURE_KEYS.filter((fk) => !features.some((f) => f.key === fk.key)).map(
                    (fk) => (
                      <option key={fk.key} value={fk.key}>
                        {fk.label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('admin.feature_value')}</label>
                <FeatureValueInput
                  featureKey={newFeature.key}
                  value={newFeature.value}
                  onChange={(v) => setNewFeature({ ...newFeature, value: v })}
                />
              </div>
            </div>
            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={!newFeature.key || !newFeature.value}
              >
                {t('admin.add_feature')}
              </button>
            </div>
          </form>

          {features.length === 0 ? (
            <p className={styles.empty}>{t('admin.no_features')}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('admin.feature_key')}</th>
                  <th>{t('admin.feature_value')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature) => (
                  <FeatureRow
                    key={feature.id}
                    feature={feature}
                    onSave={handleUpdateFeature}
                    onDelete={handleDeleteFeature}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function LimitRow({
  limit,
  onSave,
  onDelete,
  t,
}: {
  limit: PlanLimit;
  onSave: (id: string, value: number) => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(limit.value));
  const label = KNOWN_LIMIT_KEYS.find((lk) => lk.key === limit.key)?.label ?? limit.key;

  return (
    <tr>
      <td>
        <code title={limit.key}>{label}</code>
      </td>
      <td>
        {editing ? (
          <div className={styles.inlineEdit}>
            <div className={styles.numberStepper}>
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => {
                  const v = parseInt(value || '0', 10);
                  if (v > 0) setValue(String(v - 10));
                }}
              >
                -
              </button>
              <input
                className={styles.stepperInput}
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => {
                  const v = parseInt(value || '0', 10);
                  setValue(String(v + 10));
                }}
              >
                +
              </button>
            </div>
            <button
              className={styles.secondaryButton}
              onClick={() => {
                onSave(limit.id, parseInt(value, 10));
                setEditing(false);
              }}
            >
              {t('common.save')}
            </button>
            <button
              className={styles.secondaryButton}
              onClick={() => {
                setValue(String(limit.value));
                setEditing(false);
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <strong>{limit.value === -1 ? '\u221E' : limit.value}</strong>
        )}
      </td>
      <td>{limit.period}</td>
      <td>
        {!editing && (
          <div className={styles.inlineEdit}>
            <button className={styles.secondaryButton} onClick={() => setEditing(true)}>
              {t('common.edit')}
            </button>
            <button className={styles.dangerButton} onClick={() => onDelete(limit.id)}>
              {t('admin.delete_limit')}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

/** Context-sensitive value input for feature keys */
function FeatureValueInput({
  featureKey,
  value,
  onChange,
  inline,
}: {
  featureKey: string;
  value: string;
  onChange: (v: string) => void;
  inline?: boolean;
}) {
  const def = KNOWN_FEATURE_KEYS.find((f) => f.key === featureKey);
  const inputClass = inline ? styles.inlineInput : styles.formSelect;

  if (!def || def.valueType.type === 'boolean') {
    return (
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (def.valueType.type === 'enum') {
    return (
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {def.valueType.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  // number type
  return (
    <div className={styles.numberStepper}>
      <button
        type="button"
        className={styles.stepperBtn}
        onClick={() => {
          const v = parseInt(value || '0', 10);
          if (v > 0) onChange(String(v - 1));
        }}
      >
        -
      </button>
      <input
        className={styles.stepperInput}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className={styles.stepperBtn}
        onClick={() => {
          const v = parseInt(value || '0', 10);
          onChange(String(v + 1));
        }}
      >
        +
      </button>
    </div>
  );
}

function FeatureRow({
  feature,
  onSave,
  onDelete,
  t,
}: {
  feature: PlanFeature;
  onSave: (id: string, value: string) => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(feature.value);
  const label = KNOWN_FEATURE_KEYS.find((fk) => fk.key === feature.key)?.label ?? feature.key;

  return (
    <tr>
      <td>
        <code title={feature.key}>{label}</code>
      </td>
      <td>
        {editing ? (
          <div className={styles.inlineEdit}>
            <FeatureValueInput featureKey={feature.key} value={value} onChange={setValue} inline />
            <button
              className={styles.secondaryButton}
              onClick={() => {
                onSave(feature.id, value);
                setEditing(false);
              }}
            >
              {t('common.save')}
            </button>
            <button
              className={styles.secondaryButton}
              onClick={() => {
                setValue(feature.value);
                setEditing(false);
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <FeatureValueBadge value={feature.value} />
        )}
      </td>
      <td>
        {!editing && (
          <div className={styles.inlineEdit}>
            <button className={styles.secondaryButton} onClick={() => setEditing(true)}>
              {t('common.edit')}
            </button>
            <button className={styles.dangerButton} onClick={() => onDelete(feature.id)}>
              {t('admin.delete_feature')}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

/** Visual badge for feature values (green=true, red=false, neutral=other) */
function FeatureValueBadge({ value }: { value: string }) {
  if (value === 'true') {
    return <span className={`${styles.badge} ${styles.badgeActive}`}>{value}</span>;
  }
  if (value === 'false') {
    return <span className={`${styles.badge} ${styles.badgeInactive}`}>{value}</span>;
  }
  return <span>{value}</span>;
}

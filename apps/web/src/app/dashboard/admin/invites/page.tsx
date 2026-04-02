'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { formatDate } from '@/lib/format';
import styles from '../admin.module.css';

interface InviteLink {
  id: string;
  code: string;
  label: string;
  description: string | null;
  maxUses: number | null;
  usesCount: number;
  accessLevel: string;
  isActive: boolean;
  createdBy: string;
  expiresAt: string | null;
  createdAt: string;
}

export default function AdminInvitesPage() {
  const { t, locale } = useAuth();
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formAccessLevel, setFormAccessLevel] = useState('read');
  const [formLabel, setFormLabel] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMaxUses, setFormMaxUses] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  async function fetchData() {
    try {
      const [linksRes, settingRes] = await Promise.all([
        apiClient.get<InviteLink[]>('/v1/admin/invites'),
        apiClient.get<{ enabled: boolean }>('/v1/admin/settings/invite'),
      ]);
      if (linksRes.data) setLinks(linksRes.data);
      if (settingRes.data) setGlobalEnabled(settingRes.data.enabled);
    } catch {
      setErrorMsg(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function toggleGlobal() {
    const res = await apiClient.put<{ enabled: boolean }>('/v1/admin/settings/invite', {
      enabled: !globalEnabled,
    });
    if (res.data) {
      setGlobalEnabled(res.data.enabled);
      showSuccess(t('invite.toggle_success'));
    }
  }

  async function toggleLink(id: string, isActive: boolean) {
    const res = await apiClient.patch<InviteLink>(`/v1/admin/invites/${id}`, {
      isActive: !isActive,
    });
    if (res.data) {
      showSuccess(t('invite.link_updated'));
      await fetchData();
    }
  }

  async function deleteLink(id: string) {
    if (!confirm(t('invite.confirm_delete'))) return;
    await apiClient.delete(`/v1/admin/invites/${id}`);
    showSuccess(t('invite.link_deleted'));
    await fetchData();
  }

  async function createLink() {
    setFormSubmitting(true);
    setErrorMsg('');
    const body: Record<string, unknown> = {
      label: formLabel,
      accessLevel: formAccessLevel,
    };
    if (formCode.trim()) body['code'] = formCode.trim();
    if (formDesc.trim()) body['description'] = formDesc.trim();
    if (formMaxUses) body['maxUses'] = parseInt(formMaxUses, 10);
    if (formExpiry) body['expiresInDays'] = parseInt(formExpiry, 10);

    const res = await apiClient.post<InviteLink>('/v1/admin/invites', body);
    setFormSubmitting(false);
    if (res.error) {
      setErrorMsg(res.error.message);
      return;
    }
    setFormAccessLevel('read');
    setFormLabel('');
    setFormCode('');
    setFormDesc('');
    setFormMaxUses('');
    setFormExpiry('');
    setShowForm(false);
    showSuccess(t('invite.link_created'));
    await fetchData();
  }

  function copyInviteUrl(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      showSuccess(t('invite.copied'));
    });
  }

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <h1 className={styles.title}>{t('invite.admin_title')}</h1>
      </div>

      {successMsg && <div className={styles.successMessage}>{successMsg}</div>}
      {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}

      {/* Global toggle */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.subtitle}>{t('invite.global_toggle')}</span>
          <button
            className={globalEnabled ? styles.dangerButton : styles.primaryButton}
            onClick={toggleGlobal}
          >
            {globalEnabled ? t('invite.disable_global') : t('invite.enable_global')}
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          {globalEnabled ? t('invite.global_enabled_desc') : t('invite.global_disabled_desc')}
        </p>
      </div>

      {/* Create button */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.subtitle}>{t('invite.links_title')}</span>
          <button className={styles.primaryButton} onClick={() => setShowForm(!showForm)}>
            {showForm ? t('common.cancel') : t('invite.create_link')}
          </button>
        </div>

        {showForm && (
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('invite.label')} *</label>
              <input
                className={styles.formInput}
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder={t('invite.label_placeholder')}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('invite.access_level')} *</label>
              <select
                className={styles.formSelect}
                value={formAccessLevel}
                onChange={(e) => setFormAccessLevel(e.target.value)}
              >
                <option value="read">{t('invite.access_read')}</option>
                <option value="readwrite">{t('invite.access_readwrite')}</option>
              </select>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('invite.code_custom')}</label>
                <input
                  className={styles.formInput}
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder={t('invite.code_placeholder')}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('invite.max_uses')}</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="1"
                  value={formMaxUses}
                  onChange={(e) => setFormMaxUses(e.target.value)}
                  placeholder={t('invite.unlimited')}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('invite.expires_in_days')}</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="1"
                  max="365"
                  value={formExpiry}
                  onChange={(e) => setFormExpiry(e.target.value)}
                  placeholder={t('invite.never')}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('invite.description')}</label>
              <input
                className={styles.formInput}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder={t('invite.desc_placeholder')}
              />
            </div>
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={!formLabel.trim() || formSubmitting}
                onClick={createLink}
              >
                {formSubmitting ? t('common.loading') : t('invite.create_link')}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {links.length === 0 ? (
          <p className={styles.empty}>{t('invite.no_links')}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('invite.code')}</th>
                <th>{t('invite.label')}</th>
                <th>{t('invite.access_level')}</th>
                <th>{t('invite.uses')}</th>
                <th>{t('invite.status')}</th>
                <th>{t('invite.expires')}</th>
                <th>{t('invite.created')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
                const isExhausted = link.maxUses !== null && link.usesCount >= link.maxUses;

                return (
                  <tr key={link.id}>
                    <td>
                      <code>{link.code}</code>
                    </td>
                    <td>{link.label}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${link.accessLevel === 'readwrite' ? styles.badgeActive : ''}`}
                      >
                        {link.accessLevel === 'readwrite'
                          ? t('invite.access_readwrite')
                          : t('invite.access_read')}
                      </span>
                    </td>
                    <td>
                      {link.usesCount}
                      {link.maxUses !== null ? ` / ${link.maxUses}` : ''}
                    </td>
                    <td>
                      {!link.isActive ? (
                        <span className={`${styles.badge} ${styles.badgeInactive}`}>
                          {t('invite.inactive')}
                        </span>
                      ) : isExpired ? (
                        <span className={`${styles.badge} ${styles.badgeInactive}`}>
                          {t('invite.expired')}
                        </span>
                      ) : isExhausted ? (
                        <span className={`${styles.badge} ${styles.badgeInactive}`}>
                          {t('invite.exhausted')}
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeActive}`}>
                          {t('invite.active')}
                        </span>
                      )}
                    </td>
                    <td>
                      {link.expiresAt ? formatDate(link.expiresAt, locale) : t('invite.never')}
                    </td>
                    <td>{formatDate(link.createdAt, locale)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => copyInviteUrl(link.code)}
                          title={t('invite.copy_url')}
                        >
                          URL
                        </button>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => toggleLink(link.id, link.isActive)}
                        >
                          {link.isActive ? t('invite.deactivate') : t('invite.activate')}
                        </button>
                        <button className={styles.dangerButton} onClick={() => deleteLink(link.id)}>
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

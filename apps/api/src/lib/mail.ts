import { Resend } from 'resend';
import { config } from '../config.js';
import type { TranslationDictionary } from '@onebrain/i18n';
import { getTranslations, t } from '@onebrain/i18n';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!config.mail.resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    _resend = new Resend(config.mail.resendApiKey);
  }
  return _resend;
}

function buildImpressum(translations: TranslationDictionary): string {
  const provider = t(translations, 'legal.impressum.provider_text');
  const contact = t(translations, 'legal.impressum.contact_text');
  return provider && contact ? `${provider}\n${contact}` : 'IMPRESSUM';
}

function buildImpressumHtml(translations: TranslationDictionary): string {
  const provider = t(translations, 'legal.impressum.provider_text');
  const contact = t(translations, 'legal.impressum.contact_text');
  if (!provider || !contact) return '<p>IMPRESSUM</p>';
  return `<p style="margin:0">${provider}</p><p style="margin:4px 0 0">${contact}</p>`;
}

function emailLayout(content: string, impressumHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center">
          <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">OneBrain</span><span style="font-size:24px;font-weight:300;color:#8b8ba3;letter-spacing:-0.5px">.rocks</span>
        </td></tr>
        <tr><td style="padding:40px">
          ${content}
        </td></tr>
        <tr><td style="padding:24px 40px;background:#f9f9fb;border-top:1px solid #e8e8ec;text-align:center">
          <p style="margin:0 0 8px;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Impressum</p>
          <div style="font-size:12px;color:#6b7280;line-height:1.5">
            ${impressumHtml}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendMagicLinkEmail(
  email: string,
  token: string,
  locale: string,
): Promise<void> {
  const translations = await getTranslations(locale);
  const subject = t(translations, 'auth.magic_link.email_subject');
  const body = t(translations, 'auth.magic_link.email_body');
  const buttonText = t(translations, 'auth.magic_link.email_button');
  const expireNote = t(translations, 'auth.magic_link.email_expire_note');
  const magicLinkUrl = `${config.cors.origin}/auth/verify?token=${token}`;
  const impressumText = buildImpressum(translations);
  const impressumHtml = buildImpressumHtml(translations);

  const content = `
    <p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;line-height:1.6">${body}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
      <tr><td align="center">
        <a href="${magicLinkUrl}" style="display:inline-block;padding:14px 32px;background:#6c5ce7;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px">${buttonText}</a>
      </td></tr>
    </table>
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.5">${expireNote}</p>
    <p style="margin:0;font-size:12px;color:#9ca3af;word-break:break-all"><a href="${magicLinkUrl}" style="color:#6c5ce7">${magicLinkUrl}</a></p>`;

  await getResend().emails.send({
    from: config.mail.from,
    to: email,
    subject,
    text: `${subject}\n\n${body}\n\n${magicLinkUrl}\n\n${expireNote}\n\n---\nImpressum\n${impressumText}`,
    html: emailLayout(content, impressumHtml),
  });
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  locale: string,
): Promise<void> {
  const translations = await getTranslations(locale);
  const subject = t(translations, 'auth.email_verify.subject');
  const bodyText = t(translations, 'auth.email_verify.body');
  const verifyUrl = `${config.cors.origin}/auth/verify-email?token=${token}`;
  const impressumText = buildImpressum(translations);
  const impressumHtml = buildImpressumHtml(translations);

  const content = `
    <p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;line-height:1.6">${bodyText}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
      <tr><td align="center">
        <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background:#6c5ce7;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px">${subject}</a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:12px;color:#9ca3af;word-break:break-all"><a href="${verifyUrl}" style="color:#6c5ce7">${verifyUrl}</a></p>`;

  await getResend().emails.send({
    from: config.mail.from,
    to: email,
    subject,
    text: `${subject}\n\n${bodyText}\n\n${verifyUrl}\n\n---\nImpressum\n${impressumText}`,
    html: emailLayout(content, impressumHtml),
  });
}

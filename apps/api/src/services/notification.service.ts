import { getClient } from '@onebrain/db';
import { Resend } from 'resend';
import { config } from '../config.js';
import { getTranslations, t } from '@onebrain/i18n';

const resend = new Resend(config.mail.resendApiKey);

/**
 * Send daily question email reminder to a user.
 * Checks notification preferences before sending.
 */
export async function sendDailyQuestionEmail(userId: string): Promise<boolean> {
  const prisma = getClient();

  const [user, prefs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
    prisma.notificationPreference.findUnique({
      where: { userId },
    }),
  ]);

  if (!user) return false;
  if (!prefs?.emailDaily) return false;

  const locale = 'en';
  const translations = await getTranslations(locale);
  const subject = t(translations, 'daily.email_subject');
  const dashboardUrl = `${config.cors.origin}/dashboard`;

  try {
    await resend.emails.send({
      from: config.mail.from,
      to: user.email,
      subject,
      text: [t(translations, 'daily.email_body'), '', dashboardUrl].join('\n'),
      html: `
        <h2>${subject}</h2>
        <p>${t(translations, 'daily.email_body')}</p>
        <p>
          <a href="${dashboardUrl}"
             style="display:inline-block;padding:10px 20px;
             background:#111;color:#fff;text-decoration:none;
             border-radius:6px;">
            ${t(translations, 'daily.email_cta')}
          </a>
        </p>
      `,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Send daily question emails to all users with
 * dailyQuestionEmail enabled.
 */
export async function sendDailyQuestionEmails(): Promise<number> {
  const prisma = getClient();

  const prefs = await prisma.notificationPreference.findMany({
    where: { emailDaily: true },
    select: { userId: true },
  });

  let sent = 0;
  for (const pref of prefs) {
    const result = await sendDailyQuestionEmail(pref.userId);
    if (result) sent++;
  }

  return sent;
}

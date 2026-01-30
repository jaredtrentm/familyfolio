import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Use verified domain or Resend test sender
// To use your own domain, verify it in Resend dashboard and set FROM_EMAIL env var
const FROM_EMAIL = process.env.FROM_EMAIL || 'FamilyFolio <onboarding@resend.dev>';

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  locale: string = 'en'
): Promise<{ success: boolean; error?: string }> {
  const isEnglish = locale === 'en';

  const subject = isEnglish
    ? 'Reset your FamilyFolio password'
    : '重置您的 FamilyFolio 密码';

  const html = isEnglish
    ? `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669; margin-bottom: 24px;">Reset Your Password</h2>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          You requested a password reset for your FamilyFolio account.
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Click the button below to set a new password. This link will expire in 1 hour.
        </p>
        <div style="margin: 32px 0;">
          <a href="${resetUrl}"
             style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          If you didn't request this password reset, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          FamilyFolio - Family Portfolio Tracking
        </p>
      </div>
    `
    : `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669; margin-bottom: 24px;">重置密码</h2>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          您请求重置 FamilyFolio 账户密码。
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          点击下面的按钮设置新密码。此链接将在1小时后过期。
        </p>
        <div style="margin: 32px 0;">
          <a href="${resetUrl}"
             style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
            重置密码
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          如果您没有请求重置密码，可以忽略此邮件。
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          FamilyFolio - 家庭投资组合追踪
        </p>
      </div>
    `;

  try {
    // Only skip if no API key is set
    if (!process.env.RESEND_API_KEY) {
      console.log('[Email Service] No RESEND_API_KEY set. Would send password reset to:', email);
      console.log('[Email Service] Reset URL:', resetUrl);
      return { success: true };
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    });

    if (error) {
      console.error('[Email Service] Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

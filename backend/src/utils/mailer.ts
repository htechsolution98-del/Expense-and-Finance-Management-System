import nodemailer from 'nodemailer';
import { logger } from '../config/logger';

// Create nodemailer transport using SMTP settings if available
const createTransport = () => {
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt((process.env.SMTP_PORT || '587').trim(), 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (host && user && pass) {
    logger.info(`SMTP configuration found. Using mailer transport: ${host}:${port}`);
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });
  }

  logger.warn('SMTP configuration not fully set. Email mailer is running in MOCK / CONSOLE mode.');
  return null;
};

const transporter = createTransport();

export const sendOTPEmail = async (email: string, otp: string): Promise<boolean> => {
  const subject = 'Your Password Reset OTP — KaryaNiyantrak';
  const text = `Hello,

You requested a password reset for your account on the KaryaNiyantrak Financial Control Portal.

Your One-Time Password (OTP) is:

✨ ${otp} ✨

This OTP is valid for the next 10 minutes. If you did not request this, please ignore this email.

Best regards,
KaryaNiyantrak System Administrator`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-card: 16px; background-color: #ffffff;">
      <h2 style="color: #1e293b; text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 10px;">Password Reset OTP</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">Hello,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">You requested a password reset for your account on the <strong>KaryaNiyantrak Financial Control Portal</strong>.</p>
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 15px; text-align: center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #10b981;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 12px; line-height: 1.5;">This OTP is valid for the next <strong>10 minutes</strong>. If you did not request this reset, please ignore this email securely.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center;">KaryaNiyantrak Financial Control Portal &bull; System Generated Notification</p>
    </div>
  `;

  if (transporter) {
    try {
      const from = process.env.SMTP_FROM || '"KaryaNiyantrak Portal" <no-reply@company.com>';
      await transporter.sendMail({
        from,
        to: email,
        subject,
        text,
        html,
      });
      logger.info(`Password reset OTP sent successfully via SMTP to: ${email}`);
      return true;
    } catch (error: any) {
      logger.error(`Error sending email via SMTP: ${error?.message || error}`);
      // Fallback to console print if SMTP fails
    }
  }

  // Console fallback output
  console.log('\n==================================================');
  console.log(`📧 [EMAIL MOCK] Sending OTP to: ${email}`);
  console.log(`🔑 RESET OTP CODE: ${otp}`);
  console.log('==================================================\n');
  logger.info(`[MOCK] Password reset OTP logged to console for: ${email}`);
  return true;
};

interface CompanyInfo {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  currency?: string;
}

export const sendWelcomeEmail = async (
  email: string,
  name: string,
  password: string,
  role: string,
  company?: CompanyInfo
): Promise<boolean> => {
  const companyName = company?.name || 'KaryaNiyantrak Portal';
  const portalUrl = process.env.FRONTEND_URL || 'https://your-portal.onrender.com';

  const subject = `Welcome to ${companyName} — Your Account is Ready`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e2e8f0; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 28px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">
          ${companyName}
        </h1>
        ${company?.address ? `<p style="color: #a7f3d0; font-size: 12px; margin: 6px 0 0 0;">${company.address}</p>` : ''}
        ${company?.phone ? `<p style="color: #a7f3d0; font-size: 12px; margin: 4px 0 0 0;">📞 ${company.phone}</p>` : ''}
        ${company?.email ? `<p style="color: #a7f3d0; font-size: 12px; margin: 4px 0 0 0;">✉️ ${company.email}</p>` : ''}
        ${company?.gstin ? `<p style="color: #a7f3d0; font-size: 11px; margin: 6px 0 0 0;">GSTIN: ${company.gstin}</p>` : ''}
      </div>

      <!-- Body -->
      <div style="padding: 28px 24px;">
        <h2 style="color: #1e293b; margin: 0 0 6px 0; font-size: 18px;">Welcome Aboard! 🎉</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
          Hello <strong>${name}</strong>, your employee account has been successfully created on the
          <strong>${companyName}</strong> portal. Here are your login credentials:
        </p>

        <!-- Credentials Box -->
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: bold; width: 40%; border-bottom: 1px solid #e2e8f0;">🌐 Portal Login</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                <a href="${portalUrl}" style="color: #10b981; font-size: 13px; text-decoration: none;">${portalUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">📧 Email / Login ID</td>
              <td style="padding: 10px 0; color: #1e293b; font-size: 13px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">🔒 Password</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="background-color: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 6px; padding: 4px 14px; font-size: 16px; font-weight: bold; letter-spacing: 3px; color: #065f46;">
                  ${password}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: bold;">👤 Access Role</td>
              <td style="padding: 10px 0;">
                <span style="background-color: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; border-radius: 6px; padding: 3px 10px; font-size: 12px; font-weight: bold;">
                  ${role}
                </span>
              </td>
            </tr>
          </table>
        </div>

        <p style="color: #ef4444; font-size: 12px; font-weight: bold; margin: 0 0 16px 0;">
          ⚠️ For your security, please change your password immediately after your first login.
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">
          ${companyName} &bull; System Generated Notification &bull; Do not reply to this email
        </p>
        ${company?.gstin ? `<p style="color: #cbd5e1; font-size: 10px; margin: 4px 0 0 0;">GSTIN: ${company.gstin} | Currency: ${company.currency || 'INR'}</p>` : ''}
      </div>
    </div>
  `;

  const text = `Welcome to ${companyName}!\n\nHello ${name},\nYour account has been created.\n\nPortal: ${portalUrl}\nLogin Email: ${email}\nPassword: ${password}\nRole: ${role}\n\nPlease change your password after first login.\n\n${companyName}`;

  if (transporter) {
    try {
      const from = process.env.SMTP_FROM || `"${companyName}" <no-reply@company.com>`;
      await transporter.sendMail({ from, to: email, subject, text, html });
      logger.info(`Welcome email sent successfully to: ${email}`);
      return true;
    } catch (error: any) {
      logger.error(`Error sending welcome email: ${error?.message || error}`);
    }
  }

  // Console fallback
  console.log('\n==================================================');
  console.log(`📧 [EMAIL MOCK] Welcome email for: ${email}`);
  console.log(`🏢 Company: ${companyName}`);
  console.log(`👤 Name: ${name} | Role: ${role}`);
  console.log(`🔑 Password: ${password}`);
  console.log('==================================================\n');
  return true;
};


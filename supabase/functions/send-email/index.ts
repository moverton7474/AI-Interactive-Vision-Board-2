/**
 * Send Email Edge Function
 *
 * Comprehensive email sending service using Resend API.
 * Supports all transactional and marketing emails for the platform.
 *
 * Environment Variables Required:
 * - RESEND_API_KEY: Your Resend API key
 * - FROM_EMAIL: Verified sender email (e.g., noreply@yourdomain.com)
 * - SITE_URL: Your application URL for email links
 *
 * IMPORTANT: Domain Verification Note
 * ------------------------------------
 * If your domain is managed by Wix, you may encounter DKIM verification failures
 * because Wix doesn't support underscore subdomains (e.g., resend._domainkey).
 * In this case, either:
 * 1. Migrate DNS to a provider that supports underscore subdomains (Cloudflare, Route53, etc.)
 * 2. Use Resend's shared domain (noreply@resend.dev) as a temporary workaround
 * 3. Register a separate domain for email that isn't managed by Wix
 *
 * The fallback domain uses Resend's shared sending domain to ensure email
 * delivery even when custom domain verification is incomplete.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Email template types
type EmailTemplate =
  | 'signup_confirmation'
  | 'welcome'
  | 'password_reset'
  | 'password_changed'
  | 'email_changed'
  | 'security_alert'
  | 'weekly_review'
  | 'milestone_celebration'
  | 'habit_reminder'
  | 'streak_milestone'
  | 'pace_warning'
  | 'coach_message'
  | 'generic'
  // Team Communication Templates
  | 'team_announcement'
  | 'team_recognition'
  | 'team_reminder'
  | 'manager_direct_message';

interface EmailRequest {
  to: string;
  template: EmailTemplate;
  data?: Record<string, any>;
  subject?: string; // Override for generic template
  html?: string; // Override for generic template
  userId?: string; // For logging
}

interface EmailLog {
  user_id?: string;
  to_email: string;
  template: string;
  subject: string;
  status: 'sent' | 'failed' | 'bounced';
  resend_id?: string;
  error?: string;
}

// Brand colors and styles for emails
const brandStyles = {
  primaryColor: '#D4AF37', // Gold
  secondaryColor: '#1E3A5F', // Navy
  backgroundColor: '#0F1419', // Charcoal
  textColor: '#F5F5F5',
  mutedColor: '#9CA3AF',
  successColor: '#10B981',
  warningColor: '#F59E0B',
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
};

/**
 * Generate email header with logo
 */
function emailHeader(title?: string): string {
  return `
    <div style="background: linear-gradient(135deg, ${brandStyles.secondaryColor} 0%, ${brandStyles.backgroundColor} 100%); padding: 40px 20px; text-align: center; border-bottom: 3px solid ${brandStyles.primaryColor};">
      <h1 style="color: ${brandStyles.primaryColor}; font-size: 32px; margin: 0; font-family: ${brandStyles.fontFamily}; font-weight: 700;">
        ✨ Visionary
      </h1>
      ${title ? `<p style="color: ${brandStyles.textColor}; font-size: 16px; margin: 15px 0 0 0; opacity: 0.9;">${title}</p>` : ''}
    </div>
  `;
}

/**
 * Generate email footer
 */
function emailFooter(siteUrl: string): string {
  return `
    <div style="background-color: ${brandStyles.backgroundColor}; padding: 30px 20px; text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.2);">
      <p style="color: ${brandStyles.mutedColor}; font-size: 14px; margin: 0 0 10px 0; font-family: ${brandStyles.fontFamily};">
        Sent with ❤️ by your Vision Coach
      </p>
      <p style="color: ${brandStyles.mutedColor}; font-size: 12px; margin: 0; font-family: ${brandStyles.fontFamily};">
        <a href="${siteUrl}/settings" style="color: ${brandStyles.primaryColor}; text-decoration: none;">Manage Preferences</a>
        &nbsp;|&nbsp;
        <a href="${siteUrl}/help" style="color: ${brandStyles.primaryColor}; text-decoration: none;">Help Center</a>
      </p>
      <p style="color: ${brandStyles.mutedColor}; font-size: 11px; margin: 15px 0 0 0; font-family: ${brandStyles.fontFamily};">
        © ${new Date().getFullYear()} Visionary. All rights reserved.
      </p>
    </div>
  `;
}

/**
 * Base email wrapper
 */
function emailWrapper(content: string, siteUrl: string, headerTitle?: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Visionary</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: ${brandStyles.fontFamily};">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: ${brandStyles.backgroundColor}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
              <tr>
                <td>
                  ${emailHeader(headerTitle)}
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  ${content}
                </td>
              </tr>
              <tr>
                <td>
                  ${emailFooter(siteUrl)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Primary CTA button
 */
function ctaButton(text: string, url: string): string {
  return `
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
      <tr>
        <td align="center">
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, ${brandStyles.primaryColor} 0%, #B8963E 100%); color: ${brandStyles.backgroundColor}; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: ${brandStyles.fontFamily}; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Generate email templates
 */
function generateEmailContent(template: EmailTemplate, data: Record<string, any>, siteUrl: string): { subject: string; html: string } {
  const name = data.name || 'Visionary';

  switch (template) {
    // ===== PHASE 1: SIGNUP & CONFIRMATION =====
    case 'signup_confirmation':
      return {
        subject: 'Confirm Your Email - Welcome to Visionary',
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Welcome to Your Vision Journey! 🎯
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Thank you for joining Visionary! Please confirm your email address to activate your account and start building your vision board.
          </p>
          ${ctaButton('Confirm Email Address', data.confirmationUrl || `${siteUrl}/auth/confirm`)}
          <p style="color: ${brandStyles.mutedColor}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; font-family: ${brandStyles.fontFamily};">
            This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
          <p style="color: ${brandStyles.mutedColor}; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0; font-family: ${brandStyles.fontFamily};">
            Or copy this link: <span style="color: ${brandStyles.primaryColor};">${data.confirmationUrl || `${siteUrl}/auth/confirm`}</span>
          </p>
        `, siteUrl, 'Confirm Your Account')
      };

    // ===== PHASE 2: WELCOME EMAIL =====
    case 'welcome':
      return {
        subject: `Welcome to Visionary, ${name}! Your Journey Begins Now`,
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            You're In! Let's Build Your Vision 🚀
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Welcome to Visionary! I'm <strong style="color: ${brandStyles.primaryColor};">AMIE</strong>, your personal AI Vision Coach. I'm here to help you clarify your dreams, build actionable goals, and celebrate every milestone along the way.
          </p>

          <div style="background: rgba(212, 175, 55, 0.1); border-left: 4px solid ${brandStyles.primaryColor}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <h3 style="color: ${brandStyles.primaryColor}; font-size: 18px; margin: 0 0 15px 0; font-family: ${brandStyles.fontFamily};">
              Here's what you can do:
            </h3>
            <ul style="color: ${brandStyles.textColor}; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px; font-family: ${brandStyles.fontFamily};">
              <li>🎨 <strong>Create Vision Boards</strong> - Visualize your dreams with AI-powered image generation</li>
              <li>🎯 <strong>Set Goals & Milestones</strong> - Break big dreams into achievable steps</li>
              <li>✅ <strong>Build Daily Habits</strong> - Track streaks and build momentum</li>
              <li>💬 <strong>Chat with AMIE</strong> - Get personalized coaching anytime</li>
              <li>📊 <strong>Weekly Reviews</strong> - Reflect on progress and adjust your path</li>
            </ul>
          </div>

          ${ctaButton('Start Your First Vision Board', `${siteUrl}/dashboard`)}

          <p style="color: ${brandStyles.mutedColor}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; font-family: ${brandStyles.fontFamily};">
            Questions? Just reply to this email or chat with me in the app. I'm always here to help!
          </p>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0; font-family: ${brandStyles.fontFamily};">
            Let's make your vision a reality,<br>
            <strong style="color: ${brandStyles.primaryColor};">AMIE</strong> - Your Vision Coach
          </p>
        `, siteUrl, 'Welcome Aboard!')
      };

    // ===== PHASE 2: PASSWORD RESET =====
    case 'password_reset':
      return {
        subject: 'Reset Your Password - Visionary',
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Password Reset Request 🔐
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          ${ctaButton('Reset Password', data.resetUrl || `${siteUrl}/auth/reset-password`)}
          <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid ${brandStyles.warningColor}; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="color: ${brandStyles.textColor}; font-size: 14px; margin: 0; font-family: ${brandStyles.fontFamily};">
              ⚠️ This link expires in <strong>1 hour</strong>. If you didn't request this, please ignore this email or contact support if you're concerned.
            </p>
          </div>
          <p style="color: ${brandStyles.mutedColor}; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0; font-family: ${brandStyles.fontFamily};">
            Or copy this link: <span style="color: ${brandStyles.primaryColor};">${data.resetUrl || `${siteUrl}/auth/reset-password`}</span>
          </p>
        `, siteUrl, 'Password Reset')
      };

    // ===== PHASE 2: PASSWORD CHANGED =====
    case 'password_changed':
      return {
        subject: 'Your Password Has Been Changed - Visionary',
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Password Successfully Changed ✅
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Your password was successfully changed on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.
          </p>
          <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid ${brandStyles.successColor}; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="color: ${brandStyles.textColor}; font-size: 14px; margin: 0; font-family: ${brandStyles.fontFamily};">
              ✓ If you made this change, no further action is needed.
            </p>
          </div>
          <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #EF4444; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="color: ${brandStyles.textColor}; font-size: 14px; margin: 0; font-family: ${brandStyles.fontFamily};">
              ⚠️ If you didn't make this change, please <a href="${siteUrl}/auth/reset-password" style="color: ${brandStyles.primaryColor};">reset your password immediately</a> and contact support.
            </p>
          </div>
        `, siteUrl, 'Security Notice')
      };

    // ===== PHASE 2: EMAIL CHANGED =====
    case 'email_changed':
      return {
        subject: 'Your Email Address Has Been Updated - Visionary',
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Email Address Updated 📧
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            The email address for your Visionary account has been changed to: <strong style="color: ${brandStyles.primaryColor};">${data.newEmail}</strong>
          </p>
          <p style="color: ${brandStyles.mutedColor}; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Previous email: ${data.oldEmail}
          </p>
          <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #EF4444; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="color: ${brandStyles.textColor}; font-size: 14px; margin: 0; font-family: ${brandStyles.fontFamily};">
              ⚠️ If you didn't make this change, please contact support immediately.
            </p>
          </div>
        `, siteUrl, 'Security Notice')
      };

    // ===== PHASE 2: SECURITY ALERT =====
    case 'security_alert':
      return {
        subject: '⚠️ Security Alert - New Login to Your Account',
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            New Login Detected 🔔
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            We noticed a new sign-in to your Visionary account:
          </p>
          <div style="background: rgba(30, 58, 95, 0.5); padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; font-family: ${brandStyles.fontFamily};">
              <tr>
                <td style="color: ${brandStyles.mutedColor}; padding: 5px 0;">Device:</td>
                <td style="color: ${brandStyles.textColor}; padding: 5px 0;">${data.device || 'Unknown'}</td>
              </tr>
              <tr>
                <td style="color: ${brandStyles.mutedColor}; padding: 5px 0;">Location:</td>
                <td style="color: ${brandStyles.textColor}; padding: 5px 0;">${data.location || 'Unknown'}</td>
              </tr>
              <tr>
                <td style="color: ${brandStyles.mutedColor}; padding: 5px 0;">Time:</td>
                <td style="color: ${brandStyles.textColor}; padding: 5px 0;">${data.time || new Date().toLocaleString()}</td>
              </tr>
              <tr>
                <td style="color: ${brandStyles.mutedColor}; padding: 5px 0;">IP Address:</td>
                <td style="color: ${brandStyles.textColor}; padding: 5px 0;">${data.ip || 'Unknown'}</td>
              </tr>
            </table>
          </div>
          <p style="color: ${brandStyles.textColor}; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            If this was you, no action is needed. If you don't recognize this activity:
          </p>
          ${ctaButton('Secure My Account', `${siteUrl}/settings/security`)}
        `, siteUrl, 'Security Alert')
      };

    // ===== PHASE 3: WEEKLY REVIEW =====
    case 'weekly_review':
      const completionRate = data.completionRate || 0;
      const completionColor = completionRate >= 80 ? brandStyles.successColor : completionRate >= 50 ? brandStyles.warningColor : '#EF4444';

      return {
        subject: `Your Weekly Vision Review - ${completionRate}% Completion 📊`,
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Your Week in Review 📊
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0; font-family: ${brandStyles.fontFamily};">
            Here's how you did this week on your journey to your vision:
          </p>

          <!-- Stats Cards -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; width: 33%;">
                <div style="background: rgba(212, 175, 55, 0.1); border-radius: 8px; padding: 20px; text-align: center;">
                  <div style="font-size: 32px; font-weight: bold; color: ${completionColor}; font-family: ${brandStyles.fontFamily};">${completionRate}%</div>
                  <div style="font-size: 12px; color: ${brandStyles.mutedColor}; margin-top: 5px; font-family: ${brandStyles.fontFamily};">Completion</div>
                </div>
              </td>
              <td style="padding: 10px; width: 33%;">
                <div style="background: rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 20px; text-align: center;">
                  <div style="font-size: 32px; font-weight: bold; color: ${brandStyles.successColor}; font-family: ${brandStyles.fontFamily};">${data.habitsCompleted || 0}</div>
                  <div style="font-size: 12px; color: ${brandStyles.mutedColor}; margin-top: 5px; font-family: ${brandStyles.fontFamily};">Habits Done</div>
                </div>
              </td>
              <td style="padding: 10px; width: 33%;">
                <div style="background: rgba(30, 58, 95, 0.3); border-radius: 8px; padding: 20px; text-align: center;">
                  <div style="font-size: 32px; font-weight: bold; color: ${brandStyles.primaryColor}; font-family: ${brandStyles.fontFamily};">${data.longestStreak || 0}</div>
                  <div style="font-size: 12px; color: ${brandStyles.mutedColor}; margin-top: 5px; font-family: ${brandStyles.fontFamily};">Best Streak</div>
                </div>
              </td>
            </tr>
          </table>

          ${data.wins?.length > 0 ? `
          <!-- Wins Section -->
          <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid ${brandStyles.successColor}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <h3 style="color: ${brandStyles.successColor}; font-size: 16px; margin: 0 0 10px 0; font-family: ${brandStyles.fontFamily};">
              🏆 This Week's Wins
            </h3>
            <ul style="color: ${brandStyles.textColor}; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px; font-family: ${brandStyles.fontFamily};">
              ${data.wins.map((win: string) => `<li>${win}</li>`).join('')}
            </ul>
          </div>
          ` : ''}

          ${data.insights ? `
          <!-- AI Insights -->
          <div style="background: rgba(212, 175, 55, 0.1); border-left: 4px solid ${brandStyles.primaryColor}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <h3 style="color: ${brandStyles.primaryColor}; font-size: 16px; margin: 0 0 10px 0; font-family: ${brandStyles.fontFamily};">
              💡 AMIE's Insights
            </h3>
            <p style="color: ${brandStyles.textColor}; font-size: 14px; line-height: 1.6; margin: 0; font-family: ${brandStyles.fontFamily};">
              ${data.insights}
            </p>
          </div>
          ` : ''}

          ${ctaButton('View Full Review', `${siteUrl}/dashboard?tab=review`)}

          <p style="color: ${brandStyles.mutedColor}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; font-family: ${brandStyles.fontFamily};">
            Keep up the momentum! Every small step brings you closer to your vision.
          </p>
        `, siteUrl, 'Weekly Review')
      };

    // ===== PHASE 3: MILESTONE CELEBRATION =====
    case 'milestone_celebration':
      return {
        subject: `🎉 Milestone Achieved: ${data.milestoneTitle}!`,
        html: emailWrapper(`
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 64px; margin-bottom: 10px;">🎉</div>
            <h2 style="color: ${brandStyles.primaryColor}; font-size: 28px; margin: 0; font-family: ${brandStyles.fontFamily};">
              Congratulations, ${name}!
            </h2>
          </div>

          <p style="color: ${brandStyles.textColor}; font-size: 18px; line-height: 1.6; margin: 0 0 25px 0; text-align: center; font-family: ${brandStyles.fontFamily};">
            You've achieved an incredible milestone on your vision journey:
          </p>

          <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.05) 100%); border: 2px solid ${brandStyles.primaryColor}; border-radius: 12px; padding: 30px; text-align: center; margin: 25px 0;">
            <h3 style="color: ${brandStyles.primaryColor}; font-size: 24px; margin: 0 0 10px 0; font-family: ${brandStyles.fontFamily};">
              "${data.milestoneTitle}"
            </h3>
            ${data.goalTitle ? `<p style="color: ${brandStyles.mutedColor}; font-size: 14px; margin: 0; font-family: ${brandStyles.fontFamily};">Part of: ${data.goalTitle}</p>` : ''}
          </div>

          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 25px 0; text-align: center; font-family: ${brandStyles.fontFamily};">
            ${data.message || "This is a testament to your dedication and hard work. Every milestone brings you closer to your ultimate vision!"}
          </p>

          ${ctaButton('Celebrate & Continue', `${siteUrl}/dashboard`)}

          <p style="color: ${brandStyles.mutedColor}; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center; font-family: ${brandStyles.fontFamily};">
            Share your achievement with friends and inspire others on their journey!
          </p>
        `, siteUrl, 'Milestone Achieved!')
      };

    // ===== PHASE 3: STREAK MILESTONE =====
    case 'streak_milestone':
      const streakEmoji = data.streak >= 100 ? '🏆' : data.streak >= 30 ? '🔥' : '⭐';
      return {
        subject: `${streakEmoji} ${data.streak}-Day Streak! You're on Fire!`,
        html: emailWrapper(`
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 64px; margin-bottom: 10px;">${streakEmoji}</div>
            <h2 style="color: ${brandStyles.primaryColor}; font-size: 28px; margin: 0; font-family: ${brandStyles.fontFamily};">
              ${data.streak}-Day Streak!
            </h2>
          </div>

          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0; text-align: center; font-family: ${brandStyles.fontFamily};">
            Amazing work, ${name}! You've maintained your <strong style="color: ${brandStyles.primaryColor};">"${data.habitTitle}"</strong> habit for ${data.streak} consecutive days!
          </p>

          <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%); border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0;">
            <p style="color: ${brandStyles.successColor}; font-size: 18px; margin: 0; font-family: ${brandStyles.fontFamily};">
              ${data.streak >= 100 ? "🏆 LEGENDARY! You're in the top 1% of habit builders!" :
                data.streak >= 30 ? "🔥 ONE MONTH! You've built a life-changing habit!" :
                "⭐ ONE WEEK! You're building unstoppable momentum!"}
            </p>
          </div>

          ${ctaButton('Keep the Streak Alive', `${siteUrl}/dashboard?tab=habits`)}
        `, siteUrl, 'Streak Achievement!')
      };

    // ===== PHASE 3: HABIT REMINDER =====
    case 'habit_reminder':
      return {
        subject: `⏰ Reminder: Time for "${data.habitTitle}"`,
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Time for Your Habit! ⏰
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0; font-family: ${brandStyles.fontFamily};">
            Just a friendly reminder to complete your habit:
          </p>

          <div style="background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: ${brandStyles.primaryColor}; font-size: 20px; margin: 0 0 10px 0; font-family: ${brandStyles.fontFamily};">
              "${data.habitTitle}"
            </h3>
            ${data.streak > 0 ? `
            <p style="color: ${brandStyles.successColor}; font-size: 14px; margin: 0; font-family: ${brandStyles.fontFamily};">
              🔥 Current streak: <strong>${data.streak} days</strong> - Don't break the chain!
            </p>
            ` : ''}
          </div>

          ${ctaButton('Mark as Complete', `${siteUrl}/dashboard?tab=habits&complete=${data.habitId}`)}

          <p style="color: ${brandStyles.mutedColor}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; font-family: ${brandStyles.fontFamily};">
            Small consistent actions lead to extraordinary results. You've got this!
          </p>
        `, siteUrl, 'Habit Reminder')
      };

    // ===== PHASE 3: PACE WARNING =====
    case 'pace_warning':
      return {
        subject: `📊 Pace Check: "${data.goalTitle}" needs attention`,
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Let's Get Back on Track 📊
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0; font-family: ${brandStyles.fontFamily};">
            I noticed your goal <strong style="color: ${brandStyles.primaryColor};">"${data.goalTitle}"</strong> might need some attention:
          </p>

          <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid ${brandStyles.warningColor}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="color: ${brandStyles.textColor}; font-size: 14px; margin: 0 0 10px 0; font-family: ${brandStyles.fontFamily};">
              At your current pace, you may be <strong>${data.delayWeeks} weeks behind</strong> your target date.
            </p>
            <p style="color: ${brandStyles.mutedColor}; font-size: 13px; margin: 0; font-family: ${brandStyles.fontFamily};">
              Target: ${data.targetDate} | Projected: ${data.projectedDate}
            </p>
          </div>

          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 25px 0; font-family: ${brandStyles.fontFamily};">
            Don't worry - this is just a heads up! Here are some options:
          </p>

          <ul style="color: ${brandStyles.textColor}; font-size: 15px; line-height: 1.8; margin: 0 0 25px 0; padding-left: 20px; font-family: ${brandStyles.fontFamily};">
            <li>📅 <strong>Adjust your timeline</strong> - It's okay to be flexible</li>
            <li>🎯 <strong>Break it down further</strong> - Smaller tasks are easier to complete</li>
            <li>💬 <strong>Talk to AMIE</strong> - Get personalized advice and support</li>
          </ul>

          ${ctaButton('Review My Goal', `${siteUrl}/goals/${data.goalId}`)}
        `, siteUrl, 'Goal Check-In')
      };

    // ===== COACH MESSAGE =====
    case 'coach_message':
      return {
        subject: data.subject || `Message from AMIE, Your Vision Coach`,
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            A Message from AMIE 💬
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <div style="background: rgba(212, 175, 55, 0.1); border-left: 4px solid ${brandStyles.primaryColor}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0; font-family: ${brandStyles.fontFamily}; font-style: italic;">
              "${data.message}"
            </p>
          </div>
          ${data.actionUrl ? ctaButton(data.actionLabel || 'Take Action', data.actionUrl) : ''}
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0; font-family: ${brandStyles.fontFamily};">
            Your Vision Coach,<br>
            <strong style="color: ${brandStyles.primaryColor};">AMIE</strong>
          </p>
        `, siteUrl, 'Coach Message')
      };

    // ===== TEAM ANNOUNCEMENT =====
    case 'team_announcement':
      return {
        subject: data.subject || `📢 Team Announcement from ${data.teamName || 'Your Team'}`,
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Team Announcement 📢
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.mutedColor}; font-size: 14px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            ${data.senderName || 'Your team manager'} from <strong style="color: ${brandStyles.primaryColor};">${data.teamName || 'your team'}</strong> has an announcement:
          </p>
          <div style="background: rgba(30, 58, 95, 0.3); border-left: 4px solid ${brandStyles.primaryColor}; padding: 25px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <div style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.8; font-family: ${brandStyles.fontFamily};">
              ${data.message || data.body_html || ''}
            </div>
          </div>
          ${data.actionUrl ? ctaButton(data.actionLabel || 'View in App', data.actionUrl) : ctaButton('Open Dashboard', `${siteUrl}/dashboard`)}
          <p style="color: ${brandStyles.mutedColor}; font-size: 13px; line-height: 1.6; margin: 25px 0 0 0; font-family: ${brandStyles.fontFamily};">
            This announcement was sent to all members of ${data.teamName || 'your team'}.
            <a href="${siteUrl}/settings/notifications" style="color: ${brandStyles.primaryColor}; text-decoration: none;">Manage notification preferences</a>
          </p>
        `, siteUrl, 'Team Announcement')
      };

    // ===== TEAM RECOGNITION =====
    case 'team_recognition':
      return {
        subject: `🏆 You've Been Recognized by ${data.senderName || 'Your Team'}!`,
        html: emailWrapper(`
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 64px; margin-bottom: 10px;">🏆</div>
            <h2 style="color: ${brandStyles.primaryColor}; font-size: 28px; margin: 0; font-family: ${brandStyles.fontFamily};">
              Kudos to You, ${name}!
            </h2>
          </div>

          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0; text-align: center; font-family: ${brandStyles.fontFamily};">
            ${data.senderName || 'Your team manager'} wants to recognize your amazing work:
          </p>

          <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.05) 100%); border: 2px solid ${brandStyles.primaryColor}; border-radius: 12px; padding: 30px; text-align: center; margin: 25px 0;">
            <p style="color: ${brandStyles.textColor}; font-size: 18px; line-height: 1.6; margin: 0; font-family: ${brandStyles.fontFamily}; font-style: italic;">
              "${data.message || data.recognitionMessage || 'Great work!'}"
            </p>
          </div>

          ${data.achievement ? `
          <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid ${brandStyles.successColor}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <h3 style="color: ${brandStyles.successColor}; font-size: 16px; margin: 0 0 10px 0; font-family: ${brandStyles.fontFamily};">
              🎯 Achievement Highlighted
            </h3>
            <p style="color: ${brandStyles.textColor}; font-size: 14px; line-height: 1.6; margin: 0; font-family: ${brandStyles.fontFamily};">
              ${data.achievement}
            </p>
          </div>
          ` : ''}

          ${ctaButton('Celebrate & Continue', `${siteUrl}/dashboard`)}

          <p style="color: ${brandStyles.mutedColor}; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0; text-align: center; font-family: ${brandStyles.fontFamily};">
            Keep up the amazing work! Your team is proud of you.
          </p>
        `, siteUrl, 'Team Recognition')
      };

    // ===== TEAM REMINDER =====
    case 'team_reminder':
      return {
        subject: `⏰ Reminder: ${data.subject || data.reminderTitle || 'Action Needed'}`,
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Quick Reminder ⏰
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.mutedColor}; font-size: 14px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            ${data.senderName || 'Your team manager'} wanted to remind you:
          </p>

          <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid ${brandStyles.warningColor}; padding: 25px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <div style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.8; font-family: ${brandStyles.fontFamily};">
              ${data.message || data.reminderMessage || ''}
            </div>
          </div>

          ${data.dueDate ? `
          <p style="color: ${brandStyles.warningColor}; font-size: 14px; margin: 20px 0; font-family: ${brandStyles.fontFamily}; text-align: center;">
            📅 <strong>Due:</strong> ${data.dueDate}
          </p>
          ` : ''}

          ${data.actionUrl ? ctaButton(data.actionLabel || 'Take Action', data.actionUrl) : ctaButton('Open Dashboard', `${siteUrl}/dashboard`)}

          <p style="color: ${brandStyles.mutedColor}; font-size: 13px; line-height: 1.6; margin: 25px 0 0 0; font-family: ${brandStyles.fontFamily};">
            Sent from ${data.teamName || 'your team'}.
            <a href="${siteUrl}/settings/notifications" style="color: ${brandStyles.primaryColor}; text-decoration: none;">Manage preferences</a>
          </p>
        `, siteUrl, 'Team Reminder')
      };

    // ===== MANAGER DIRECT MESSAGE =====
    case 'manager_direct_message':
      return {
        subject: data.subject || `Message from ${data.senderName || 'Your Manager'}`,
        html: emailWrapper(`
          <h2 style="color: ${brandStyles.textColor}; font-size: 24px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Message from ${data.senderName || 'Your Manager'} 💬
          </h2>
          <p style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            Hi ${name},
          </p>
          <p style="color: ${brandStyles.mutedColor}; font-size: 14px; margin: 0 0 20px 0; font-family: ${brandStyles.fontFamily};">
            ${data.senderName || 'Your manager'} from <strong style="color: ${brandStyles.primaryColor};">${data.teamName || 'your team'}</strong> sent you a message:
          </p>

          <div style="background: rgba(212, 175, 55, 0.1); border-left: 4px solid ${brandStyles.primaryColor}; padding: 25px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <div style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.8; font-family: ${brandStyles.fontFamily};">
              ${data.message || data.body_html || ''}
            </div>
          </div>

          ${data.actionUrl ? ctaButton(data.actionLabel || 'Respond', data.actionUrl) : ctaButton('Open Dashboard', `${siteUrl}/dashboard`)}

          <p style="color: ${brandStyles.mutedColor}; font-size: 13px; line-height: 1.6; margin: 25px 0 0 0; font-family: ${brandStyles.fontFamily};">
            This is a direct message from your team manager.
            <a href="${siteUrl}/settings/notifications" style="color: ${brandStyles.primaryColor}; text-decoration: none;">Manage notification preferences</a>
          </p>
        `, siteUrl, 'Direct Message')
      };

    // ===== GENERIC EMAIL =====
    case 'generic':
    default:
      return {
        subject: data.subject || 'Message from Visionary',
        html: emailWrapper(`
          <div style="color: ${brandStyles.textColor}; font-size: 16px; line-height: 1.6; font-family: ${brandStyles.fontFamily};">
            ${data.html || data.content || 'No content provided'}
          </div>
        `, siteUrl)
      };
  }
}

/**
 * Send email via Resend API
 */
async function sendEmail(
  resendApiKey: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.message || result.error || 'Failed to send email',
      };
    }

    return {
      success: true,
      id: result.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    // Use Resend's shared domain as fallback for reliable delivery when custom domain
    // has verification issues (e.g., Wix DNS doesn't support DKIM underscore subdomains)
    const fromEmail = Deno.env.get("FROM_EMAIL") || "Visionary AI <noreply@resend.dev>";
    const siteUrl = Deno.env.get("SITE_URL") || "https://visionary.app";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: EmailRequest = await req.json();

    const { to, template, data = {}, subject: customSubject, html: customHtml, userId } = body;

    if (!to) {
      throw new Error("'to' email address is required");
    }

    if (!template) {
      throw new Error("'template' is required");
    }

    // Generate email content from template
    const { subject, html } = generateEmailContent(template, data, siteUrl);
    const finalSubject = customSubject || subject;
    const finalHtml = customHtml || html;

    // Send the email
    const result = await sendEmail(resendApiKey, fromEmail, to, finalSubject, finalHtml);

    // Log the email
    const emailLog: EmailLog = {
      user_id: userId,
      to_email: to,
      template,
      subject: finalSubject,
      status: result.success ? 'sent' : 'failed',
      resend_id: result.id,
      error: result.error,
    };

    // Insert into email_logs table (fire and forget)
    supabase
      .from('email_logs')
      .insert(emailLog)
      .then(() => {})
      .catch((err) => console.error('Failed to log email:', err));

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.id,
        template,
        to,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

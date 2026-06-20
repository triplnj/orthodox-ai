import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

type SendPasswordResetEmailInput = {
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: SendPasswordResetEmailInput) {
  if (!resend) {
    console.log("RESEND_API_KEY is missing. Password reset link:", resetUrl);
    return;
  }

  const from = process.env.EMAIL_FROM ?? "OrthodoxAI <onboarding@resend.dev>";

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: "Reset your OrthodoxAI password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <h1 style="font-size: 24px; margin-bottom: 16px;">Reset your OrthodoxAI password</h1>

        <p style="font-size: 15px; line-height: 1.6;">
          We received a request to reset the password for your OrthodoxAI account.
        </p>

        <p style="font-size: 15px; line-height: 1.6;">
          Click the button below to set a new password. This link expires in 30 minutes.
        </p>

        <p style="margin: 24px 0;">
          <a
            href="${resetUrl}"
            style="display: inline-block; background: #030712; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;"
          >
            Reset password
          </a>
        </p>

        <p style="font-size: 13px; line-height: 1.6; color: #4b5563;">
          If the button does not work, copy and paste this link into your browser:
        </p>

        <p style="font-size: 13px; line-height: 1.6; word-break: break-all; color: #4b5563;">
          ${resetUrl}
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

        <p style="font-size: 12px; line-height: 1.6; color: #6b7280;">
          If you did not request this password reset, you can ignore this email.
        </p>

        <p style="font-size: 12px; line-height: 1.6; color: #6b7280;">
          OrthodoxAI is an educational tool and does not replace the Church, a priest, confession, pastoral counsel, medical advice, psychological help, or emergency services.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("RESEND_PASSWORD_RESET_EMAIL_ERROR:", error);
    throw new Error("Could not send password reset email.");
  }

  return data;
}

type SendEmailVerificationInput = {
  to: string;
  verifyUrl: string;
};

export async function sendEmailVerification({
  to,
  verifyUrl,
}: SendEmailVerificationInput) {
  if (!resend) {
    console.log("RESEND_API_KEY is missing. Email verification link:", verifyUrl);
    return;
  }

  const from = process.env.EMAIL_FROM ?? "OrthodoxAI <onboarding@resend.dev>";

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: "Verify your OrthodoxAI email",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <h1 style="font-size: 24px; margin-bottom: 16px;">Verify your OrthodoxAI email</h1>

        <p style="font-size: 15px; line-height: 1.6;">
          Thank you for creating an OrthodoxAI account.
        </p>

        <p style="font-size: 15px; line-height: 1.6;">
          Click the button below to verify your email address. This link expires in 24 hours.
        </p>

        <p style="margin: 24px 0;">
          <a
            href="${verifyUrl}"
            style="display: inline-block; background: #030712; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;"
          >
            Verify email
          </a>
        </p>

        <p style="font-size: 13px; line-height: 1.6; color: #4b5563;">
          If the button does not work, copy and paste this link into your browser:
        </p>

        <p style="font-size: 13px; line-height: 1.6; word-break: break-all; color: #4b5563;">
          ${verifyUrl}
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

        <p style="font-size: 12px; line-height: 1.6; color: #6b7280;">
          If you did not create this OrthodoxAI account, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("RESEND_EMAIL_VERIFICATION_ERROR:", error);
    throw new Error("Could not send email verification email.");
  }

  return data;
}
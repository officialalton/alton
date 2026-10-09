import { sendEmail } from "./email";
import { currentRequestOrigin } from "./request-origin";

const ROLE_LABEL: Record<"parent" | "student", string> = {
  parent: "parent",
  student: "student",
};

export async function sendWorkspaceProvisioningEmail(params: {
  to: string;
  workspaceEmail: string;
}): Promise<void> {
  const siteUrl = await currentRequestOrigin();
  const loginUrl = `${siteUrl}/login?role=teacher`;

  await sendEmail({
    to: params.to,
    subject: "[ALTON EDUCATION] Your Google Workspace account is ready",
    html: `
      <p>Hello,</p>
      <p>Your ALTON EDUCATION Google Workspace account has been created: <strong>${params.workspaceEmail}</strong></p>
      <p>First, sign in with this account at <a href="https://accounts.google.com">accounts.google.com</a> and change the temporary password.</p>
      <p>Once your password is updated, go <a href="${loginUrl}">here</a> and choose "Sign in with Google" to link your ALTON EDUCATION account.</p>
      <p>Thank you,<br/>ALTON EDUCATION</p>
    `,
  });
}

export async function sendInviteEmail(params: {
  to: string;
  name: string;
  token: string;
  role: "parent" | "student";
}): Promise<void> {
  const siteUrl = await currentRequestOrigin();
  const acceptUrl = `${siteUrl}/api/invite/accept?token=${encodeURIComponent(params.token)}`;

  await sendEmail({
    to: params.to,
    subject: "[ALTON EDUCATION] You're invited to join",
    html: `
      <p>Hello ${params.name},</p>
      <p>You've been invited to create a ${ROLE_LABEL[params.role]} account on ALTON EDUCATION.</p>
      <p><a href="${acceptUrl}">Click here to accept your invitation</a></p>
      <p>This link is valid for 7 days. If you weren't expecting this email, you can safely ignore it.</p>
      <p>Thank you,<br/>ALTON EDUCATION</p>
    `,
  });
}

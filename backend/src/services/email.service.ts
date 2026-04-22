import sgMail from '@sendgrid/mail';

function isConfigured(): boolean {
  return !!(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM);
}

function init(): void {
  if (isConfigured()) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  }
}

init();

export interface SigningRequestParams {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  documentTitle: string;
  subject: string;
  message?: string;
  signingUrl: string;
}

export interface SigningCompleteParams {
  ownerEmail: string;
  ownerName: string;
  recipientName: string;
  documentTitle: string;
}

export async function sendSigningRequest(params: SigningRequestParams): Promise<void> {
  if (!isConfigured()) {
    console.log(`[email] SKIP (not configured) → signing link for ${params.recipientEmail}: ${params.signingUrl}`);
    return;
  }

  const { recipientName, recipientEmail, senderName, documentTitle, subject, message, signingUrl } = params;

  const bodyText = message ? `\n\n"${message}"` : '';

  await sgMail.send({
    to: recipientEmail,
    from: { email: process.env.EMAIL_FROM!, name: process.env.EMAIL_FROM_NAME || 'eSignatureGO' },
    subject: subject || `${senderName} has sent you a document to sign`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
                <tr>
                  <td style="background:#1d4ed8;padding:32px 40px">
                    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">eSignatureGO</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px">
                    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600">You have a document to sign</h2>
                    <p style="margin:0 0 8px;color:#4b5563;font-size:15px">
                      <strong>${escapeHtml(senderName)}</strong> has requested your signature on <strong>${escapeHtml(documentTitle)}</strong>.
                    </p>
                    ${bodyText ? `<p style="margin:16px 0;color:#6b7280;font-size:14px;font-style:italic;border-left:3px solid #e5e7eb;padding-left:12px">${escapeHtml(message!)}</p>` : ''}
                    <div style="margin:32px 0">
                      <a href="${signingUrl}"
                         style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block">
                        Review &amp; Sign Document
                      </a>
                    </div>
                    <p style="margin:0;color:#9ca3af;font-size:13px">
                      Or copy this link: <a href="${signingUrl}" style="color:#1d4ed8;word-break:break-all">${signingUrl}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 40px;border-top:1px solid #f3f4f6">
                    <p style="margin:0;color:#9ca3af;font-size:12px">
                      This request was sent via eSignatureGO. If you were not expecting this, you can ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
    text: `${senderName} has sent you a document to sign: ${documentTitle}${bodyText}\n\nClick here to sign: ${signingUrl}`,
  });
}

export async function sendSigningComplete(params: SigningCompleteParams): Promise<void> {
  if (!isConfigured()) {
    console.log(`[email] SKIP (not configured) → completion notice for ${params.ownerEmail}`);
    return;
  }

  const { ownerEmail, ownerName, recipientName, documentTitle } = params;

  await sgMail.send({
    to: ownerEmail,
    from: { email: process.env.EMAIL_FROM!, name: process.env.EMAIL_FROM_NAME || 'eSignatureGO' },
    subject: `${recipientName} has signed "${documentTitle}"`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
                <tr>
                  <td style="background:#1d4ed8;padding:32px 40px">
                    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">eSignatureGO</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px">
                    <div style="display:inline-block;background:#dcfce7;border-radius:50%;width:48px;height:48px;text-align:center;line-height:48px;font-size:24px;margin-bottom:24px">✓</div>
                    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600">Document signed</h2>
                    <p style="margin:0;color:#4b5563;font-size:15px">
                      <strong>${escapeHtml(recipientName)}</strong> has completed signing <strong>${escapeHtml(documentTitle)}</strong>.
                    </p>
                    <p style="margin:16px 0 0;color:#6b7280;font-size:14px">
                      Log in to your dashboard to download the completed document.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 40px;border-top:1px solid #f3f4f6">
                    <p style="margin:0;color:#9ca3af;font-size:12px">eSignatureGO · Sent to ${escapeHtml(ownerEmail)}</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
    text: `${recipientName} has signed "${documentTitle}". Log in to your dashboard to download the completed document.`,
  });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

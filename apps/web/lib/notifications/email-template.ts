/**
 * Branded HTML wrapper for outbound email notifications.
 */

export function renderBaseTemplate(
  subject: string,
  contentHtml: string,
  stage?: number,
  unsubscribeUrl?: string,
): string {
  const stageNames = ['Disclosure', 'Fact-Find', 'Research', 'ESIS', 'Suitability'];
  const stageLabel = stage && stage >= 1 && stage <= 5 ? stageNames[stage - 1] : '';

  const headerRight = stage
    ? `<td class="email-header-meta" align="right" style="font-family:'DM Sans', Arial, sans-serif; font-size:12px; font-weight:700; color:#0F6E56; text-transform:uppercase; letter-spacing:1px;">Stage ${stage} of 5 · ${stageLabel === 'Suitability' ? 'Complete' : 'Active'}</td>`
    : '';

  let stepperHtml = '';
  if (stage && stage >= 1 && stage <= 5) {
    const steps = Array.from({ length: 5 }, (_, i) => {
      const stepNum = i + 1;
      const isCompleted = stepNum < stage;
      const isActive = stepNum === stage;
      const name = stageNames[i];

      const circleBg = isCompleted || isActive ? '#5DCAA5' : '#E2E8F0';
      const circleColor = isCompleted || isActive ? '#ffffff' : '#475569';
      const circleText = isCompleted ? '✓' : `${stepNum}`;
      const labelStyle = isActive
        ? 'color:#0F6E56; font-weight:700;'
        : 'color:#0D1F1A; opacity:0.6; font-weight:500;';

      // Connector line sits behind the circle (email-safe background technique).
      const connector =
        i === 0
          ? ''
          : `background-image:linear-gradient(to right, ${
              isCompleted || isActive ? '#5DCAA5' : '#E2E8F0'
            } 100%, transparent 0%); background-position:top 22px left 0; background-repeat:no-repeat; background-size:50% 2px;`;
      const connectorRight =
        i === 4
          ? ''
          : `background-image:linear-gradient(to right, ${
              isCompleted ? '#5DCAA5' : '#E2E8F0'
            } 100%, transparent 0%); background-position:top 22px right 0; background-repeat:no-repeat; background-size:50% 2px;`;

      // Combine left + right connectors on middle cells.
      let bgStyle = '';
      if (i > 0 && i < 4) {
        const leftColor = isCompleted || isActive ? '#5DCAA5' : '#E2E8F0';
        const rightColor = isCompleted ? '#5DCAA5' : '#E2E8F0';
        bgStyle = `background-image:linear-gradient(to right, ${leftColor} 100%, transparent 0%), linear-gradient(to right, ${rightColor} 100%, transparent 0%); background-position:top 22px left 0, top 22px right 0; background-repeat:no-repeat, no-repeat; background-size:50% 2px, 50% 2px;`;
      } else if (i > 0) {
        bgStyle = connector;
      } else if (i < 4) {
        bgStyle = connectorRight;
      }

      return `
              <td class="email-step" align="center" valign="top" width="20%" style="width:20%; padding:0 2px; ${bgStyle}">
                <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                  <tr>
                    <td align="center" style="height:12px; line-height:12px; font-size:10px; color:#5DCAA5; font-weight:bold;">
                      ${isActive ? '▼' : '&nbsp;'}
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:6px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                        <tr>
                          <td align="center" style="width:24px; height:24px; line-height:24px; border-radius:50%; background-color:${circleBg}; color:${circleColor}; font-size:11px; font-weight:bold; text-align:center;">
                            ${circleText}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="email-step-label" align="center" style="font-family:'DM Sans', Arial, sans-serif; font-size:10px; line-height:1.25; ${labelStyle} word-break:break-word;">
                      ${name}
                    </td>
                  </tr>
                </table>
              </td>`;
    }).join('');

    stepperHtml = `
        <tr>
          <td class="email-pad email-stepper-pad" style="padding:24px 40px 0 40px;">
            <table role="presentation" class="email-stepper" width="100%" cellpadding="0" cellspacing="0" style="width:100%; background-color:#ffffff; border:1px solid #E1F5EE; border-radius:24px; box-shadow:0px 8px 16px rgba(15,110,86,0.06);">
              <tr>
                <td style="padding:16px 10px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
                    <tr>
                      ${steps}
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style type="text/css">
  /* Mobile clients that honor media queries (iOS Mail, Apple Mail, some Android) */
  @media only screen and (max-width: 620px) {
    .email-shell {
      width: 100% !important;
      max-width: 100% !important;
    }
    .email-pad {
      padding-left: 16px !important;
      padding-right: 16px !important;
    }
    .email-stepper-pad {
      padding-top: 16px !important;
      padding-left: 12px !important;
      padding-right: 12px !important;
    }
    .email-header-pad {
      padding: 20px 16px !important;
    }
    .email-header-meta {
      font-size: 10px !important;
      letter-spacing: 0.4px !important;
      display: block !important;
      padding-top: 6px !important;
      text-align: left !important;
    }
    .email-step {
      padding-left: 1px !important;
      padding-right: 1px !important;
    }
    .email-step-label {
      font-size: 9px !important;
      line-height: 1.2 !important;
    }
    .email-body-pad {
      padding: 20px 16px 28px 16px !important;
    }
    .email-footer-pad {
      padding: 18px 16px !important;
    }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F7FBF9; font-family:'DM Sans', Arial, sans-serif; -webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7FBF9; padding:32px 0;">
  <tr>
    <td align="center" style="padding:0 12px;">
      <table role="presentation" class="email-shell" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px; background-color:#ffffff; border:1px solid #5DCAA5; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(15,110,86,0.08);">
        <tr>
          <td class="email-header-pad" style="background-color:#E1F5EE; padding:28px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family:'Syne', Arial, sans-serif; font-size:20px; font-weight:800; color:#0F6E56; letter-spacing:0.5px;">
                  KO&nbsp;BROKER
                </td>
                ${headerRight}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="height:4px; background-color:#D4A017; font-size:0; line-height:0;">&nbsp;</td>
        </tr>
        ${stepperHtml}
        <tr>
          <td class="email-pad email-body-pad" style="padding:24px 40px 40px 40px;">
            ${contentHtml}
          </td>
        </tr>
        <tr>
          <td class="email-pad email-footer-pad" style="padding:24px 40px; background-color:#F7FBF9; border-top:1px solid #5DCAA5;">
            <p style="margin:0 0 6px 0; font-size:11px; color:#0D1F1A; opacity:0.7; line-height:1.5;">
              KO Broker | This message was sent regarding your mortgage application.
            </p>
            <p style="margin:0; font-size:11px; color:#0D1F1A; opacity:0.7; line-height:1.5;">
              KO Broker is authorised and regulated. This email may contain confidential information intended only for the recipient.
            </p>
            ${
              unsubscribeUrl
                ? `<p style="margin:10px 0 0 0; font-size:11px; line-height:1.5;">
              <a href="${unsubscribeUrl}" style="color:#0F6E56; text-decoration:underline;">Unsubscribe</a>
              <span style="color:#0D1F1A; opacity:0.7;"> from these email notifications</span>
            </p>`
                : ''
            }
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function plainBodyToHtml(body: string): string {
  return `<p>${body.replace(/\n/g, '<br/>')}</p>`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Short list-style preview (LinkedIn-style); full body stays in the app. */
export function truncateMessagePreview(body: string, maxLen = 80): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

/**
 * Notification email for messaging — preview only, no full message body.
 * When isPortalInvite, the CTA is a portal setup/invite link (client has no portal yet).
 */
export function buildMessageNotificationEmail(opts: {
  recipientFirstName?: string;
  messageBody: string;
  subject?: string;
  ctaUrl: string;
  /** Client has no portal account yet — structure email as message + portal invite. */
  isPortalInvite?: boolean;
}): { subject: string; body: string; html: string } {
  const preview = truncateMessagePreview(opts.messageBody);
  const greeting = opts.recipientFirstName?.trim()
    ? `Hi ${opts.recipientFirstName.trim()},`
    : 'Hi,';
  const safeGreeting = opts.recipientFirstName?.trim()
    ? `Hi ${escapeHtml(opts.recipientFirstName.trim())},`
    : 'Hi,';
  const safePreview = escapeHtml(preview);
  const safeUrl = escapeHtml(opts.ctaUrl);
  const isInvite =
    opts.isPortalInvite === true || opts.ctaUrl.includes('/invite?token=');

  if (isInvite) {
    const subject =
      opts.subject?.trim() || 'New message from your mortgage adviser — open your client portal';
    const body = [
      greeting,
      '',
      'Your mortgage adviser has sent you a message on KO Broker.',
      ...(preview ? ['', `Preview: "${preview}"`] : []),
      '',
      'To read the full message — and complete your fact-find securely — open your client portal using the link below.',
      '',
      `Set up your client portal: ${opts.ctaUrl}`,
      '',
      'This invite link is personal to you. If it expires, ask your adviser to send a new invitation.',
    ].join('\n');

    const html = `
      <p style="margin:0 0 16px 0; font-size:15px; line-height:1.5; color:#0D1F1A;">${safeGreeting}</p>
      <p style="margin:0 0 16px 0; font-size:15px; line-height:1.5; color:#0D1F1A;">
        Your mortgage adviser has sent you a message on <strong>KO Broker</strong>.
      </p>
      ${
        preview
          ? `<p style="margin:0 0 20px 0; padding:14px 16px; background-color:#F7FBF9; border-left:3px solid #5DCAA5; font-size:14px; line-height:1.5; color:#0D1F1A; opacity:0.85; font-style:italic;">"${safePreview}"</p>`
          : ''
      }
      <p style="margin:0 0 16px 0; font-size:15px; line-height:1.5; color:#0D1F1A;">
        To read the full message and complete your fact-find securely, open your <strong>client portal</strong> below.
      </p>
      <p style="margin:0 0 8px 0;">
        <a href="${safeUrl}" style="display:inline-block; background-color:#0F6E56; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px; padding:12px 20px; border-radius:8px;">
          Open your client portal
        </a>
      </p>
      <p style="margin:16px 0 0 0; font-size:12px; line-height:1.5; color:#0D1F1A; opacity:0.65;">
        This invite link is personal to you. If it expires, ask your adviser to send a new invitation.
      </p>
    `;

    return { subject, body, html };
  }

  const subject = opts.subject?.trim() || 'You have a new message on KO Broker';

  const body = [
    greeting,
    '',
    'You have a new message waiting for you on KO Broker.',
    ...(preview ? ['', `Preview: "${preview}"`] : []),
    '',
    'For your privacy, the full message is only available in the app.',
    '',
    `Open KO Broker to read it: ${opts.ctaUrl}`,
  ].join('\n');

  const html = `
    <p style="margin:0 0 16px 0; font-size:15px; line-height:1.5; color:#0D1F1A;">${safeGreeting}</p>
    <p style="margin:0 0 16px 0; font-size:15px; line-height:1.5; color:#0D1F1A;">
      You have a new message waiting for you on <strong>KO Broker</strong>.
    </p>
    ${
      preview
        ? `<p style="margin:0 0 20px 0; padding:14px 16px; background-color:#F7FBF9; border-left:3px solid #5DCAA5; font-size:14px; line-height:1.5; color:#0D1F1A; opacity:0.85; font-style:italic;">"${safePreview}"</p>`
        : ''
    }
    <p style="margin:0 0 8px 0;">
      <a href="${safeUrl}" style="display:inline-block; background-color:#0F6E56; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px; padding:12px 20px; border-radius:8px;">
        View message
      </a>
    </p>
    <p style="margin:16px 0 0 0; font-size:12px; line-height:1.5; color:#0D1F1A; opacity:0.65;">
      For your privacy, the full message is only available in the app.
    </p>
  `;

  return { subject, body, html };
}

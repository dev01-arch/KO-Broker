/**
 * Branded HTML wrapper for outbound email notifications.
 */

export function renderBaseTemplate(subject: string, contentHtml: string, stage?: number): string {
  const stageNames = ['Disclosure', 'Fact-Find', 'Research', 'ESIS', 'Suitability'];
  const stageLabel = stage && stage >= 1 && stage <= 5 ? stageNames[stage - 1] : '';

  const headerRight = stage
    ? `<td align="right" style="font-family:'DM Sans', sans-serif; font-size:12px; font-weight:700; color:#ffffff; text-transform:uppercase; letter-spacing:1px;">Stage ${stage} of 5 · ${stageLabel === 'Suitability' ? 'Complete' : 'Active'}</td>`
    : '';

  let stepperHtml = '';
  if (stage && stage >= 1 && stage <= 5) {
    const chevrons = Array.from({ length: 5 }, (_, i) => {
      const active = i + 1 === stage;
      return `<td width="20%" align="center" style="padding-bottom:4px; vertical-align:bottom; height:12px;">${
        active ? '<span style="color:#5DCAA5; font-size:12px; line-height:1; font-weight:bold;">▼</span>' : '&nbsp;'
      }</td>`;
    }).join('');

    const steps = Array.from({ length: 5 }, (_, i) => {
      const stepNum = i + 1;
      const isCompleted = stepNum < stage;
      const isActive = stepNum === stage;

      const bgLineStyle =
        i > 0
          ? `style="background-image:linear-gradient(to right, ${isCompleted || isActive ? '#5DCAA5' : '#E2E8F0'} 100%, rgba(0,0,0,0) 0%); background-position:bottom 14px center; background-repeat:no-repeat; background-size:100% 2px;"`
          : '';

      const circleBg = isCompleted || isActive ? '#5DCAA5' : '#E2E8F0';
      const circleColor = isCompleted || isActive ? '#ffffff' : '#64748b';
      const circleText = isCompleted ? '✓' : `${stepNum}`;

      return `
              <td align="center" width="20%" ${bgLineStyle}>
                <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-block;">
                  <tr>
                    <td style="width:24px; height:24px; line-height:24px; border-radius:50%; background-color:${circleBg}; color:${circleColor}; font-size:11px; font-weight:bold; text-align:center;">${circleText}</td>
                  </tr>
                </table>
              </td>`;
    }).join('');

    const labels = stageNames
      .map((name, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === stage;
        const style = isActive
          ? 'color:#0F6E56; font-weight:700;'
          : 'color:#0D1F1A; opacity:0.6; font-weight:500;';
        return `<td align="center" style="font-size:11px; ${style}">${name}</td>`;
      })
      .join('');

    stepperHtml = `
        <tr>
          <td style="padding:24px 40px 0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border:1px solid #E1F5EE; border-radius:24px; box-shadow:0px 8px 16px rgba(15,110,86,0.06); padding:20px 16px;">
              <tr>
                ${chevrons}
              </tr>
              <tr>
                <td colspan="5" style="padding-bottom:8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      ${steps}
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                ${labels}
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
</head>
<body style="margin:0; padding:0; background-color:#F7FBF9; font-family:'DM Sans', Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7FBF9; padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border:1px solid #5DCAA5; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(15,110,86,0.08);">
        <tr>
          <td style="background-color:#0F6E56; padding:28px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family:'Syne', sans-serif; font-size:20px; font-weight:800; color:#ffffff; letter-spacing:0.5px;">
                  KO&nbsp;BROKER
                </td>
                ${headerRight}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="height:4px; background-color:#D4A017;"></td>
        </tr>
        ${stepperHtml}
        <tr>
          <td style="padding:24px 40px 40px 40px;">
            ${contentHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px; background-color:#F7FBF9; border-top:1px solid #5DCAA5;">
            <p style="margin:0 0 6px 0; font-size:11px; color:#0D1F1A; opacity:0.7; line-height:1.5;">
              KO Broker | This message was sent regarding your mortgage application.
            </p>
            <p style="margin:0; font-size:11px; color:#0D1F1A; opacity:0.7; line-height:1.5;">
              KO Broker is authorised and regulated. This email may contain confidential information intended only for the recipient.
            </p>
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

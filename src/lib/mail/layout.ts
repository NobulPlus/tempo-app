import "server-only";

/**
 * Shared shell for every transactional email. Light background only — email
 * clients render on whatever chrome the client provides, so this doesn't try
 * to follow the app's dark-first theme, just its accent green and type
 * personality. Inline styles for anything layout/color-critical (buttons,
 * the highlight box) since that's the one thing every client — including
 * older Outlook — reliably respects; the <style> block only carries safe
 * typography that degrades harmlessly if a client strips it.
 */

const GREEN = "#0e8a44";
const INK = "#11201a";
const INK_SOFT = "#586359";
const BORDER = "#e4e2d8";
const BG = "#f5f4ee";

export function emailLayout(opts: {
  previewText: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<tr><td style="padding:28px 0 4px;">
           <a href="${opts.ctaUrl}" style="display:inline-block;background:${GREEN};color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 24px;border-radius:999px;">${opts.ctaLabel}</a>
         </td></tr>`
      : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin:0; padding:0; background:${BG}; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
  a { color:${GREEN}; }
</style>
</head>
<body style="margin:0;padding:0;background:${BG};">
  <span style="display:none;font-size:1px;color:${BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${opts.previewText}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 0;">
              <span style="font-size:20px;font-weight:800;letter-spacing:0.3px;color:${GREEN};">TEMPO</span>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 8px;color:${INK};font-size:15px;line-height:1.6;">
              ${opts.bodyHtml}
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 28px;border-top:1px solid ${BORDER};margin-top:8px;">
              <p style="margin:16px 0 0;font-size:12px;color:${INK_SOFT};line-height:1.6;">
                Tempo · Lagos, Nigeria<br>
                Questions? Reply to this email or write to
                <a href="mailto:info@playtempo11.com" style="color:${INK_SOFT};text-decoration:underline;">info@playtempo11.com</a>.
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

export function textFooter(): string {
  return `\n\n—\nTempo · Lagos, Nigeria\nQuestions? info@playtempo11.com`;
}

export const emailColors = { green: GREEN, ink: INK, inkSoft: INK_SOFT, border: BORDER, bg: BG };

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

type ConfirmationTarget =
  | { kind: "project"; caseId: string }
  | { kind: "place"; label: string; radiusMiles: number }
  | { kind: "pending"; label: string };

export function confirmationEmail(target: ConfirmationTarget, url: string) {
  const description = target.kind === "project"
    ? `Project ${target.caseId}`
    : target.kind === "place"
      ? `Projects within ${target.radiusMiles} ${target.radiusMiles === 1 ? "mile" : "miles"} of ${target.label}`
      : `Your interest in ${target.label}`;
  const next = target.kind === "pending"
    ? "After confirming, choose a project or address on the map to start alerts."
    : "After confirming, you’ll receive at most one daily email when we detect changes to the projects you watch. No changes means no email.";
  const instruction = "Click “Confirm my alerts” below, then select “Confirm alerts” on the page that opens to finish signing up.";
  return {
    text: `One more step: confirm your alerts\n\n${description}\n\nOpen this link, then select “Confirm alerts” on the page that opens:\n${url}\n\n${next}\n\nThis link expires in 48 hours. No alerts start until you confirm.\n\nIf you didn’t request this, you can ignore this email.`,
    html: `<h1 style="margin:0 0 20px;font-size:28px;line-height:1.25;color:#102f32">One more step: confirm your alerts</h1>
<p>${escapeHtml(instruction)}</p>
<p style="padding:16px;background:#edf6f5;border-left:4px solid #007c78;border-radius:4px"><strong>You’re watching</strong><br>${escapeHtml(description)}</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0"><tr><td bgcolor="#007c78" style="border-radius:8px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:16px 24px;border:1px solid #007c78;border-radius:8px;color:#ffffff;font-size:17px;font-weight:bold;text-decoration:none">Confirm my alerts</a></td></tr></table>
<p>${escapeHtml(next)}</p>
<p><strong>This link expires in 48 hours.</strong> No alerts start until you confirm.</p>
<p style="font-size:14px;color:#526268">If the button doesn’t work, copy and paste this link into your browser:<br><a href="${escapeHtml(url)}" style="color:#006d69;word-break:break-all">${escapeHtml(url)}</a></p>
<p style="font-size:14px;color:#526268">If you didn’t request this, you can ignore this email.</p>`,
  };
}

export function alertEmailDocument(body: string, address: string, unsubscribe: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local Agenda Watch alerts</title></head>
<body style="margin:0;padding:20px 12px;background:#f2f6f5;color:#20383b;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dce5e3;border-radius:12px"><tr><td style="padding:28px 24px">
<p style="margin:0 0 28px;color:#007c78;font-size:16px;font-weight:bold">LOCAL AGENDA WATCH</p>
${body}
<hr style="border:0;border-top:1px solid #dce5e3;margin:28px 0 20px">
<p style="font-size:12px;color:#526268;margin:0">Local Agenda Watch · Independent summaries; official records control.<br>${escapeHtml(address)}<br><a href="${escapeHtml(unsubscribe)}" style="color:#526268">Unsubscribe from all alerts</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

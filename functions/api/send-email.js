/**
 * Plan AIQ — Cloudflare Pages Function
 * ══════════════════════════════════════
 * Route:   POST /api/send-email  (auto-wired by Cloudflare Pages)
 * Runtime: Cloudflare Workers Edge — zero cold start, global
 *
 * Handles ALL form types:
 *   • audit        — Free Audit Request (all CTA buttons site-wide)
 *   • contact      — Send a Message (contact section form)
 *   • consultation — Book a Consultation
 *
 * Secrets — set in Cloudflare Dashboard → Pages → Settings → Env Vars:
 *   RESEND_API_KEY   from resend.com/api-keys
 *   RECIPIENT_EMAIL  infoplanaiq@gmail.com
 *   ALLOWED_ORIGIN   https://www.yourdomain.com
 *
 * Security:
 *   CORS locked to your domain
 *   Rate limiting — 5 per IP per 15 min
 *   Input sanitisation — strips all HTML from every field
 *   Server-side email validation
 *   POST-only
 *   Zero credentials in browser or GitHub
 */

const RATE_MAX  = 5;
const RATE_MINS = 15;
const _store    = new Map();

function isRateLimited(ip) {
  const now  = Date.now();
  const win  = RATE_MINS * 60 * 1000;
  const hits = (_store.get(ip) || []).filter(t => now - t < win);
  if (hits.length >= RATE_MAX) return true;
  hits.push(now);
  _store.set(ip, hits);
  return false;
}

function clean(val, max = 2000) {
  if (typeof val !== 'string') return '';
  return val.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, max);
}

function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/* ══════════════════════════════════════════════════════
   BRANDED HTML EMAIL TEMPLATE
   Renders correctly in Gmail, Outlook, Apple Mail, mobile
══════════════════════════════════════════════════════ */
function buildHtml({ formType, name, email, phone, company, industry, message, timestamp, ip }) {

  const isAudit = formType === 'audit';
  const isConsult = formType === 'consultation';

  const badge    = isAudit ? 'FREE AUDIT REQUEST' : isConsult ? 'CONSULTATION REQUEST' : 'CONTACT FORM';
  const headline = isAudit ? 'New Free Audit Request' : isConsult ? 'New Consultation Request' : 'New Message Received';
  const replySubject = isAudit ? 'Re: Your Free Audit Request — Plan AIQ'
                     : isConsult ? 'Re: Your Consultation Request — Plan AIQ'
                     : 'Re: Your Message — Plan AIQ';
  const replyLink = `mailto:${email}?subject=${encodeURIComponent(replySubject)}`;

  const RED  = '#991818';
  const GOLD = '#f59e0b';

  const fields = [
    { icon: '👤', label: 'Name',     value: name               },
    { icon: '✉️', label: 'Email',    value: `<a href="mailto:${email}" style="color:${RED};text-decoration:none;font-weight:600;">${email}</a>` },
    { icon: '📞', label: 'Phone',    value: phone    || '—'    },
    { icon: '🏢', label: 'Company',  value: company  || '—'    },
    ...(industry ? [{ icon: '🏭', label: 'Industry', value: industry }] : []),
    { icon: '💬', label: 'Message',  value: message ? message.replace(/\n/g, '<br>') : '—' },
    { icon: '🕐', label: 'Received', value: timestamp           },
    { icon: '🌐', label: 'IP',       value: ip       || '—'    },
  ];

  const fieldRows = fields.map(({ icon, label, value }) => `
        <tr>
          <td style="width:130px;padding:13px 16px 13px 0;vertical-align:top;
                     font-size:12px;font-weight:600;color:#6b7280;
                     border-bottom:1px solid #f3f4f6;white-space:nowrap;">
            ${icon}&nbsp; ${label}
          </td>
          <td style="padding:13px 0;vertical-align:top;
                     font-size:14px;color:#111827;line-height:1.65;
                     border-bottom:1px solid #f3f4f6;">
            ${value}
          </td>
        </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#f1f5f9;padding:40px 16px;">
  <tr><td align="center">

    <!-- CARD -->
    <table width="600" cellpadding="0" cellspacing="0" border="0"
           style="max-width:600px;width:100%;background:#ffffff;
                  border-radius:16px;overflow:hidden;
                  box-shadow:0 4px 32px rgba(0,0,0,0.10);">

      <!-- HEADER -->
      <tr>
        <td style="background:${RED};padding:36px 40px 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <span style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.02em;">
                  Plan<span style="color:${GOLD};">AIQ</span>
                </span>
                <span style="font-size:11px;color:rgba(255,255,255,0.50);
                             margin-left:10px;letter-spacing:0.08em;text-transform:uppercase;">
                  Business Intelligence
                </span>
              </td>
              <td align="right">
                <span style="background:rgba(255,255,255,0.15);
                             border:1px solid rgba(255,255,255,0.3);
                             color:#fff;font-size:10px;font-weight:700;
                             letter-spacing:0.12em;padding:5px 13px;
                             border-radius:20px;display:inline-block;">
                  ${badge}
                </span>
              </td>
            </tr>
          </table>
          <p style="margin:22px 0 0;font-size:26px;font-weight:300;
                    color:#fff;line-height:1.25;letter-spacing:-0.02em;">
            ${headline}
          </p>
          <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.55);">
            Submitted via planaiq.com &nbsp;·&nbsp; ${timestamp}
          </p>
        </td>
      </tr>

      <!-- ALERT BANNER -->
      <tr>
        <td style="background:#fef3c7;padding:13px 40px;border-bottom:1px solid #fde68a;">
          <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">
            ⚡ &nbsp;Action required — reply within 12 hours to secure this lead
          </p>
        </td>
      </tr>

      <!-- DETAILS -->
      <tr>
        <td style="padding:30px 40px 20px;">
          <p style="margin:0 0 14px;font-size:11px;font-weight:700;
                    letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">
            Submission Details
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${fieldRows}
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="padding:10px 40px 36px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:${RED};border-radius:8px;
                         box-shadow:0 4px 16px rgba(153,24,24,0.30);">
                <a href="${replyLink}"
                   style="display:inline-block;padding:14px 30px;
                          font-size:14px;font-weight:700;color:#fff;
                          text-decoration:none;letter-spacing:0.02em;">
                  Reply to ${name} &rarr;
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
            Or reply directly to:
            <a href="mailto:${email}" style="color:${RED};">${email}</a>
          </p>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#f8fafc;padding:18px 40px;border-top:1px solid #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:11px;color:#9ca3af;line-height:1.6;">
                Sent automatically from your Plan AIQ website form.<br/>
                Use the button above to reply — do not reply to this message.
              </td>
              <td align="right" style="font-size:12px;color:#d1d5db;white-space:nowrap;padding-left:16px;">
                Plan<strong style="color:${GOLD};">AIQ</strong>
                &copy; ${new Date().getFullYear()}
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* ── Plain text fallback ── */
function buildText({ formType, name, email, phone, company, industry, message, timestamp, ip }) {
  const type = formType === 'audit' ? 'FREE AUDIT REQUEST'
             : formType === 'consultation' ? 'CONSULTATION REQUEST'
             : 'CONTACT FORM';
  return [
    `PLAN AIQ — ${type}`,
    '─'.repeat(44),
    `Name:      ${name}`,
    `Email:     ${email}`,
    `Phone:     ${phone     || '—'}`,
    `Company:   ${company   || '—'}`,
    ...(industry ? [`Industry:  ${industry}`] : []),
    `Message:   ${message   || '—'}`,
    '',
    `Received:  ${timestamp}`,
    `IP:        ${ip        || '—'}`,
    '',
    '─'.repeat(44),
    `Reply to: ${email}`,
    'Sent automatically from planaiq.com',
  ].join('\n');
}

/* ════════════════════════════════════════════
   MAIN HANDLER
════════════════════════════════════════════ */
export async function onRequestPost({ request, env }) {

  const allowed = env.ALLOWED_ORIGIN || '*';
  const origin  = request.headers.get('Origin') || '';
  const corsH   = {
    'Access-Control-Allow-Origin' : (origin === allowed || allowed === '*') ? (allowed === '*' ? '*' : origin) : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type'                : 'application/json',
  };

  const ip = request.headers.get('CF-Connecting-IP')
          || (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim()
          || 'unknown';

  if (isRateLimited(ip))
    return new Response(JSON.stringify({ ok: false, error: 'Too many submissions. Please try again in 15 minutes.' }),
      { status: 429, headers: corsH });

  let body;
  try { body = await request.json(); }
  catch (_) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request.' }),
      { status: 400, headers: corsH });
  }

  const { formType = 'general', name, email, phone, company, industry, message } = body;

  const cleanName     = clean(name);
  const cleanEmail    = clean(email);
  const cleanPhone    = clean(phone);
  const cleanCompany  = clean(company);
  const cleanIndustry = clean(industry);
  const cleanMessage  = clean(message);

  if (!cleanName)
    return new Response(JSON.stringify({ ok: false, error: 'Name is required.' }),
      { status: 400, headers: corsH });

  if (!cleanEmail || !validEmail(cleanEmail))
    return new Response(JSON.stringify({ ok: false, error: 'A valid email address is required.' }),
      { status: 400, headers: corsH });

  const isAudit   = formType === 'audit';
  const isConsult = formType === 'consultation';
  const subject   = isAudit   ? `🔍 Free Audit Request — ${cleanCompany || cleanName}`
                  : isConsult ? `📅 Consultation Request — ${cleanName}`
                  : `✉️ Website Enquiry from ${cleanName}${cleanCompany ? ' — ' + cleanCompany : ''}`;

  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/Detroit',
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) + ' ET';

  const data = { formType, name: cleanName, email: cleanEmail, phone: cleanPhone,
                 company: cleanCompany, industry: cleanIndustry,
                 message: cleanMessage, timestamp, ip };

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method : 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        from    : 'Plan AIQ Website <onboarding@resend.dev>',
        to      : [env.RECIPIENT_EMAIL || 'infoplanaiq@gmail.com'],
        reply_to: cleanEmail,
        subject,
        html    : buildHtml(data),
        text    : buildText(data),
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      console.error('Resend error:', JSON.stringify(err));
      return new Response(JSON.stringify({ ok: false, error: 'Failed to send. Please try again.' }),
        { status: 500, headers: corsH });
    }

    return new Response(JSON.stringify({ ok: true, message: 'Email sent successfully.' }),
      { status: 200, headers: corsH });

  } catch (err) {
    console.error('Worker error:', err.message);
    return new Response(JSON.stringify({ ok: false, error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: corsH });
  }
}

export async function onRequestOptions({ env }) {
  return new Response(null, {
    status : 204,
    headers: {
      'Access-Control-Allow-Origin' : env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/* =============================================================================
 *  POST /.netlify/functions/send-email
 *  ---------------------------------------------------------------------------
 *  One endpoint for the transactional emails the front-end triggers:
 *    { type:'welcome',      to, name }
 *    { type:'custom_order', to, details:{...} }
 *    { type:'contact',      name, email, subject, message }
 *
 *  Order-confirmation emails are sent by verify-razorpay-payment.js / the webhook
 *  not here. If RESEND_API_KEY isn't set we no-op (200) so local dev doesn't
 *  error.
 * ===========================================================================*/
const { CFG, resend, tplWelcome, tplCustomOrder, tplContact, json } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.RESEND_API_KEY) return json(200, { skipped: 'no RESEND_API_KEY' });

  try {
    const body = JSON.parse(event.body || '{}');
    const r = resend();

    switch (body.type) {
      case 'welcome':
        if (!body.to) return json(400, { error: 'missing recipient' });
        await r.emails.send({ from: CFG.FROM, to: body.to, subject: 'Welcome to Jivani Gems', html: tplWelcome(body.name) });
        break;

      case 'custom_order':
        if (!body.to) return json(400, { error: 'missing recipient' });
        await r.emails.send({ from: CFG.FROM, to: body.to, subject: 'We’ve received your custom order request', html: tplCustomOrder(body.details || {}) });
        break;

      case 'contact':
        // acknowledge the sender …
        if (body.email) await r.emails.send({ from: CFG.FROM, to: body.email, subject: 'We’ve received your message — Jivani Gems', html: tplContact(body) });
        // … and notify the shop inbox (CUSTOMIZE: set CONTACT_INBOX env var)
        if (process.env.CONTACT_INBOX) {
          await r.emails.send({ from: CFG.FROM, to: process.env.CONTACT_INBOX, replyTo: body.email,
            subject: `New enquiry: ${body.subject || '(no subject)'}`,
            html: `<p><strong>${body.name}</strong> (${body.email})</p><p>${(body.message || '').replace(/</g, '&lt;')}</p>` });
        }
        break;

      default:
        return json(400, { error: 'unknown email type' });
    }
    return json(200, { sent: true });
  } catch (err) {
    console.error('[send-email]', err);
    return json(500, { error: 'Could not send email' });
  }
};

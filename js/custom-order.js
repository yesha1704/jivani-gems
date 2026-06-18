/* =============================================================================
 *  Custom order  (js/custom-order.js)  →  powers custom-order.html
 *  ---------------------------------------------------------------------------
 *  Structured bespoke-request form. On submit:
 *    • uploads the reference image to Supabase Storage (bucket: custom-references)
 *    • inserts a row into custom_orders
 *    • fires the "we've received your request" confirmation email
 *  DEMO MODE simulates all three so the form is fully clickable offline.
 *  Includes a simple submit debounce (anti-spam).
 * ===========================================================================*/
(function () {
  if (document.body.dataset.page !== 'custom') return;
  let lastSubmit = 0;

  document.addEventListener('DOMContentLoaded', async () => {
    // prefill contact email when logged in
    const profile = await JVAuth.currentProfile();
    if (profile?.email) JV.qs('#cu-email').value = profile.email;

    const form = JV.qs('#custom-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // anti-spam: ignore repeat submits within 5s
      if (Date.now() - lastSubmit < 5000) { JV.toast('Please wait a moment before resubmitting.', 'info'); return; }

      const payload = {
        jewelry_type: JV.qs('#cu-type').value,
        carat: parseFloat(JV.qs('#cu-carat').value) || null,
        gold_type: JV.qs('#cu-gold').value,
        color: JV.qs('#cu-color').value,
        num_diamonds: parseInt(JV.qs('#cu-num').value) || null,
        diamond_type: JV.qs('#cu-diamond').value,
        shape_description: JV.qs('#cu-desc').value.trim(),
        contact_email: JV.qs('#cu-email').value.trim(),
      };
      if (!payload.shape_description || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.contact_email)) {
        JV.toast('Please add a description and a valid email.', 'error'); return;
      }

      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.innerHTML = '<span class="jv-spinner" style="border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>';
      lastSubmit = Date.now();

      try {
        const file = JV.qs('#cu-image').files[0];

        if (window.JV_DEMO_MODE) {
          await new Promise(r => setTimeout(r, 700));   // simulate latency
        } else {
          const { data: { user } } = await window.sb.auth.getUser();
          let reference_image_url = null;

          // 1) upload reference image to Storage
          if (file) {
            const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, '_')}`;
            const up = await window.sb.storage.from('custom-references').upload(path, file, { upsert: false });
            if (!up.error) reference_image_url = window.sb.storage.from('custom-references').getPublicUrl(path).data.publicUrl;
          }

          // 2) insert the custom order row
          const { error } = await window.sb.from('custom_orders').insert({
            user_id: user?.id || null, ...payload, reference_image_url, status: 'submitted',
          });
          if (error) throw error;

          // 3) confirmation email (server-side, via Resend)
          fetch('/.netlify/functions/send-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'custom_order', to: payload.contact_email, details: payload }),
          }).catch(() => {});
        }

        form.reset();
        if (profile?.email) JV.qs('#cu-email').value = profile.email;
        JV.qs('#custom-stage').innerHTML = `
          <div class="jv-empty" style="padding:60px 24px">
            <div class="mark"></div>
            <h3>Request received</h3>
            <p>We’ve received your custom order request and will reach out within <strong>3 business days</strong> with a quote. A confirmation email is on its way.</p>
            <a class="jv-btn jv-btn-sm" href="shop.html">Explore ready pieces</a>
          </div>`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Submit request';
        JV.toast('Could not submit your request. Please try again.', 'error');
      }
    });

    // show selected filename
    JV.qs('#cu-image').addEventListener('change', (e) => {
      JV.qs('#cu-image-name').textContent = e.target.files[0]?.name || 'No file chosen';
    });
  });
})();

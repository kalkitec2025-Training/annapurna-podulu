/* Annapurna Podulu — admin panel: dashboard, orders, products, settings */
window.Admin = (function () {
  const A = { tab: 'dashboard', filter: 'active', q: '' };
  const { $, $$, esc, rupee } = AP;
  const api = () => AP.api;
  const NEXT = { awaiting_payment: ['confirmed', 'Mark paid'], payment_submitted: ['confirmed', 'Payment received · Confirm'], confirmed: ['packed', 'Mark packed'], packed: ['out_for_delivery', 'Out for delivery'], out_for_delivery: ['delivered', 'Mark delivered'] };
  const TABS = [['dashboard', 'Dashboard', '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/>'], ['orders', 'Orders', '<path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21V3Z"/><path d="M10 8h4M10 12h4"/>'], ['products', 'Products', '<path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'], ['shop', 'Shop settings', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>']];
  let root, orders = [];

  async function render(el) {
    root = el;
    if (!(await api().adminCheck())) return login();
    root.innerHTML = `<div class="wrap admin-shell">
      <nav class="side" aria-label="Admin">${TABS.map(t => `<button data-tab="${t[0]}"><svg class="i" viewBox="0 0 24 24">${t[2]}</svg>${t[1]}</button>`).join('')}
        <button id="alo"><svg class="i" viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>Log out</button></nav>
      <section id="apane" aria-live="polite"></section></div>`;
    $$('[data-tab]', root).forEach(b => b.onclick = () => { A.tab = b.dataset.tab; paint(); });
    $('#alo', root).onclick = async () => { await api().adminLogout(); render(root); };
    paint();
  }
  async function paint() {
    $$('[data-tab]', root).forEach(b => { if (b.dataset.tab === A.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const pane = $('#apane', root);
    if (A.tab !== 'shop' && A.tab !== 'products') orders = await api().adminOrders();
    ({ dashboard, orders: ordersTab, products, shop: settings })[A.tab](pane);
  }

  function login() {
    root.innerHTML = `<div class="wrap page"><div class="panel stack" style="max-width:420px;margin:24px auto;text-align:center">
      <img src="img/logo-160.png" alt="" style="width:88px;margin:0 auto;border-radius:50%">
      <h1 style="margin:0">Shop owner login</h1>
      <p class="muted" style="margin:0">Enter the admin PIN to manage orders and products.</p>
      <form id="al" class="stack" novalidate><input class="input otp" id="pin" type="password" inputmode="numeric" maxlength="8" placeholder="PIN" aria-label="Admin PIN">
      <div class="err" id="ae"></div><button class="btn btn-primary btn-block">Open admin</button></form>
      ${api().mode === 'demo' || AP.S.settings.demo ? '<div class="devotp">Demo PIN: <b class="num">1234</b>. Change it in Shop settings.</div>' : ''}
      <a href="#shop" class="muted">Back to shop</a></div></div>`;
    $('#pin').focus();
    $('#al').onsubmit = async e => { e.preventDefault(); try { await api().adminLogin($('#pin').value); A.tab = 'dashboard'; render(root); } catch (er) { $('#ae').textContent = er.message; } };
  }

  /* ---------- dashboard ---------- */
  function dashboard(p) {
    const now = new Date(); const mStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const paid = orders.filter(o => ['confirmed', 'packed', 'out_for_delivery', 'delivered'].includes(o.status));
    const month = paid.filter(o => o.createdAt >= mStart);
    const verify = orders.filter(o => o.status === 'payment_submitted');
    const pack = orders.filter(o => o.status === 'confirmed');
    const ship = orders.filter(o => ['packed', 'out_for_delivery'].includes(o.status));
    const qty = {}; paid.forEach(o => o.items.forEach(i => { qty[i.name] = (qty[i.name] || 0) + i.qty; }));
    const top = Object.entries(qty).sort((a, b) => b[1] - a[1]).slice(0, 7); const max = top.length ? top[0][1] : 1;
    const attention = orders.filter(o => ['payment_submitted', 'confirmed', 'packed', 'out_for_delivery'].includes(o.status));
    p.innerHTML = `<div class="sec-head" style="margin-bottom:12px"><h2 style="font-size:1.8rem">Today at a glance</h2><span class="muted">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      <div class="kpis">
        <div class="kpi ${verify.length ? 'alert' : ''}"><span>Payments to verify</span><b>${verify.length}</b></div>
        <div class="kpi"><span>To pack</span><b>${pack.length}</b></div>
        <div class="kpi"><span>Packed / on the way</span><b>${ship.length}</b></div>
        <div class="kpi"><span>Sales this month</span><b>${rupee(month.reduce((s, o) => s + o.total, 0))}</b></div>
      </div>
      <div class="two" style="margin-top:20px">
        <div class="panel"><h2>Needs your attention</h2>${attention.length ? orderTable(attention) : '<p class="muted">All caught up. New orders appear here.</p>'}</div>
        <div class="panel"><h2>Top podis</h2>${top.length ? top.map(([n, q]) => `<div style="display:grid;gap:4px;margin-bottom:10px"><div style="display:flex;justify-content:space-between"><span>${esc(n)}</span><b class="num">${q}</b></div><div style="height:8px;border-radius:5px;background:var(--paper-2)"><div style="height:100%;width:${Math.max(6, q / max * 100)}%;background:var(--leaf);border-radius:5px"></div></div></div>`).join('') : '<p class="muted">Sales appear once orders are confirmed.</p>'}</div>
      </div>
      ${api().mode === 'demo' ? `<p class="muted" style="margin-top:16px;font-size:.88rem">Demo mode: orders marked “(example)” are sample data. On your server, real orders from all customers appear here. <button class="linkbtn" id="rst">Reset demo data</button></p>` : ''}`;
    bindRows(p);
    const r = $('#rst', p); if (r) r.onclick = () => confirmBox('Reset demo data?', 'This clears demo orders, accounts and product edits in this browser.', 'Reset', async () => { await api().resetDemo(); location.reload(); });
  }
  function orderTable(list) {
    return `<div class="tbl-wrap" style="box-shadow:none"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>
      ${list.map(o => `<tr class="click" data-o="${esc(o.id)}" tabindex="0"><td style="white-space:nowrap"><b class="num" style="color:var(--maroon)">${esc(o.id)}</b><div class="muted" style="font-size:.8rem">${AP.fmtDate(o.createdAt)}</div></td>
        <td>${esc(o.customer.name || o.address.name)}<div class="muted num" style="font-size:.8rem">${esc(o.customer.phone)}</div></td>
        <td style="min-width:180px">${o.items.map(i => esc(i.name.replace(' Podi', '')) + ' ' + esc(i.w) + ' ×' + i.qty).join('<br>')}</td>
        <td class="num"><b>${rupee(o.total)}</b></td><td>${AP.pill(o.status)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function bindRows(p) { $$('tr[data-o]', p).forEach(r => { const open = () => orderSheet(orders.find(o => o.id === r.dataset.o)); r.onclick = open; r.onkeydown = e => { if (e.key === 'Enter') open(); }; }); }

  /* ---------- orders ---------- */
  function ordersTab(p) {
    const F = [['active', 'Active'], ['payment_submitted', 'Verify payment'], ['confirmed', 'To pack'], ['packed', 'Packed'], ['out_for_delivery', 'On the way'], ['delivered', 'Delivered'], ['awaiting_payment', 'Unpaid'], ['all', 'All']];
    const q = A.q.toLowerCase();
    const list = orders.filter(o => A.filter === 'all' ? true : A.filter === 'active' ? !['delivered', 'cancelled', 'awaiting_payment'].includes(o.status) : o.status === A.filter)
      .filter(o => !q || (o.id + ' ' + o.customer.phone + ' ' + (o.customer.name || '') + ' ' + o.address.name + ' ' + (o.payment.utr || '')).toLowerCase().includes(q));
    p.innerHTML = `<div class="sec-head" style="margin-bottom:0"><h2 style="font-size:1.8rem">Orders</h2><span class="muted">${orders.length} total</span></div>
      <div class="toolbar"><input class="input" id="oq" placeholder="Search order no., phone, name or UTR" value="${esc(A.q)}" aria-label="Search orders"></div>
      <div class="chips" style="margin-bottom:14px">${F.map(f => `<button class="chip" data-f="${f[0]}" aria-pressed="${A.filter === f[0]}">${f[1]} <span class="num">${f[0] === 'all' ? orders.length : f[0] === 'active' ? orders.filter(o => !['delivered', 'cancelled', 'awaiting_payment'].includes(o.status)).length : orders.filter(o => o.status === f[0]).length}</span></button>`).join('')}</div>
      ${list.length ? `<div class="panel" style="padding:0">${orderTable(list)}</div>` : '<div class="panel"><p class="muted" style="margin:0">No orders match this filter.</p></div>'}`;
    $$('[data-f]', p).forEach(b => b.onclick = () => { A.filter = b.dataset.f; ordersTab(p); });
    const qi = $('#oq', p); qi.oninput = () => { A.q = qi.value; const pos = qi.selectionStart; ordersTab(p); const n = $('#oq', p); n.focus(); n.setSelectionRange(pos, pos); };
    bindRows(p);
  }
  function orderSheet(o) {
    const nx = NEXT[o.status];
    const a = o.address;
    const waMsg = { confirmed: 'your payment is received and your order is confirmed. We are packing it fresh.', packed: 'your podis are packed and will be sent out soon.', out_for_delivery: 'your order is out for delivery. Please keep your phone reachable.', delivered: 'your order is delivered. Thank you for choosing Annapurna Podulu!', payment_submitted: 'we received your order and are checking the payment.', awaiting_payment: 'we received your order. Please complete the UPI payment to confirm it.', cancelled: 'your order has been cancelled. Please contact us for any help.' }[o.status];
    const wa = 'https://wa.me/91' + o.customer.phone + '?text=' + encodeURIComponent('Namaste ' + (a.name || '') + ', Annapurna Podulu here. Order ' + o.id + ': ' + waMsg);
    const sh = AP.sheet(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">${esc(o.id)}</h2>${AP.pill(o.status)}</div>
      <div class="muted" style="margin:4px 0 12px">${AP.fmtDate(o.createdAt)}</div>
      ${AP.track(o)}
      <div class="stack" style="margin-top:10px">
        <div class="slip"><b>Packing slip</b>
          ${o.items.map(i => `<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px dotted var(--line)"><span>☐ ${esc(i.name)} · <b>${esc(i.w)}</b> × <b class="num">${i.qty}</b></span><span class="num">${rupee(i.p * i.qty)}</span></div>`).join('')}
          <div class="sum" style="margin-top:8px"><div><span>Delivery</span><span class="num">${o.delivery ? rupee(o.delivery) : 'Free'}</span></div><div class="tot"><span>Total</span><span class="num">${rupee(o.total)}</span></div></div>
          ${o.note ? `<div class="note" style="margin-top:8px"><b>Customer note:</b> ${esc(o.note)}</div>` : ''}
        </div>
        <div><b>Deliver to</b><div>${esc(a.name)} · <span class="num">${esc(a.phone)}</span></div><div class="muted">${esc(AP.addrText(a))}</div>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(AP.addrText(a))}" target="_blank" rel="noopener">Open in Google Maps</a></div>
        <div><b>Payment</b>${o.payment && o.payment.utr ? `<div>UTR <span class="num" style="font-weight:700">${esc(o.payment.utr)}</span> · submitted ${AP.fmtDate(o.payment.submittedAt)}</div><div class="muted" style="font-size:.88rem">Check this UTR and ${rupee(o.total)} in your PhonePe Business / bank statement before confirming.</div>` : '<div class="muted">Customer has not submitted payment yet.</div>'}
          ${o.payment && o.payment.screenshot ? `<img class="shot" src="${esc(o.payment.screenshot)}" alt="Payment screenshot" style="margin-top:8px">` : ''}</div>
        <div class="statusbar">${nx ? `<button class="btn btn-primary" id="nx">${nx[1]}</button>` : ''}
          <a class="btn btn-ghost" href="${esc(wa)}" target="_blank" rel="noopener">${AP.ICON.wa} WhatsApp customer</a>
          ${!['delivered', 'cancelled'].includes(o.status) ? '<button class="btn btn-ghost" id="cx">Cancel order</button>' : ''}</div>
        <details><summary class="muted" style="cursor:pointer">History</summary><div style="display:grid;gap:4px;margin-top:6px">${o.history.map(h => `<div class="muted" style="font-size:.88rem">${AP.fmtDate(h.at)} · ${esc(AP.STATUS_LABEL[h.status] || h.status)}</div>`).join('')}</div></details>
      </div>`);
    const set = async s => { const no = await api().adminSetStatus(o.id, s); sh.close(); AP.toast(no.id + ' → ' + AP.STATUS_LABEL[s]); await paint(); orderSheet(no); };
    const b = $('#nx', sh.el); if (b) b.onclick = () => set(nx[0]);
    const c = $('#cx', sh.el); if (c) c.onclick = () => { sh.close(); confirmBox('Cancel ' + o.id + '?', 'If the customer already paid, refund ' + rupee(o.total) + ' to them by UPI.', 'Cancel order', () => set('cancelled')); };
  }
  function confirmBox(title, body, okLabel, onOk) {
    const sh = AP.sheet(`<h2>${esc(title)}</h2><p class="muted">${esc(body)}</p><div class="statusbar"><button class="btn btn-primary" id="ok">${esc(okLabel)}</button><button class="btn btn-ghost" id="no">Keep</button></div>`);
    $('#ok', sh.el).onclick = async () => { sh.close(); await onOk(); };
    $('#no', sh.el).onclick = sh.close;
  }

  /* ---------- products ---------- */
  async function products(p) {
    const list = await api().products();
    p.innerHTML = `<div class="sec-head"><h2 style="font-size:1.8rem">Products</h2><button class="btn btn-primary" id="np">+ Add new podi</button></div>
      <div class="pgrid">${list.map(x => `<div class="prow"><img src="${esc(x.images[0] || 'img/logo-160.png')}" alt="">
        <div style="min-width:0"><b>${esc(x.name)}</b><div class="te" style="font-size:.9rem">${esc(x.te || '')}</div><div class="muted num" style="font-size:.85rem">${x.variants.map(v => esc(v.w) + ' ' + rupee(v.p)).join(' · ')}</div></div>
        <div class="actions"><label style="display:flex;gap:8px;align-items:center;font-size:.88rem"><span class="switch"><input type="checkbox" data-stock="${esc(x.id)}" ${x.inStock ? 'checked' : ''} aria-label="In stock"><span></span></span>${x.inStock ? 'In stock' : 'Sold out'}</label>
          <button class="btn btn-ghost btn-sm" data-ed="${esc(x.id)}">Edit · ${x.images.length} photos</button></div></div>`).join('')}</div>`;
    $('#np', p).onclick = () => editor(null);
    $$('[data-ed]', p).forEach(b => b.onclick = () => editor(list.find(x => x.id === b.dataset.ed)));
    $$('[data-stock]', p).forEach(c => c.onchange = async () => { const x = list.find(y => y.id === c.dataset.stock); x.inStock = c.checked; await api().adminSaveProduct(x); await AP.reload(); AP.toast(x.name + (c.checked ? ' is in stock' : ' marked sold out')); products(p); });
  }
  function editor(x) {
    const isNew = !x;
    x = x ? JSON.parse(JSON.stringify(x)) : { name: '', te: '', short: '', description: '', ingredients: '', pairs: '', heat: 2, images: [], variants: [{ w: '100 g', p: 0 }, { w: '250 g', p: 0 }, { w: '500 g', p: 0 }], inStock: true, bestseller: false };
    const sh = AP.sheet(`<h2>${isNew ? 'Add new podi' : 'Edit ' + esc(x.name)}</h2><form id="pe" class="stack" novalidate>
      <div class="field"><label>Photos <span class="muted">(first photo is the cover)</span></label><div class="imgs" id="imgs"></div></div>
      <div class="grid2"><div class="field"><label for="p_name">Name (English)</label><input class="input" id="p_name" value="${esc(x.name)}" placeholder="e.g. Pudina Podi"></div>
        <div class="field"><label for="p_te">Name (Telugu)</label><input class="input" id="p_te" value="${esc(x.te)}" placeholder="పుదీనా పొడి"></div></div>
      <div class="field"><label for="p_short">One-line description</label><input class="input" id="p_short" maxlength="90" value="${esc(x.short)}"></div>
      <div class="field"><label for="p_desc">Full description</label><textarea class="input" id="p_desc">${esc(x.description)}</textarea></div>
      <div class="field"><label for="p_ing">Ingredients</label><input class="input" id="p_ing" value="${esc(x.ingredients)}"></div>
      <div class="field"><label for="p_pairs">Best with</label><input class="input" id="p_pairs" value="${esc(x.pairs)}" placeholder="Hot rice + ghee, idli"></div>
      <div class="grid2"><div class="field"><label for="p_heat">Spice level</label><select class="input" id="p_heat">${[[1, 'Mild'], [2, 'Medium'], [3, 'Spicy']].map(h => `<option value="${h[0]}" ${+x.heat === h[0] ? 'selected' : ''}>${h[1]}</option>`).join('')}</select></div>
        <div class="field"><label>Badges</label><label style="display:flex;gap:8px;align-items:center;min-height:48px"><input type="checkbox" id="p_best" ${x.bestseller ? 'checked' : ''}> Show “Bestseller”</label></div></div>
      <div class="field"><label>Pack sizes & prices (₹)</label><div id="vars" class="stack" style="gap:8px"></div><button type="button" class="btn btn-ghost btn-sm" id="addv" style="justify-self:start">+ Add size</button></div>
      <div class="err" id="pe_err"></div>
      <div class="statusbar"><button class="btn btn-primary">${isNew ? 'Add to shop' : 'Save changes'}</button>${isNew ? '' : '<button type="button" class="btn btn-ghost" id="pdel">Delete podi</button>'}</div>
    </form>`);
    const paintImgs = () => {
      $('#imgs', sh.el).innerHTML = x.images.map((s, i) => `<div class="im"><img src="${esc(s)}" alt=""><button type="button" data-rm="${i}" aria-label="Remove photo">×</button>${i === 0 ? '<span class="first">Cover</span>' : `<button type="button" data-cv="${i}" style="left:3px;right:auto;width:auto;padding:0 6px;border-radius:6px;font-size:.65rem">Cover</button>`}</div>`).join('') +
        `<label class="add" for="up">+ Add<br>photos<input type="file" id="up" accept="image/*" multiple hidden></label>`;
      $$('[data-rm]', sh.el).forEach(b => b.onclick = () => { x.images.splice(+b.dataset.rm, 1); paintImgs(); });
      $$('[data-cv]', sh.el).forEach(b => b.onclick = () => { const [im] = x.images.splice(+b.dataset.cv, 1); x.images.unshift(im); paintImgs(); });
      $('#up', sh.el).onchange = async e => { for (const f of e.target.files) { try { x.images.push(await AP.fileToDataUrl(f, 900, .8)); } catch (er) { $('#pe_err', sh.el).textContent = er.message; } } paintImgs(); };
    };
    const paintVars = () => {
      $('#vars', sh.el).innerHTML = x.variants.map((v, i) => `<div class="vrow"><input class="input" data-vw="${i}" value="${esc(v.w)}" aria-label="Size" placeholder="250 g"><input class="input num" data-vp="${i}" inputmode="numeric" value="${v.p || ''}" aria-label="Price" placeholder="Price"><button type="button" class="btn btn-ghost btn-sm" data-vr="${i}" aria-label="Remove size">×</button></div>`).join('');
      $$('[data-vw]', sh.el).forEach(n => n.oninput = () => { x.variants[+n.dataset.vw].w = n.value.trim(); });
      $$('[data-vp]', sh.el).forEach(n => n.oninput = () => { x.variants[+n.dataset.vp].p = Number(n.value.replace(/\D/g, '')); });
      $$('[data-vr]', sh.el).forEach(b => b.onclick = () => { x.variants.splice(+b.dataset.vr, 1); paintVars(); });
    };
    paintImgs(); paintVars();
    $('#addv', sh.el).onclick = () => { x.variants.push({ w: '', p: 0 }); paintVars(); };
    const del = $('#pdel', sh.el); if (del) del.onclick = () => { sh.close(); confirmBox('Delete ' + x.name + '?', 'It will be removed from the shop. Past orders keep their details.', 'Delete', async () => { await api().adminDeleteProduct(x.id); await AP.reload(); AP.toast(x.name + ' deleted'); paint(); }); };
    $('#pe', sh.el).onsubmit = async e => {
      e.preventDefault(); const v = id => $('#' + id, sh.el).value.trim(); const err = m => { $('#pe_err', sh.el).textContent = m; };
      Object.assign(x, { name: v('p_name'), te: v('p_te'), short: v('p_short'), description: v('p_desc'), ingredients: v('p_ing'), pairs: v('p_pairs'), heat: +v('p_heat'), bestseller: $('#p_best', sh.el).checked });
      x.variants = x.variants.filter(z => z.w);
      if (x.name.length < 3) return err('Enter the podi name.');
      if (!x.images.length) return err('Add at least one photo.');
      if (!x.variants.length || x.variants.some(z => !(z.p > 0))) return err('Give every pack size a price above ₹0.');
      if (!x.short) x.short = x.description.slice(0, 80);
      const btn = $('button.btn-primary', sh.el); btn.disabled = true; btn.textContent = 'Saving…';
      try { await api().adminSaveProduct(x); await AP.reload(); sh.close(); AP.toast(isNew ? x.name + ' added to the shop' : 'Saved ' + x.name); paint(); }
      catch (er) { err(er.message); btn.disabled = false; btn.textContent = 'Save'; }
    };
  }

  /* ---------- settings ---------- */
  async function settings(p) {
    const s = await api().adminSettings();
    p.innerHTML = `<div class="sec-head"><h2 style="font-size:1.8rem">Shop settings</h2></div>
      <form id="ss" class="stack" novalidate>
        <div class="panel stack"><h2>PhonePe / UPI payment</h2>
          <div class="grid2"><div class="field"><label for="s_upi">UPI ID (from PhonePe Business)</label><input class="input" id="s_upi" value="${esc(s.upiId)}" placeholder="yourname@ybl"></div>
            <div class="field"><label for="s_payee">Name shown to payer</label><input class="input" id="s_payee" value="${esc(s.payeeName)}"></div></div>
          <div class="note">Customers see a QR with the exact order amount and order number. Use the UPI ID printed under your PhonePe merchant QR.</div></div>
        <div class="panel stack"><h2>Delivery</h2>
          <div class="grid2"><div class="field"><label for="s_fee">Delivery charge (₹)</label><input class="input num" id="s_fee" inputmode="numeric" value="${esc(s.deliveryFee)}"></div>
            <div class="field"><label for="s_free">Free delivery above (₹)</label><input class="input num" id="s_free" inputmode="numeric" value="${esc(s.freeDeliveryAbove)}"></div></div>
          <div class="field"><label for="s_pins">Deliverable pincodes start with (comma separated, empty = everywhere)</label><input class="input" id="s_pins" value="${esc(s.pincodePrefixes)}"></div></div>
        <div class="panel stack"><h2>Contact & security</h2>
          <div class="grid2"><div class="field"><label for="s_wa">WhatsApp number</label><input class="input num" id="s_wa" inputmode="numeric" value="${esc(s.whatsapp)}"></div>
            <div class="field"><label for="s_city">Shop location</label><input class="input" id="s_city" value="${esc(s.city)}"></div></div>
          <div class="field"><label for="s_pin">Admin PIN (4 to 8 digits)</label><input class="input num" id="s_pin" inputmode="numeric" maxlength="8" value="${esc(s.adminPin || '')}" placeholder="${s.adminPin === undefined ? 'Leave empty to keep current PIN' : ''}"></div></div>
        <div class="err" id="s_err"></div>
        <button class="btn btn-primary" style="justify-self:start">Save settings</button>
      </form>`;
    $('#ss', p).onsubmit = async e => {
      e.preventDefault(); const v = id => $('#' + id, p).value.trim(); const err = m => { $('#s_err', p).textContent = m; };
      const n = { upiId: v('s_upi'), payeeName: v('s_payee'), deliveryFee: Number(v('s_fee')) || 0, freeDeliveryAbove: Number(v('s_free')) || 0, pincodePrefixes: v('s_pins'), whatsapp: v('s_wa').replace(/\D/g, '').slice(-10), city: v('s_city') };
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(n.upiId)) return err('UPI ID looks wrong. It has the form name@bank, for example annapurna@ybl.');
      if (!/^[6-9]\d{9}$/.test(n.whatsapp)) return err('Enter the 10-digit WhatsApp number.');
      if (v('s_pin')) { if (!/^\d{4,8}$/.test(v('s_pin'))) return err('PIN must be 4 to 8 digits.'); n.adminPin = v('s_pin'); }
      await api().adminSaveSettings(n); await AP.reload(); AP.toast('Settings saved');
    };
  }

  return { render };
})();

/* Annapurna Podulu — customer app (router, catalog, cart, login, checkout, UPI payment, orders) */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rupee = n => '₹' + Number(n || 0).toLocaleString('en-IN');
  const LS = Store.LS;
  const S = { api: null, settings: {}, products: [], user: null, cart: LS.get('ap_cart', []), filter: 'all' };
  window.AP = { S, $, $$, esc, rupee };

  const ICON = {
    chilli: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 4.2c.9-.9 2.3-1.2 3.4-.6l-1 1.6c1.6.9 2.4 2.6 2.1 4.6-.6 4.6-5.6 10.4-13.4 12-1.4.3-2.2-1.4-1.1-2.3 3.9-3 6.6-6.7 7.6-10.3.4-1.6 1.6-2.8 3.1-3.1Z"/></svg>',
    check: '<svg class="i" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    leaf: '<svg class="i" viewBox="0 0 24 24"><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19 14 10"/></svg>',
    truck: '<svg class="i" viewBox="0 0 24 24"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>',
    hand: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3c-2 3-6 4.5-6 9a6 6 0 0 0 12 0c0-4.5-4-6-6-9Z"/></svg>',
    back: '<svg class="i" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/></svg>',
    wa: '<svg class="i" viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20Z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.2 1.8.8c-.2 1.3-1.2 2-2.5 1.9-3.3-.4-6-3.1-6.4-6.4-.1-1.3.6-2.3 1.9-2.5l.8 1.8L9 9.5Z"/></svg>',
    copy: '<svg class="i" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    pin: '<svg class="i" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
  };
  AP.ICON = ICON;
  const heat = n => '<span class="heat" title="Spice level ' + n + ' of 3" aria-label="Spice level ' + n + ' of 3">' + [1, 2, 3].map(i => '<span class="' + (i <= n ? '' : 'off') + '">' + ICON.chilli + '</span>').join('') + '</span>';
  const STATUS_LABEL = { awaiting_payment: 'Awaiting payment', payment_submitted: 'Payment being verified', confirmed: 'Confirmed', packed: 'Packed', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
  AP.STATUS_LABEL = STATUS_LABEL;
  AP.pill = s => '<span class="pill st-' + s + '">' + esc(STATUS_LABEL[s] || s) + '</span>';
  const fmtDate = t => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  AP.fmtDate = fmtDate;
  const waLink = (text) => 'https://wa.me/91' + String(S.settings.whatsapp || '').replace(/\D/g, '').slice(-10) + '?text=' + encodeURIComponent(text);
  AP.waLink = waLink;

  /* ---------- toast & sheets ---------- */
  let toastT;
  function toast(msg, linkHtml) {
    let t = $('.toast'); if (t) t.remove();
    t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (linkHtml || '');
    document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3200);
  }
  AP.toast = toast;
  function sheet(html, onClose) {
    const bg = document.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    const close = () => { bg.remove(); document.removeEventListener('keydown', key); onClose && onClose(); };
    const key = e => { if (e.key === 'Escape') close(); };
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    document.addEventListener('keydown', key);
    $('#layer').appendChild(bg);
    setTimeout(() => { const f = $('input,button,select,textarea', bg); f && f.focus(); }, 30);
    return { el: $('.sheet', bg), close };
  }
  AP.sheet = sheet;

  async function copyText(txt, el) {
    try { await navigator.clipboard.writeText(txt); toast('Copied ' + txt); }
    catch (e) { if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast('Selected. Long-press to copy.'); }
  }
  AP.copyText = copyText;

  /* image file → resized JPEG data URL */
  AP.fileToDataUrl = (file, max = 900, q = .82) => new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error('Choose a photo (JPG or PNG).'));
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', q));
    }; img.onerror = () => rej(new Error('That photo could not be opened.')); img.src = fr.result; };
    fr.onerror = () => rej(new Error('That photo could not be read.')); fr.readAsDataURL(file);
  });

  /* ---------- cart ---------- */
  const product = id => S.products.find(p => p.id === id);
  function saveCart() { LS.set('ap_cart', S.cart); paintCartCount(); }
  function paintCartCount() {
    const n = S.cart.reduce((s, l) => s + l.qty, 0);
    $$('[data-cartcount]').forEach(b => { b.textContent = n; b.hidden = !n; });
  }
  function cartLines() {
    return S.cart.map(l => { const p = product(l.pid); const v = p && p.variants.find(x => x.w === l.w); return p && v ? { ...l, p, v, total: v.p * l.qty } : null; }).filter(Boolean);
  }
  function totals() {
    const lines = cartLines(); const sub = lines.reduce((s, l) => s + l.total, 0);
    const del = !sub || sub >= Number(S.settings.freeDeliveryAbove) ? 0 : Number(S.settings.deliveryFee);
    return { lines, sub, del, total: sub + del };
  }
  function addToCart(pid, w, qty = 1) {
    const ex = S.cart.find(l => l.pid === pid && l.w === w);
    if (ex) ex.qty = Math.min(20, ex.qty + qty); else S.cart.push({ pid, w, qty });
    saveCart(); toast(product(pid).name + ' (' + w + ') added', '<a href="#cart">View cart</a>');
  }

  /* ---------- views ---------- */
  const V = {};
  const view = () => $('#view');

  V.shop = function () {
    const ps = S.products;
    const bowls = ps.slice(0, 6);
    const pos = [[33, 0], [66, 16], [66, 50], [33, 66], [0, 50], [0, 16]];
    const filters = [['all', 'All podis'], ['rice', 'For rice'], ['tiffin', 'For idli & dosa'], ['masala', 'Cooking masalas'], ['mild', 'Mild']];
    view().innerHTML = `
      <section class="hero"><div class="wrap">
        <div>
          <span class="eyebrow">${ICON.leaf} Homemade in Akkayyapalem, Vizag</span>
          <h1>Podulu ground the way <em>Amma</em> makes them</h1>
          <div class="te te-line">అమ్మ చేతి రుచి — ప్రతి ముద్దలో</div>
          <p class="lede">Seven traditional Andhra podis, roasted in small batches, packed fresh and delivered to your door. Order here and pay with PhonePe or any UPI app.</p>
          <div class="cta"><a class="btn btn-primary" href="#all">Shop podis</a><a class="btn btn-ghost" href="${waLink('Hi Annapurna Podulu, I would like to order')}" target="_blank" rel="noopener">${ICON.wa} WhatsApp us</a></div>
          <div class="trust"><span>${ICON.hand} No preservatives</span><span>${ICON.leaf} Small fresh batches</span><span>${ICON.truck} Free delivery above ${rupee(S.settings.freeDeliveryAbove)}</span></div>
        </div>
        <div class="plate" aria-hidden="true">
          ${bowls.map((p, i) => `<div class="bowl" style="left:${pos[i][0]}%;top:${pos[i][1]}%;animation-delay:${i * 70}ms"><img src="${esc(p.images[0])}" alt=""></div>`).join('')}
          <div class="seal"><img src="img/logo.png" alt=""></div>
        </div>
      </div></section>

      <section class="section" id="all"><div class="wrap">
        <div class="sec-head"><div><h2>Our podis</h2><div class="muted">Pick a pack size on each podi. Prices include packing.</div></div>
          <div class="chips" role="group" aria-label="Filter">${filters.map(f => `<button class="chip" data-f="${f[0]}" aria-pressed="${S.filter === f[0]}">${f[1]}</button>`).join('')}</div></div>
        <div class="grid" id="grid"></div>
      </div></section>

      <section class="section" style="padding-top:8px"><div class="wrap">
        <div class="sec-head"><h2>How ordering works</h2></div>
        <div class="steps">
          <div class="step"><span class="n"></span><b>Choose podis</b><p>Add packs to your cart. 100 g, 250 g or 500 g.</p></div>
          <div class="step"><span class="n"></span><b>Log in & add address</b><p>Verify your mobile number and give your full address with a landmark.</p></div>
          <div class="step"><span class="n"></span><b>Pay by PhonePe</b><p>Scan the UPI QR, pay the exact amount and enter the 12-digit UTR.</p></div>
          <div class="step"><span class="n"></span><b>We pack & deliver</b><p>Once payment is verified we pack fresh and deliver. Track it in My orders.</p></div>
        </div>
      </div></section>

      <section class="band"><div class="wrap">
        <div><h3>Bulk or gift orders?</h3><div style="opacity:.85">Weddings, functions and NRI parcels. Message us on WhatsApp <span class="num">${esc(S.settings.whatsapp)}</span></div></div>
        <a class="btn btn-ghost" href="${waLink('Hi, I want a bulk / gift order of podis')}" target="_blank" rel="noopener">${ICON.wa} Chat on WhatsApp</a>
      </div></section>
      ${footer()}`;
    paintGrid();
    $$('.chip', view()).forEach(c => c.onclick = () => { S.filter = c.dataset.f; $$('.chip').forEach(x => x.setAttribute('aria-pressed', x === c)); paintGrid(); });
  };
  function matches(p) {
    const f = S.filter; const txt = (p.pairs || '').toLowerCase();
    if (f === 'all') return true;
    if (f === 'rice') return /rice/.test(txt);
    if (f === 'tiffin') return /idli|dosa/.test(txt);
    if (f === 'masala') return /sambar|rasam|kootu|pulusu/.test(txt);
    if (f === 'mild') return p.heat <= 1;
    return true;
  }
  function paintGrid() {
    const g = $('#grid'); if (!g) return;
    const list = S.products.filter(matches);
    g.innerHTML = list.map(card).join('') || '<p class="muted">No podis in this group yet.</p>';
    $$('[data-add]', g).forEach(b => b.onclick = e => { e.stopPropagation(); const p = product(b.dataset.add); const sel = $('select[data-for="' + p.id + '"]', g); addToCart(p.id, sel ? sel.value : p.variants[0].w); });
    $$('select[data-for]', g).forEach(s => s.onchange = () => { const p = product(s.dataset.for); const v = p.variants.find(x => x.w === s.value); $('[data-price="' + p.id + '"]', g).textContent = rupee(v.p); });
  }
  function card(p) {
    const def = p.variants.find(v => v.w === '250 g') || p.variants[0];
    return `<article class="pcard">
      <a class="ph" href="#p-${esc(p.id)}" aria-label="${esc(p.name)} details">
        <img src="${esc(p.images[0])}" alt="${esc(p.name)} in a wooden bowl" loading="lazy">
        ${p.images[1] ? `<img class="alt" src="${esc(p.images[1])}" alt="" loading="lazy">` : ''}
        ${!p.inStock ? '<span class="tag oos">Sold out</span>' : p.bestseller ? '<span class="tag">Bestseller</span>' : ''}
      </a>
      <div class="lbl"><h3>${esc(p.name)}</h3><span class="te">${esc(p.te || '')}</span></div>
      <div class="body">
        <p class="short">${esc(p.short)}</p>
        <div class="row"><span class="price num" data-price="${esc(p.id)}">${rupee(def.p)}</span>${heat(p.heat)}</div>
        <div class="row">
          <select class="input" data-for="${esc(p.id)}" aria-label="Pack size" style="min-height:40px;padding:6px 10px">${p.variants.map(v => `<option ${v === def ? 'selected' : ''}>${esc(v.w)}</option>`).join('')}</select>
        </div>
        <button class="btn btn-primary btn-sm addbtn" data-add="${esc(p.id)}" ${p.inStock ? '' : 'disabled'}>${p.inStock ? 'Add to cart' : 'Sold out'}</button>
      </div></article>`;
  }
  function footer() {
    return `<footer><div class="wrap">
      <div><b style="color:var(--maroon)">Annapurna Podulu</b> · ${esc(S.settings.city)} · <span class="num">${esc(S.settings.whatsapp)}</span></div>
      <div><a href="#admin">Shop owner login</a></div>
    </div><div class="mode">${S.api.mode === 'demo' ? 'Demo mode: orders are saved in this browser only.' : S.settings.demo ? 'Demo site: login codes are shown on screen and data may reset.' : ''}</div></footer>`;
  }

  V.product = function (id) {
    const p = product(id);
    if (!p) { view().innerHTML = '<div class="wrap page empty"><h1>Podi not found</h1><a class="btn btn-primary" href="#shop">Back to shop</a></div>'; return; }
    let vi = Math.max(0, p.variants.findIndex(v => v.w === '250 g')), qty = 1, img = 0;
    view().innerHTML = `<div class="wrap"><a class="back" href="#shop">${ICON.back} All podis</a>
      <div class="pd">
        <div class="gallery"><div class="main"><img id="mainimg" src="${esc(p.images[0])}" alt="${esc(p.name)}"></div>
          <div class="thumbs">${p.images.map((s, i) => `<button data-i="${i}" aria-pressed="${i === 0}" aria-label="Photo ${i + 1}"><img src="${esc(s)}" alt=""></button>`).join('')}</div></div>
        <div class="stack" style="align-content:start">
          <div><h1>${esc(p.name)}</h1><div class="te">${esc(p.te || '')}</div></div>
          <div class="row" style="display:flex;gap:14px;align-items:center">${heat(p.heat)}<span class="muted">${['', 'Mild', 'Medium spicy', 'Spicy'][p.heat] || ''}</span>${p.inStock ? '' : AP.pill('cancelled').replace('Cancelled', 'Sold out')}</div>
          <p style="margin:0">${esc(p.description)}</p>
          <div class="field"><label>Pack size</label><div class="sizes">${p.variants.map((v, i) => `<button class="size" data-v="${i}" aria-pressed="${i === vi}"><b>${esc(v.w)}</b><span>${rupee(v.p)}</span></button>`).join('')}</div></div>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <div class="qty"><button data-q="-1" aria-label="Less">−</button><output id="q">1</output><button data-q="1" aria-label="More">+</button></div>
            <button class="btn btn-primary" id="add" style="flex:1" ${p.inStock ? '' : 'disabled'}>Add to cart · <span class="num" id="lt"></span></button>
          </div>
          <dl class="facts">
            <div><dt>Ingredients</dt><dd>${esc(p.ingredients)}</dd></div>
            <div><dt>Best with</dt><dd>${esc(p.pairs)}</dd></div>
            <div><dt>Shelf life</dt><dd>3 months. Keep in an airtight jar, use a dry spoon.</dd></div>
            <div><dt>Made in</dt><dd>${esc(S.settings.city)}</dd></div>
          </dl>
        </div></div></div>${footer()}`;
    const paint = () => { $('#q').textContent = qty; $('#lt').textContent = rupee(p.variants[vi].p * qty); $$('.size').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === vi)); };
    $$('.size').forEach(b => b.onclick = () => { vi = +b.dataset.v; paint(); });
    $$('[data-q]').forEach(b => b.onclick = () => { qty = Math.max(1, Math.min(20, qty + +b.dataset.q)); paint(); });
    $$('.thumbs button').forEach(b => b.onclick = () => { img = +b.dataset.i; $('#mainimg').src = p.images[img]; $$('.thumbs button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#add').onclick = () => addToCart(p.id, p.variants[vi].w, qty);
    paint();
  };

  V.cart = function () {
    const t = totals();
    if (!t.lines.length) {
      view().innerHTML = `<div class="wrap page"><div class="empty"><img src="img/logo-160.png" alt=""><h1>Your cart is empty</h1><p class="muted">Add a podi or two. Kandi podi and idly karam are the favourites.</p><a class="btn btn-primary" href="#shop">Browse podis</a></div></div>`; return;
    }
    const need = Number(S.settings.freeDeliveryAbove) - t.sub;
    view().innerHTML = `<div class="wrap page"><h1>Your cart</h1><div class="two">
      <div class="panel">${t.lines.map((l, i) => `<div class="line">
        <img src="${esc(l.p.images[0])}" alt="">
        <div class="nm">${esc(l.p.name)}<small>${esc(l.w)} · ${rupee(l.v.p)} each</small></div>
        <div class="rt"><b class="num">${rupee(l.total)}</b>
          <div class="qty sm"><button data-i="${i}" data-d="-1" aria-label="Less">−</button><output>${l.qty}</output><button data-i="${i}" data-d="1" aria-label="More">+</button></div>
        </div></div>`).join('')}</div>
      <div class="panel stack">
        <h2>Bill summary</h2>
        ${summary(t)}
        ${need > 0 ? `<div class="note leaf">Add ${rupee(need)} more for free delivery.</div>` : `<div class="note leaf">${ICON.check} You get free delivery.</div>`}
        <button class="btn btn-primary btn-block" id="go">Proceed to checkout</button>
        <a class="btn btn-ghost btn-block" href="#shop">Add more podis</a>
      </div></div></div>`;
    $$('[data-d]').forEach(b => b.onclick = () => { const l = S.cart[+b.dataset.i]; l.qty += +b.dataset.d; if (l.qty < 1) S.cart.splice(+b.dataset.i, 1); saveCart(); V.cart(); });
    $('#go').onclick = () => requireLogin(() => go('checkout'));
  };
  function summary(t) {
    return `<div class="sum"><div><span>Items (${t.lines.reduce((s, l) => s + l.qty, 0)})</span><span class="num">${rupee(t.sub)}</span></div>
      <div><span>Delivery</span><span class="num">${t.del ? rupee(t.del) : 'Free'}</span></div>
      <div class="tot"><span>To pay</span><span class="num">${rupee(t.total)}</span></div></div>`;
  }

  /* ---------- login (mobile + OTP) ---------- */
  function requireLogin(then) {
    if (S.user && S.user.name) return then();
    if (S.user && !S.user.name) return nameStep(then);
    const sh = sheet(`<h2>Log in with your mobile</h2>
      <p class="muted" style="margin-top:-6px">We send a one-time code by SMS. Your number is used only for delivery updates.</p>
      <form id="f1" class="stack" novalidate>
        <div class="field"><label for="ph">Mobile number</label>
          <div style="display:flex;gap:8px"><span class="input" style="width:auto;display:grid;place-items:center">+91</span>
          <input class="input" id="ph" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="98480 12345"></div></div>
        <div class="err" id="e1"></div>
        <button class="btn btn-primary btn-block">Send code</button>
      </form>`);
    $('#f1', sh.el).onsubmit = async e => {
      e.preventDefault(); const phone = $('#ph', sh.el).value.replace(/\D/g, '').slice(-10);
      const btn = $('button', e.target); btn.disabled = true; $('#e1', sh.el).textContent = '';
      try { const r = await S.api.requestOtp(phone); otpStep(sh, phone, r.devOtp, then); }
      catch (er) { $('#e1', sh.el).textContent = er.message; btn.disabled = false; }
    };
  }
  function otpStep(sh, phone, devOtp, then) {
    sh.el.innerHTML = `<h2>Enter the code</h2>
      <p class="muted" style="margin-top:-6px">Sent to +91 <b class="num">${esc(phone)}</b> · <button class="linkbtn" id="chg">Change</button></p>
      ${devOtp ? `<div class="devotp">Demo mode: SMS is not connected yet, so your code is <b class="num">${esc(devOtp)}</b></div>` : ''}
      <form id="f2" class="stack" novalidate style="margin-top:12px">
        <input class="input otp" id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••" aria-label="One-time code">
        <div class="err" id="e2"></div>
        <button class="btn btn-primary btn-block">Verify & continue</button>
        <button type="button" class="btn btn-ghost btn-block" id="resend">Resend code</button>
      </form>`;
    $('#otp', sh.el).focus();
    $('#chg', sh.el).onclick = () => { sh.close(); requireLogin(then); };
    $('#resend', sh.el).onclick = async () => { const r = await S.api.requestOtp(phone); otpStep(sh, phone, r.devOtp, then); toast('New code sent'); };
    $('#f2', sh.el).onsubmit = async e => {
      e.preventDefault(); const btn = $('button', e.target); btn.disabled = true;
      try { S.user = await S.api.verifyOtp(phone, $('#otp', sh.el).value); sh.close(); paintNav(); if (!S.user.name) nameStep(then); else { toast('Welcome back, ' + S.user.name.split(' ')[0]); then(); } }
      catch (er) { $('#e2', sh.el).textContent = er.message; btn.disabled = false; }
    };
  }
  function nameStep(then) {
    const sh = sheet(`<h2>What should we call you?</h2>
      <form id="f3" class="stack" novalidate><div class="field"><label for="nm">Your name</label><input class="input" id="nm" autocomplete="name" placeholder="e.g. Lakshmi Prasanna"></div>
      <div class="err" id="e3"></div><button class="btn btn-primary btn-block">Continue</button></form>`);
    $('#f3', sh.el).onsubmit = async e => {
      e.preventDefault(); const name = $('#nm', sh.el).value.trim();
      if (name.length < 2) { $('#e3', sh.el).textContent = 'Enter your name as it should appear on the parcel.'; return; }
      S.user = await S.api.saveProfile({ name }); sh.close(); toast('Hi ' + name.split(' ')[0] + '!'); then();
    };
  }

  /* ---------- address ---------- */
  function addressForm(a, then) {
    a = a || { name: S.user.name, phone: S.user.phone, city: 'Visakhapatnam', type: 'Home' };
    const sh = sheet(`<h2>${a.id ? 'Edit address' : 'Add delivery address'}</h2>
      <form id="fa" class="stack" novalidate>
        <div class="grid2">
          <div class="field"><label for="a_name">Receiver name</label><input class="input" id="a_name" autocomplete="name" value="${esc(a.name)}"></div>
          <div class="field"><label for="a_phone">Receiver mobile</label><input class="input" id="a_phone" inputmode="numeric" maxlength="10" value="${esc(a.phone)}"></div>
        </div>
        <div class="field"><label for="a_l1">House / flat no., building</label><input class="input" id="a_l1" autocomplete="address-line1" placeholder="Flat 302, Sai Residency" value="${esc(a.line1)}"></div>
        <div class="field"><label for="a_l2">Street, area</label><input class="input" id="a_l2" autocomplete="address-line2" placeholder="Akkayyapalem Main Road" value="${esc(a.line2)}"></div>
        <div class="field"><label for="a_lm">Landmark</label><input class="input" id="a_lm" placeholder="Near Vishal Mart" value="${esc(a.landmark)}"></div>
        <div class="grid2">
          <div class="field"><label for="a_city">City</label><input class="input" id="a_city" autocomplete="address-level2" value="${esc(a.city)}"></div>
          <div class="field"><label for="a_pin">Pincode</label><input class="input" id="a_pin" inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="530016" value="${esc(a.pincode)}"></div>
        </div>
        <div class="chips" role="radiogroup" aria-label="Address type">${['Home', 'Work', 'Other'].map(t => `<button type="button" class="chip" data-t="${t}" aria-pressed="${a.type === t}">${t}</button>`).join('')}</div>
        <div class="err" id="ea"></div>
        <button class="btn btn-primary btn-block">Save address</button>
      </form>`);
    let type = a.type || 'Home';
    $$('[data-t]', sh.el).forEach(b => b.onclick = () => { type = b.dataset.t; $$('[data-t]', sh.el).forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#fa', sh.el).onsubmit = async e => {
      e.preventDefault();
      const v = id => $('#' + id, sh.el).value.trim();
      const na = { id: a.id, name: v('a_name'), phone: v('a_phone').replace(/\D/g, ''), line1: v('a_l1'), line2: v('a_l2'), landmark: v('a_lm'), city: v('a_city'), pincode: v('a_pin'), type };
      const err = m => { $('#ea', sh.el).textContent = m; };
      if (na.name.length < 2) return err('Enter the receiver name.');
      if (!/^[6-9]\d{9}$/.test(na.phone)) return err('Enter a 10-digit mobile number for the delivery person to call.');
      if (na.line1.length < 3) return err('Enter the house or flat number and building.');
      if (na.line2.length < 3) return err('Enter the street and area.');
      if (!/^\d{6}$/.test(na.pincode)) return err('Pincode has 6 digits.');
      const pre = String(S.settings.pincodePrefixes || '').split(',').map(s => s.trim()).filter(Boolean);
      if (pre.length && !pre.some(p => na.pincode.startsWith(p))) return err('We deliver only in Visakhapatnam area right now (pincodes starting ' + pre.join(' / ') + '). Message us on WhatsApp for other places.');
      S.user = await S.api.saveAddress(na); sh.close(); toast('Address saved'); then && then(S.user.addresses[S.user.addresses.length - 1]);
    };
  }
  AP.addressForm = addressForm;
  const addrText = a => [a.line1, a.line2, a.landmark && ('Landmark: ' + a.landmark), a.city + ' ' + a.pincode].filter(Boolean).join(', ');
  AP.addrText = addrText;

  /* ---------- checkout ---------- */
  let chosenAddr = null;
  V.checkout = function () {
    if (!S.user) return requireLogin(() => V.checkout());
    const t = totals(); if (!t.lines.length) return go('cart');
    const addrs = S.user.addresses || [];
    if (!chosenAddr || !addrs.some(a => a.id === chosenAddr)) chosenAddr = addrs.length ? addrs[addrs.length - 1].id : null;
    view().innerHTML = `<div class="wrap page"><a class="back" href="#cart">${ICON.back} Cart</a><h1 style="margin-top:8px">Checkout</h1><div class="two">
      <div class="stack">
        <div class="panel stack"><h2>Deliver to</h2>
          <div class="stack" role="radiogroup" aria-label="Delivery address">${addrs.map(a => `<div class="addr" role="radio" tabindex="0" data-a="${esc(a.id)}" aria-checked="${a.id === chosenAddr}"><span class="dot"></span>
            <div><b>${esc(a.name)}</b> <span class="pill" style="color:var(--ink-soft);background:var(--paper-2)">${esc(a.type || 'Home')}</span><p>${esc(addrText(a))}</p><p class="num">+91 ${esc(a.phone)}</p></div>
            <button class="linkbtn" data-edit="${esc(a.id)}">Edit</button></div>`).join('') || '<p class="muted">Add the address where you want the podis delivered.</p>'}</div>
          <button class="btn btn-ghost" id="addA">${ICON.pin} Add new address</button>
        </div>
        <div class="panel stack"><h2>Note for us <span class="muted" style="font-family:var(--body);font-size:.85rem">(optional)</span></h2>
          <textarea class="input" id="note" placeholder="e.g. Less spicy idly karam if possible, or call before coming"></textarea></div>
      </div>
      <div class="panel stack"><h2>Order summary</h2>
        ${t.lines.map(l => `<div class="sum"><div><span>${esc(l.p.name)} · ${esc(l.w)} × ${l.qty}</span><span class="num">${rupee(l.total)}</span></div></div>`).join('')}
        ${summary(t)}
        <div class="note">You pay by scanning our PhonePe / UPI QR on the next screen. We pack your order once the payment is verified.</div>
        <div class="err" id="ec"></div>
        <button class="btn btn-primary btn-block" id="place" ${chosenAddr ? '' : 'disabled'}>Place order & pay ${rupee(t.total)}</button>
      </div></div></div>`;
    $$('.addr').forEach(el => { const pick = () => { chosenAddr = el.dataset.a; $$('.addr').forEach(x => x.setAttribute('aria-checked', x === el)); $('#place').disabled = false; }; el.onclick = pick; el.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pick(); } }; });
    $$('[data-edit]').forEach(b => b.onclick = e => { e.stopPropagation(); addressForm(addrs.find(a => a.id === b.dataset.edit), () => V.checkout()); });
    $('#addA').onclick = () => addressForm(null, a => { chosenAddr = a.id; V.checkout(); });
    $('#place').onclick = async () => {
      const b = $('#place'); b.disabled = true; b.textContent = 'Placing order…';
      try {
        const o = await S.api.placeOrder({ items: S.cart.map(l => ({ pid: l.pid, w: l.w, qty: l.qty })), addressId: chosenAddr, note: $('#note').value });
        S.cart = []; saveCart(); go('pay-' + o.id);
      } catch (er) { $('#ec').textContent = er.message; b.disabled = false; b.textContent = 'Place order & pay'; }
    };
  };

  /* ---------- payment ---------- */
  function upiUri(o) {
    const s = S.settings;
    return 'upi://pay?pa=' + encodeURIComponent(s.upiId) + '&pn=' + encodeURIComponent(s.payeeName) + '&am=' + Number(o.total).toFixed(2) + '&cu=INR&tn=' + encodeURIComponent('Order ' + o.id);
  }
  function qrSvg(text) {
    const q = qrcode(0, 'Q'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }
  V.pay = async function (id) {
    if (!S.user) return requireLogin(() => V.pay(id));
    const o = (await S.api.myOrders()).find(x => x.id === id);
    if (!o) { view().innerHTML = '<div class="wrap page empty"><h1>Order not found</h1><a class="btn btn-primary" href="#orders">My orders</a></div>'; return; }
    if (o.status !== 'awaiting_payment') return paySubmitted(o);
    const uri = upiUri(o); let shot = null;
    view().innerHTML = `<div class="wrap page"><div class="two">
      <div class="panel pay">
        <div><div class="muted">Order <b class="num" style="color:var(--maroon)">${esc(o.id)}</b> · Pay exactly</div><div class="amount">${rupee(o.total)}</div></div>
        <div class="qrbox"><div class="qr" aria-label="UPI QR code">${qrSvg(uri)}</div><span class="pp"><img src="img/logo-160.png" alt=""></span></div>
        <div class="muted" style="font-size:.9rem">Scan with PhonePe. Google Pay, Paytm, BHIM and bank apps also work.</div>
        <div class="apps"><span>PhonePe</span><span>Google Pay</span><span>Paytm</span><span>BHIM</span></div>
        <a class="btn btn-leaf" href="${esc(uri)}">Pay with a UPI app on this phone</a>
        <div class="copyrow"><span class="muted">UPI ID</span><code id="upi">${esc(S.settings.upiId)}</code><button class="btn btn-ghost btn-sm" id="cp">${ICON.copy} Copy</button></div>
      </div>
      <div class="panel stack">
        <h2>After paying, confirm here</h2>
        <ol class="muted" style="margin:0;padding-left:20px;display:grid;gap:4px">
          <li>Pay <b class="num">${rupee(o.total)}</b> to <b>${esc(S.settings.payeeName)}</b>.</li>
          <li>Open the payment in PhonePe history and copy the 12-digit <b>UTR</b> (also called UPI Ref. No. or transaction ID).</li>
          <li>Enter it below. A screenshot helps us verify faster.</li>
        </ol>
        <form id="fp" class="stack" novalidate>
          <div class="field"><label for="utr">UTR / UPI reference number</label><input class="input num" id="utr" inputmode="numeric" maxlength="12" placeholder="12 digits, e.g. 412345678901"></div>
          <div class="field"><label for="ss">Payment screenshot (optional)</label><input class="input" type="file" id="ss" accept="image/*"></div>
          <img id="ssprev" class="shot" alt="Payment screenshot preview" hidden>
          <div class="err" id="ep"></div>
          <button class="btn btn-primary btn-block">I have paid · Submit</button>
        </form>
        <div class="note">Paid but stuck? Send the screenshot on WhatsApp <span class="num">${esc(S.settings.whatsapp)}</span> with your order number.</div>
        <a class="btn btn-ghost" href="#orders">Pay later from My orders</a>
      </div></div></div>`;
    $('#cp').onclick = () => copyText(S.settings.upiId, $('#upi'));
    $('#ss').onchange = async e => { try { shot = await AP.fileToDataUrl(e.target.files[0], 1000, .75); $('#ssprev').src = shot; $('#ssprev').hidden = false; } catch (er) { $('#ep').textContent = er.message; } };
    $('#fp').onsubmit = async e => {
      e.preventDefault(); const btn = $('button', e.target); btn.disabled = true; $('#ep').textContent = '';
      try { const no = await S.api.submitPayment(o.id, { utr: $('#utr').value.replace(/\s/g, ''), screenshot: shot }); paySubmitted(no, true); }
      catch (er) { $('#ep').textContent = er.message; btn.disabled = false; }
    };
  };
  function paySubmitted(o, fresh) {
    const msg = 'Hi Annapurna Podulu, I placed order ' + o.id + ' for ' + rupee(o.total) + '. UTR: ' + (o.payment && o.payment.utr || '-');
    view().innerHTML = `<div class="wrap page"><div class="panel empty" style="max-width:560px;margin:0 auto">
      <img src="img/logo-160.png" alt="">
      <h1>${fresh ? 'Thank you! Order received' : 'Order ' + esc(o.id)}</h1>
      <div>${AP.pill(o.status)}</div>
      <p class="muted" style="max-width:42ch">We will check your payment of <b class="num">${rupee(o.total)}</b> (UTR <span class="num">${esc(o.payment && o.payment.utr || '-')}</span>), pack your podis fresh and deliver to ${esc(o.address.line2 || o.address.city)}. You can follow every step in My orders.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn btn-primary" href="#orders">Track my order</a>
      <a class="btn btn-ghost" href="${waLink(msg)}" target="_blank" rel="noopener">${ICON.wa} Send on WhatsApp</a></div>
    </div></div>`;
  }

  /* ---------- orders ---------- */
  const FLOW = ['payment_submitted', 'confirmed', 'packed', 'out_for_delivery', 'delivered'];
  AP.track = o => { const idx = FLOW.indexOf(o.status); const lb = ['Paid', 'Confirmed', 'Packed', 'On the way', 'Delivered'];
    return o.status === 'cancelled' || o.status === 'awaiting_payment' ? '' : `<div class="track">${lb.map((l, i) => `<div class="${i <= idx ? 'on' : ''}"><i></i>${l}</div>`).join('')}</div>`; };
  V.orders = async function () {
    if (!S.user) { view().innerHTML = `<div class="wrap page"><div class="empty"><h1>My orders</h1><p class="muted">Log in with your mobile number to see and track your orders.</p><button class="btn btn-primary" id="li">Log in</button></div></div>`; $('#li').onclick = () => requireLogin(() => V.orders()); return; }
    const list = await S.api.myOrders();
    view().innerHTML = `<div class="wrap page"><h1>My orders</h1>${!list.length ? `<div class="empty"><p class="muted">No orders yet.</p><a class="btn btn-primary" href="#shop">Order podis</a></div>` :
      `<div class="stack">${list.map(o => `<div class="ocard">
        <div class="hd"><span><span class="id">${esc(o.id)}</span> <span class="muted">· ${fmtDate(o.createdAt)}</span></span>${AP.pill(o.status)}</div>
        ${AP.track(o)}
        <div class="hd"><div class="thumbrow">${o.items.map(i => `<img src="${esc(i.img)}" alt="${esc(i.name)}" title="${esc(i.name)} ${esc(i.w)} × ${i.qty}">`).join('')}</div><b class="num">${rupee(o.total)}</b></div>
        <div class="muted" style="font-size:.9rem">${o.items.map(i => esc(i.name) + ' ' + esc(i.w) + ' × ' + i.qty).join(', ')}</div>
        ${o.status === 'awaiting_payment' ? `<a class="btn btn-primary btn-sm" href="#pay-${esc(o.id)}" style="justify-self:start">Pay now</a>` : ''}
      </div>`).join('')}</div>`}</div>`;
  };

  /* ---------- account ---------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  V.account = async function () {
    const u = S.user;
    view().innerHTML = `<div class="wrap page"><h1>Account</h1><div class="two"><div class="stack">
      ${u ? `<div class="panel stack"><h2>${esc(u.name || 'Your profile')}</h2><div class="muted num">+91 ${esc(u.phone)}</div>
          <div class="field"><label for="pn">Name</label><div style="display:flex;gap:8px"><input class="input" id="pn" value="${esc(u.name)}"><button class="btn btn-ghost" id="pns">Save</button></div></div></div>
        <div class="panel stack"><h2>Saved addresses</h2>
          ${(u.addresses || []).map(a => `<div class="addr" style="grid-template-columns:1fr auto;cursor:default"><div><b>${esc(a.name)}</b> · ${esc(a.type || 'Home')}<p>${esc(addrText(a))}</p></div>
            <div style="display:grid;gap:6px"><button class="linkbtn" data-e="${esc(a.id)}">Edit</button><button class="linkbtn" data-d="${esc(a.id)}">Remove</button></div></div>`).join('') || '<p class="muted">No addresses yet.</p>'}
          <button class="btn btn-ghost" id="adda">${ICON.pin} Add address</button></div>
        <button class="btn btn-ghost" id="lo">Log out</button>`
      : `<div class="panel empty"><img src="img/logo-160.png" alt=""><h2>Log in to order</h2><p class="muted">Use your mobile number. No password needed.</p><button class="btn btn-primary" id="li">Log in</button></div>`}
      </div>
      <div class="stack">
        <div class="panel stack"><h2>Get the app</h2><p class="muted" style="margin:0">Add Annapurna Podulu to your home screen for one-tap ordering.</p>
          <button class="btn btn-primary" id="inst">Install app</button>
          <div class="note" id="insthelp" hidden>On iPhone: tap Share, then “Add to Home Screen”. On Android Chrome: menu ⋮, then “Install app”.</div></div>
        <div class="panel stack"><h2>Contact</h2><div>${esc(S.settings.city)}</div><div class="copyrow"><span class="muted">WhatsApp</span><code id="wan">${esc(S.settings.whatsapp)}</code><button class="btn btn-ghost btn-sm" id="cpw">${ICON.copy}</button></div>
          <a class="btn btn-ghost" href="${waLink('Hi Annapurna Podulu')}" target="_blank" rel="noopener">${ICON.wa} Chat on WhatsApp</a></div>
        <a class="muted" href="#admin" style="text-align:center">Shop owner? Open admin panel</a>
      </div></div></div>`;
    $('#cpw').onclick = () => copyText(S.settings.whatsapp, $('#wan'));
    $('#inst').onclick = async () => { if (installEvt) { installEvt.prompt(); installEvt = null; } else $('#insthelp').hidden = false; };
    if (!u) { $('#li').onclick = () => requireLogin(() => V.account()); return; }
    $('#pns').onclick = async () => { S.user = await S.api.saveProfile({ name: $('#pn').value }); toast('Name saved'); };
    $('#adda').onclick = () => addressForm(null, () => V.account());
    $$('[data-e]').forEach(b => b.onclick = () => addressForm(u.addresses.find(a => a.id === b.dataset.e), () => V.account()));
    $$('[data-d]').forEach(b => b.onclick = async () => { S.user = await S.api.deleteAddress(b.dataset.d); toast('Address removed'); V.account(); });
    $('#lo').onclick = async () => { await S.api.logout(); S.user = null; toast('Logged out'); V.account(); };
  };

  /* ---------- router ---------- */
  function go(h) { if (location.hash.slice(1) === h) route(); else location.hash = h; }
  AP.go = go;
  function paintNav(key) {
    key = key || (location.hash.slice(1) || 'shop').split('-')[0];
    const map = { p: 'shop', all: 'shop', checkout: 'cart', pay: 'orders' };
    const k = map[key] || key;
    $$('[data-nav]').forEach(a => { if (a.dataset.nav === k) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  async function route() {
    const h = decodeURIComponent(location.hash.slice(1)) || 'shop';
    $$('.sheet-bg').forEach(x => x.remove());
    document.body.classList.toggle('is-admin', h === 'admin');
    paintNav(h.split('-')[0]);
    try {
      if (h === 'shop') V.shop();
      else if (h === 'all') { if (!$('#grid')) V.shop(); $('#all').scrollIntoView({ behavior: 'smooth' }); return; }
      else if (h.startsWith('p-')) V.product(h.slice(2));
      else if (h === 'cart') V.cart();
      else if (h === 'checkout') V.checkout();
      else if (h.startsWith('pay-')) await V.pay(h.slice(4));
      else if (h === 'orders') await V.orders();
      else if (h === 'account') await V.account();
      else if (h === 'admin') await Admin.render(view());
      else V.shop();
    } catch (e) { console.error(e); view().innerHTML = `<div class="wrap page empty"><h1>Something went wrong</h1><p class="muted">${esc(e.message)}</p><a class="btn btn-primary" href="#shop">Go to shop</a></div>`; }
    window.scrollTo(0, 0);
  }
  AP.route = route;
  AP.reload = async () => { S.settings = await S.api.settings(); S.products = await S.api.products(); };

  async function boot() {
    S.api = await Store.pick(); window.AP.api = S.api;
    await AP.reload();
    S.user = await S.api.me();
    S.cart = S.cart.filter(l => product(l.pid)); paintCartCount();
    window.addEventListener('hashchange', route);
    route();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') { navigator.serviceWorker.register('sw.js').catch(() => {}); }
  }
  boot();
})();

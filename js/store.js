/* Data layer. Two interchangeable backends with the same methods:
   - ApiBackend: talks to server/server.js (used when deployed on your server)
   - LocalBackend: keeps everything in this browser (demo / preview mode)
   The app picks ApiBackend automatically when /api/health answers. */
(function () {
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  const STATUS = ['awaiting_payment', 'payment_submitted', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];

  function priceOrder(products, settings, items) {
    const lines = [];
    for (const it of items) {
      const p = products.find(x => x.id === it.pid);
      if (!p || !p.inStock) throw new Error('One item in your cart is no longer available. Remove it and try again.');
      const v = p.variants.find(x => x.w === it.w);
      if (!v) throw new Error('Pack size changed for ' + p.name + '. Remove it and add it again.');
      const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
      lines.push({ pid: p.id, name: p.name, te: p.te, w: v.w, p: v.p, qty, img: p.images[0] });
    }
    if (!lines.length) throw new Error('Your cart is empty.');
    const subtotal = lines.reduce((s, l) => s + l.p * l.qty, 0);
    const delivery = subtotal >= Number(settings.freeDeliveryAbove) ? 0 : Number(settings.deliveryFee);
    return { items: lines, subtotal, delivery, total: subtotal + delivery };
  }
  function orderId(n) {
    const d = new Date();
    return 'AP' + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(n).padStart(4, '0');
  }

  /* ---------------- Local (demo) backend ---------------- */
  const DBKEY = 'ap_db_v1';
  const LocalBackend = {
    mode: 'demo',
    db: null,
    async init() {
      this.db = LS.get(DBKEY, null);
      if (!this.db) { this.db = { settings: clone(SEED.settings), products: clone(SEED.products), users: {}, orders: [], seq: 0 }; this.seedSampleOrders(); this.save(); }
    },
    save() { if (!LS.set(DBKEY, this.db)) throw new Error('This browser is out of storage space. Use smaller photos or deploy with the server.'); },
    seedSampleOrders() {
      // Example orders so the admin panel shows a realistic working state in demo mode
      const mk = (name, phone, area, items, status, hrs, utr) => {
        this.db.seq++;
        const priced = priceOrder(this.db.products, this.db.settings, items);
        const t = Date.now() - hrs * 3600e3;
        const o = Object.assign({ id: orderId(this.db.seq), createdAt: t, sample: true,
          customer: { phone, name }, address: { name, phone, line1: area[0], line2: area[1], landmark: area[2], city: 'Visakhapatnam', pincode: area[3] },
          status, payment: utr ? { utr, submittedAt: t + 6e5 } : {}, history: [{ status: 'awaiting_payment', at: t }] }, priced);
        if (utr) o.history.push({ status: 'payment_submitted', at: t + 6e5 });
        if (['confirmed', 'packed', 'out_for_delivery', 'delivered'].includes(status)) o.history.push({ status: 'confirmed', at: t + 2e6 });
        if (['packed', 'out_for_delivery', 'delivered'].includes(status)) o.history.push({ status: 'packed', at: t + 5e6 });
        if (['out_for_delivery', 'delivered'].includes(status)) o.history.push({ status: 'out_for_delivery', at: t + 8e6 });
        if (status === 'delivered') o.history.push({ status: 'delivered', at: t + 1e7 });
        this.db.orders.unshift(o);
      };
      mk('Lakshmi Prasanna (example)', '9848012345', ['Flat 302, Sai Residency', 'Akkayyapalem Main Road', 'Near Vishal Mart', '530016'], [{ pid: 'kandi', w: '250 g', qty: 2 }, { pid: 'idly-karam', w: '250 g', qty: 1 }], 'delivered', 50, '412345678901');
      mk('Ravi Teja (example)', '9701123456', ['D.No 45-8-12', 'Dwaraka Nagar 3rd Lane', 'Opp. Diamond Park', '530016'], [{ pid: 'karivepaku', w: '500 g', qty: 1 }, { pid: 'rasam', w: '100 g', qty: 2 }], 'packed', 20, '412398765432');
      mk('Sowjanya K (example)', '9963054321', ['H.No 9-21-7', 'Seethammadhara', 'Behind Bhima Jewellers', '530013'], [{ pid: 'sambar', w: '250 g', qty: 1 }, { pid: 'nuvvula', w: '250 g', qty: 1 }], 'payment_submitted', 2, '412311122233');
    },
    async settings() { const s = clone(this.db.settings); delete s.adminPin; return s; },
    async products() { return clone(this.db.products); },
    // auth
    async requestOtp(phone) {
      if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a 10-digit Indian mobile number.');
      const otp = String(Math.floor(1000 + Math.random() * 9000));
      LS.set('ap_otp', { phone, otp, at: Date.now() });
      return { sent: true, devOtp: otp };
    },
    async verifyOtp(phone, otp) {
      const rec = LS.get('ap_otp', null);
      if (!rec || rec.phone !== phone || rec.otp !== String(otp).trim()) throw new Error('That code does not match. Check the SMS and try again.');
      if (Date.now() - rec.at > 10 * 60e3) throw new Error('The code expired. Tap Resend to get a new one.');
      LS.del('ap_otp');
      if (!this.db.users[phone]) this.db.users[phone] = { phone, name: '', addresses: [], createdAt: Date.now() };
      this.save(); LS.set('ap_session', { phone, token: 'local-' + phone });
      return clone(this.db.users[phone]);
    },
    async me() { const s = LS.get('ap_session', null); return s && this.db.users[s.phone] ? clone(this.db.users[s.phone]) : null; },
    async logout() { LS.del('ap_session'); },
    _user() { const s = LS.get('ap_session', null); const u = s && this.db.users[s.phone]; if (!u) throw new Error('Please log in again.'); return u; },
    async saveProfile(p) { const u = this._user(); u.name = String(p.name || '').trim().slice(0, 60); this.save(); return clone(u); },
    async saveAddress(a) {
      const u = this._user(); a = Object.assign({}, a);
      if (!a.id) { a.id = 'ad' + Date.now().toString(36); u.addresses.push(a); }
      else { const i = u.addresses.findIndex(x => x.id === a.id); if (i >= 0) u.addresses[i] = a; else u.addresses.push(a); }
      this.save(); return clone(u);
    },
    async deleteAddress(id) { const u = this._user(); u.addresses = u.addresses.filter(a => a.id !== id); this.save(); return clone(u); },
    // orders
    async placeOrder({ items, addressId, note }) {
      const u = this._user(); const addr = u.addresses.find(a => a.id === addressId);
      if (!addr) throw new Error('Choose a delivery address.');
      const priced = priceOrder(this.db.products, this.db.settings, items);
      this.db.seq++;
      const o = Object.assign({ id: orderId(this.db.seq), createdAt: Date.now(), customer: { phone: u.phone, name: u.name }, address: clone(addr), note: String(note || '').slice(0, 300),
        status: 'awaiting_payment', payment: {}, history: [{ status: 'awaiting_payment', at: Date.now() }] }, priced);
      this.db.orders.unshift(o); this.save(); return clone(o);
    },
    async myOrders() { const u = this._user(); return clone(this.db.orders.filter(o => o.customer.phone === u.phone)); },
    async submitPayment(id, { utr, screenshot }) {
      const u = this._user(); const o = this.db.orders.find(x => x.id === id && x.customer.phone === u.phone);
      if (!o) throw new Error('Order not found.');
      if (!/^\d{12}$/.test(String(utr || '').trim())) throw new Error('The UTR / transaction ID has 12 digits. You can find it in PhonePe under the payment details.');
      o.payment = { utr: String(utr).trim(), screenshot: screenshot || null, submittedAt: Date.now() };
      if (o.status === 'awaiting_payment') { o.status = 'payment_submitted'; o.history.push({ status: 'payment_submitted', at: Date.now() }); }
      this.save(); return clone(o);
    },
    // admin
    async adminLogin(pin) { if (String(pin) !== String(this.db.settings.adminPin)) throw new Error('Wrong PIN.'); LS.set('ap_admin', true); return true; },
    async adminCheck() { return !!LS.get('ap_admin', false); },
    async adminLogout() { LS.del('ap_admin'); },
    async adminOrders() { return clone(this.db.orders); },
    async adminSetStatus(id, status) {
      const o = this.db.orders.find(x => x.id === id); if (!o) throw new Error('Order not found.');
      if (!STATUS.includes(status)) throw new Error('Unknown status.');
      o.status = status; o.history.push({ status, at: Date.now() });
      if (status === 'confirmed') o.payment.verifiedAt = Date.now();
      this.save(); return clone(o);
    },
    async adminSettings() { return clone(this.db.settings); },
    async adminSaveSettings(s) { Object.assign(this.db.settings, s); this.save(); return clone(this.db.settings); },
    async adminSaveProduct(p) {
      p = clone(p);
      if (!p.id) { p.id = (p.name || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('item-' + Date.now()); while (this.db.products.some(x => x.id === p.id)) p.id += '-2'; this.db.products.push(p); }
      else { const i = this.db.products.findIndex(x => x.id === p.id); if (i >= 0) this.db.products[i] = p; else this.db.products.push(p); }
      this.save(); return clone(p);
    },
    async adminDeleteProduct(id) { this.db.products = this.db.products.filter(p => p.id !== id); this.save(); },
    async resetDemo() { LS.del(DBKEY); LS.del('ap_session'); LS.del('ap_admin'); LS.del('ap_cart'); }
  };

  /* ---------------- API backend (server/server.js) ---------------- */
  const ApiBackend = {
    mode: 'live',
    async call(method, path, body, admin) {
      const h = { 'Content-Type': 'application/json' };
      const s = LS.get(admin ? 'ap_admin_token' : 'ap_session', null);
      if (s && s.token) h.Authorization = 'Bearer ' + s.token;
      const r = await fetch('api/' + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Something went wrong. Check your internet connection and try again.');
      return j;
    },
    async init() {},
    settings() { return this.call('GET', 'settings'); },
    products() { return this.call('GET', 'products'); },
    requestOtp(phone) { return this.call('POST', 'auth/request-otp', { phone }); },
    async verifyOtp(phone, otp) { const j = await this.call('POST', 'auth/verify', { phone, otp }); LS.set('ap_session', { phone, token: j.token }); return j.user; },
    async me() { if (!LS.get('ap_session', null)) return null; try { return await this.call('GET', 'me'); } catch (e) { return null; } },
    async logout() { try { await this.call('POST', 'auth/logout'); } catch (e) {} LS.del('ap_session'); },
    saveProfile(p) { return this.call('PUT', 'me', p); },
    saveAddress(a) { return this.call('POST', 'me/addresses', a); },
    deleteAddress(id) { return this.call('DELETE', 'me/addresses/' + encodeURIComponent(id)); },
    placeOrder(b) { return this.call('POST', 'orders', b); },
    myOrders() { return this.call('GET', 'orders'); },
    submitPayment(id, b) { return this.call('POST', 'orders/' + encodeURIComponent(id) + '/payment', b); },
    async adminLogin(pin) { const j = await this.call('POST', 'admin/login', { pin }); LS.set('ap_admin_token', { token: j.token }); return true; },
    async adminCheck() { if (!LS.get('ap_admin_token', null)) return false; try { await this.call('GET', 'admin/settings', null, true); return true; } catch (e) { return false; } },
    async adminLogout() { LS.del('ap_admin_token'); },
    adminOrders() { return this.call('GET', 'admin/orders', null, true); },
    adminSetStatus(id, status) { return this.call('PATCH', 'admin/orders/' + encodeURIComponent(id), { status }, true); },
    adminSettings() { return this.call('GET', 'admin/settings', null, true); },
    adminSaveSettings(s) { return this.call('PUT', 'admin/settings', s, true); },
    adminSaveProduct(p) { return this.call('POST', 'admin/products', p, true); },
    adminDeleteProduct(id) { return this.call('DELETE', 'admin/products/' + encodeURIComponent(id), null, true); },
    async resetDemo() {}
  };

  window.Store = {
    LS, STATUS,
    async pick() {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
        const r = await fetch('api/health', { signal: ctl.signal, cache: 'no-store' }); clearTimeout(t);
        const j = r.ok ? await r.json() : null;
        if (j && j.ok) { await ApiBackend.init(); return ApiBackend; }
      } catch (e) {}
      await LocalBackend.init(); return LocalBackend;
    }
  };
})();

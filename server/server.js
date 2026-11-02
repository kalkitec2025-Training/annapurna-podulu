/* Annapurna Podulu — production server (Node 18+, no npm packages needed).
   Serves the PWA and a small JSON API. Data lives in ./data (db.json + uploads/).

   Environment variables:
     PORT=8080                 port to listen on
     ADMIN_PIN=xxxx            first-run admin PIN (later changed from Admin → Shop settings)
     DEMO_OTP=1                show the OTP on screen instead of sending SMS (testing only!)
     DEMO_SEED=1               on a fresh database, add 3 example orders (for client demos on free hosting)
     SMS_WEBHOOK_URL=...       POST {phone, otp, message} here to send the SMS (e.g. MSG91 / Fast2SMS relay)
     SMS_WEBHOOK_TOKEN=...     sent as Authorization: Bearer <token> to the webhook
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const UPLOADS = path.join(DATA, 'uploads');
const DBFILE = path.join(DATA, 'db.json');
const PORT = Number(process.env.PORT || 8080);
fs.mkdirSync(UPLOADS, { recursive: true });

/* ---------- database (single JSON file, atomic writes) ---------- */
function loadSeed() {
  const sb = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8'), sb);
  return sb.window.SEED;
}
let db, fresh = false;
if (fs.existsSync(DBFILE)) db = JSON.parse(fs.readFileSync(DBFILE, 'utf8'));
else {
  const seed = loadSeed();
  db = { settings: seed.settings, products: seed.products, users: {}, orders: [], seq: 0, sessions: {}, adminSessions: {}, otps: {} };
  if (process.env.ADMIN_PIN) db.settings.adminPin = process.env.ADMIN_PIN;
  fresh = true;
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { const tmp = DBFILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DBFILE); }, 50);
}
save();

/* ---------- helpers ---------- */
const STATUS = ['awaiting_payment', 'payment_submitted', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];
const token = () => crypto.randomBytes(24).toString('hex');
const clone = o => JSON.parse(JSON.stringify(o));
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = m => { throw new HttpError(400, m); };
function send(res, code, obj) { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(b); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 12 * 1024 * 1024) { reject(new HttpError(413, 'Upload too large. Use photos under 5 MB.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!size) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new HttpError(400, 'Bad request.')); } });
  });
}
function bearer(req) { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7) : ''; }
function user(req) { const s = db.sessions[bearer(req)]; const u = s && db.users[s.phone]; if (!u) throw new HttpError(401, 'Please log in again.'); return u; }
function admin(req) { const s = db.adminSessions[bearer(req)]; if (!s || s.exp < Date.now()) throw new HttpError(401, 'Admin login expired. Enter the PIN again.'); }
function saveDataUrl(d, prefix) {
  if (typeof d !== 'string' || !d.startsWith('data:image/')) return d;
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(d); if (!m) bad('Photo format not supported. Use JPG or PNG.');
  const name = prefix + '-' + crypto.randomBytes(6).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(m[2], 'base64'));
  return 'uploads/' + name;
}
function publicSettings() { const s = clone(db.settings); delete s.adminPin; s.demo = process.env.DEMO_OTP === '1'; return s; }
function priceOrder(items) {
  if (!Array.isArray(items) || !items.length) bad('Your cart is empty.');
  const lines = items.slice(0, 40).map(it => {
    const p = db.products.find(x => x.id === it.pid);
    if (!p || !p.inStock) bad('One item in your cart is no longer available. Remove it and try again.');
    const v = p.variants.find(x => x.w === it.w); if (!v) bad('Pack size changed for ' + p.name + '. Remove it and add it again.');
    const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
    return { pid: p.id, name: p.name, te: p.te, w: v.w, p: v.p, qty, img: p.images[0] };
  });
  const subtotal = lines.reduce((s, l) => s + l.p * l.qty, 0);
  const delivery = subtotal >= Number(db.settings.freeDeliveryAbove) ? 0 : Number(db.settings.deliveryFee);
  return { items: lines, subtotal, delivery, total: subtotal + delivery };
}
function orderId() { db.seq++; const d = new Date(); return 'AP' + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(db.seq).padStart(4, '0'); }
async function sendSms(phone, otp) {
  if (!process.env.SMS_WEBHOOK_URL) return false;
  const r = await fetch(process.env.SMS_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (process.env.SMS_WEBHOOK_TOKEN || '') },
    body: JSON.stringify({ phone, otp, message: otp + ' is your Annapurna Podulu login code. Valid for 10 minutes.' }) });
  return r.ok;
}
const rate = {};
function limit(key, n, ms) { const now = Date.now(); rate[key] = (rate[key] || []).filter(t => now - t < ms); if (rate[key].length >= n) throw new HttpError(429, 'Too many attempts. Wait a few minutes and try again.'); rate[key].push(now); }

/* ---------- API routes ---------- */
async function api(req, res, p) {
  const m = req.method; const body = ['POST', 'PUT', 'PATCH'].includes(m) ? await readBody(req) : {};
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let r;
  if (m === 'GET' && p === 'health') return send(res, 200, { ok: true });
  if (m === 'GET' && p === 'settings') return send(res, 200, publicSettings());
  if (m === 'GET' && p === 'products') return send(res, 200, db.products);

  if (m === 'POST' && p === 'auth/request-otp') {
    const phone = String(body.phone || ''); if (!/^[6-9]\d{9}$/.test(phone)) bad('Enter a 10-digit Indian mobile number.');
    limit('otp:' + phone, 5, 15 * 60e3); limit('otpip:' + ip, 20, 15 * 60e3);
    const otp = String(crypto.randomInt(1000, 10000));
    db.otps[phone] = { otp, at: Date.now(), tries: 0 }; save();
    const sent = await sendSms(phone, otp).catch(() => false);
    if (!sent && process.env.DEMO_OTP !== '1') { console.log('[OTP]', phone, otp); throw new HttpError(503, 'SMS service is not set up yet. Please order on WhatsApp for now.'); }
    return send(res, 200, { sent: true, devOtp: process.env.DEMO_OTP === '1' ? otp : undefined });
  }
  if (m === 'POST' && p === 'auth/verify') {
    const phone = String(body.phone || ''); const rec = db.otps[phone];
    if (!rec || Date.now() - rec.at > 10 * 60e3) bad('The code expired. Tap Resend to get a new one.');
    if (++rec.tries > 5) { delete db.otps[phone]; save(); bad('Too many wrong codes. Tap Resend to get a new one.'); }
    if (String(body.otp || '').trim() !== rec.otp) { save(); bad('That code does not match. Check the SMS and try again.'); }
    delete db.otps[phone];
    if (!db.users[phone]) db.users[phone] = { phone, name: '', addresses: [], createdAt: Date.now() };
    const t = token(); db.sessions[t] = { phone, at: Date.now() }; save();
    return send(res, 200, { token: t, user: db.users[phone] });
  }
  if (m === 'POST' && p === 'auth/logout') { delete db.sessions[bearer(req)]; save(); return send(res, 200, { ok: true }); }
  if (m === 'GET' && p === 'me') return send(res, 200, user(req));
  if (m === 'PUT' && p === 'me') { const u = user(req); u.name = String(body.name || '').trim().slice(0, 60); save(); return send(res, 200, u); }
  if (m === 'POST' && p === 'me/addresses') {
    const u = user(req); const a = {}; for (const k of ['id', 'name', 'phone', 'line1', 'line2', 'landmark', 'city', 'pincode', 'type']) a[k] = String(body[k] || '').trim().slice(0, 160);
    if (!/^[6-9]\d{9}$/.test(a.phone) || !/^\d{6}$/.test(a.pincode) || a.line1.length < 3) bad('Check the address: mobile, house number and 6-digit pincode are needed.');
    if (!a.id) { a.id = 'ad' + Date.now().toString(36); u.addresses.push(a); } else { const i = u.addresses.findIndex(x => x.id === a.id); if (i >= 0) u.addresses[i] = a; else u.addresses.push(a); }
    save(); return send(res, 200, u);
  }
  if (m === 'DELETE' && (r = /^me\/addresses\/(.+)$/.exec(p))) { const u = user(req); u.addresses = u.addresses.filter(a => a.id !== decodeURIComponent(r[1])); save(); return send(res, 200, u); }

  if (m === 'POST' && p === 'orders') {
    const u = user(req); limit('order:' + u.phone, 10, 60 * 60e3);
    const addr = u.addresses.find(a => a.id === body.addressId); if (!addr) bad('Choose a delivery address.');
    const o = Object.assign({ id: orderId(), createdAt: Date.now(), customer: { phone: u.phone, name: u.name }, address: clone(addr), note: String(body.note || '').slice(0, 300),
      status: 'awaiting_payment', payment: {}, history: [{ status: 'awaiting_payment', at: Date.now() }] }, priceOrder(body.items));
    db.orders.unshift(o); save(); console.log('[ORDER]', o.id, u.phone, o.total);
    return send(res, 200, o);
  }
  if (m === 'GET' && p === 'orders') { const u = user(req); return send(res, 200, db.orders.filter(o => o.customer.phone === u.phone)); }
  if (m === 'POST' && (r = /^orders\/([^/]+)\/payment$/.exec(p))) {
    const u = user(req); const o = db.orders.find(x => x.id === decodeURIComponent(r[1]) && x.customer.phone === u.phone);
    if (!o) throw new HttpError(404, 'Order not found.');
    const utr = String(body.utr || '').trim(); if (!/^\d{12}$/.test(utr)) bad('The UTR / transaction ID has 12 digits. You can find it in PhonePe under the payment details.');
    if (db.orders.some(x => x.id !== o.id && x.payment && x.payment.utr === utr)) bad('This UTR is already used for another order. Check the number and try again.');
    o.payment = { utr, screenshot: body.screenshot ? saveDataUrl(body.screenshot, 'pay-' + o.id) : null, submittedAt: Date.now() };
    if (o.status === 'awaiting_payment') { o.status = 'payment_submitted'; o.history.push({ status: 'payment_submitted', at: Date.now() }); }
    save(); return send(res, 200, o);
  }

  /* admin */
  if (m === 'POST' && p === 'admin/login') {
    limit('admin:' + ip, 8, 15 * 60e3);
    if (String(body.pin || '') !== String(db.settings.adminPin)) bad('Wrong PIN.');
    const t = token(); db.adminSessions[t] = { exp: Date.now() + 7 * 24 * 3600e3 }; save(); return send(res, 200, { token: t });
  }
  if (p.startsWith('admin/')) admin(req);
  if (m === 'GET' && p === 'admin/orders') return send(res, 200, db.orders);
  if (m === 'PATCH' && (r = /^admin\/orders\/(.+)$/.exec(p))) {
    const o = db.orders.find(x => x.id === decodeURIComponent(r[1])); if (!o) throw new HttpError(404, 'Order not found.');
    if (!STATUS.includes(body.status)) bad('Unknown status.');
    o.status = body.status; o.history.push({ status: body.status, at: Date.now() }); if (body.status === 'confirmed') o.payment.verifiedAt = Date.now();
    save(); return send(res, 200, o);
  }
  if (m === 'GET' && p === 'admin/settings') return send(res, 200, publicSettings());
  if (m === 'PUT' && p === 'admin/settings') {
    const allowed = ['upiId', 'payeeName', 'whatsapp', 'city', 'deliveryFee', 'freeDeliveryAbove', 'pincodePrefixes', 'adminPin'];
    for (const k of allowed) if (body[k] !== undefined && body[k] !== '') db.settings[k] = body[k];
    save(); return send(res, 200, publicSettings());
  }
  if (m === 'POST' && p === 'admin/products') {
    const x = body; if (!x.name || !Array.isArray(x.variants) || !Array.isArray(x.images)) bad('Name, photos and pack sizes are needed.');
    if (!x.id) { x.id = String(x.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'; while (db.products.some(y => y.id === x.id)) x.id += '-2'; }
    x.images = x.images.slice(0, 10).map(im => saveDataUrl(im, 'p-' + x.id));
    x.variants = x.variants.map(v => ({ w: String(v.w).slice(0, 20), p: Math.max(1, Number(v.p) || 0) }));
    const i = db.products.findIndex(y => y.id === x.id); if (i >= 0) db.products[i] = x; else db.products.push(x);
    save(); return send(res, 200, x);
  }
  if (m === 'DELETE' && (r = /^admin\/products\/(.+)$/.exec(p))) { db.products = db.products.filter(y => y.id !== decodeURIComponent(r[1])); save(); return send(res, 200, { ok: true }); }
  throw new HttpError(404, 'Not found.');
}

/* ---------- static files ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function serveStatic(req, res, p) {
  let file = p === '/' ? '/index.html' : decodeURIComponent(p);
  const base = file.startsWith('/uploads/') ? DATA : ROOT;
  const full = path.normalize(path.join(base, file));
  const rel = path.relative(base, full);
  if (rel.startsWith('..') || path.isAbsolute(rel) || (base === ROOT && /^(server|data)([\\/]|$)/.test(rel))) { res.writeHead(404); return res.end(); }
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(full).toLowerCase();
    const cache = ['.html', '.webmanifest'].includes(ext) || full.endsWith('sw.js') ? 'no-cache' : 'public, max-age=604800';
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(full).pipe(res);
  });
}

/* ---------- demo seed (DEMO_SEED=1): example orders on a fresh database ---------- */
function seedExamples() {
  const H = 3600e3;
  const mk = (name, phone, a, items, status, hrs, utr) => {
    const t = Date.now() - hrs * H;
    const o = Object.assign({ id: orderId(), createdAt: t, customer: { phone, name }, address: { name, phone, line1: a[0], line2: a[1], landmark: a[2], city: 'Visakhapatnam', pincode: a[3], type: 'Home' },
      note: '', status, payment: utr ? { utr, submittedAt: t + 6e5 } : {}, history: [{ status: 'awaiting_payment', at: t }] }, priceOrder(items));
    const flow = ['payment_submitted', 'confirmed', 'packed', 'out_for_delivery', 'delivered'];
    flow.slice(0, flow.indexOf(status) + 1).forEach((s, i) => o.history.push({ status: s, at: t + (i + 1) * 2e6 }));
    db.orders.unshift(o);
  };
  mk('Lakshmi Prasanna (example)', '9848012345', ['Flat 302, Sai Residency', 'Akkayyapalem Main Road', 'Near Vishal Mart', '530016'], [{ pid: 'kandi', w: '250 g', qty: 2 }, { pid: 'idly-karam', w: '250 g', qty: 1 }], 'delivered', 50, '412345678901');
  mk('Ravi Teja (example)', '9701123456', ['D.No 45-8-12', 'Dwaraka Nagar 3rd Lane', 'Opp. Diamond Park', '530016'], [{ pid: 'karivepaku', w: '500 g', qty: 1 }, { pid: 'rasam', w: '100 g', qty: 2 }], 'packed', 20, '412398765432');
  mk('Sowjanya K (example)', '9963054321', ['H.No 9-21-7', 'Seethammadhara', 'Behind Bhima Jewellers', '530013'], [{ pid: 'sambar', w: '250 g', qty: 1 }, { pid: 'nuvvula', w: '250 g', qty: 1 }], 'payment_submitted', 2, '412311122233');
  save();
}
if (fresh && process.env.DEMO_SEED === '1') seedExamples();

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    try { await api(req, res, url.pathname.slice(5).replace(/\/$/, '')); }
    catch (e) { if (!(e instanceof HttpError)) console.error(e); send(res, e.code || 500, { error: e instanceof HttpError ? e.message : 'Server error. Please try again.' }); }
  } else serveStatic(req, res, url.pathname);
}).listen(PORT, () => console.log('Annapurna Podulu running on http://localhost:' + PORT + (process.env.DEMO_OTP === '1' ? '  (DEMO_OTP on: codes shown on screen)' : '')));

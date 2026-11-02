# Annapurna Podulu — Online Shop (PWA)

Installable shop app for **Annapurna Podulu**, Akkayyapalem, Visakhapatnam.
Customers browse the 7 podis, log in with mobile + OTP, add a delivery address, place the order and pay by **PhonePe / any UPI app** using a QR that already carries the exact amount and order number. The owner verifies the UTR in the admin panel, packs and delivers.

## What's inside

| Part | Where |
|---|---|
| Customer app (shop, product pages, cart, login, address, checkout, UPI QR payment, order tracking, install-to-home-screen) | `index.html`, `js/app.js` |
| Admin panel (dashboard, orders + payment verification + status, packing slip, WhatsApp the customer, add/edit podis with photo upload, sold-out switch, shop settings) | open `/#admin` — `js/admin.js` |
| Data layer (auto-switches between server and browser-only demo) | `js/store.js` |
| Product catalogue & default settings | `js/data.js` |
| PWA files | `manifest.webmanifest`, `sw.js`, `icons/` |
| Server (Node 18+, **no npm install needed**) | `server/server.js` |
| Product photos (bowl, pouch packshot, close-up for each podi) | `img/products/` |

## Free demo on Render (to show the client)

1. Create a GitHub account, make a new repository, and upload everything in this folder (drag and drop the files on the GitHub page, then Commit).
2. Sign up at render.com with that GitHub account → **New → Blueprint** → pick the repository. Render reads `render.yaml` and creates the free web service.
3. After about 2 minutes you get a link like `https://annapurna-podulu.onrender.com`. Shop at `/`, admin at `/#admin` (PIN 1234).

Free-tier behaviour to know:
- After 15 minutes with no visitors the site sleeps; the next visit takes about a minute to wake up.
- When it sleeps, restarts or is redeployed, **orders and logins are wiped** (free plan has no permanent disk). The 3 example orders come back automatically.
- To keep it awake during the client's review week, add a free monitor at uptimerobot.com that opens `/api/health` every 5 minutes. One always-on service fits inside the 750 free hours a month.

When the client approves: buy the domain, move to your server (below), and remove `DEMO_OTP` and `DEMO_SEED`.

## Run it on your server

```bash
# Node 18 or newer
cd annapurna-podulu
ADMIN_PIN=482913 PORT=8080 node server/server.js
```

Put it behind Nginx / Caddy with **HTTPS** (required for the PWA install prompt and service worker):

```nginx
server {
  server_name annapurnapodulu.in;
  client_max_body_size 15m;
  location / { proxy_pass http://127.0.0.1:8080; proxy_set_header X-Forwarded-For $remote_addr; }
}
```

Keep it running with pm2 or systemd: `pm2 start server/server.js --name annapurna`.

All data is stored in `data/db.json` and uploaded photos in `data/uploads/`. **Back up the `data/` folder daily.**

### Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Port (default 8080) |
| `ADMIN_PIN` | Admin PIN on first start. Change it later in Admin → Shop settings. |
| `SMS_WEBHOOK_URL` / `SMS_WEBHOOK_TOKEN` | Login OTP delivery. The server POSTs `{phone, otp, message}` to this URL. Point it at a small relay for MSG91 / Fast2SMS / Twilio (DLT-registered template needed in India). |
| `DEMO_OTP=1` | Testing only: shows the OTP on screen instead of SMS. **Never use on the live site.** |

## Before going live — checklist for the owner

1. **Admin → Shop settings → UPI ID**: replace `annapurnapodulu@ybl` (placeholder) with the UPI ID printed under the PhonePe Business QR.
2. **Prices**: the prices in the app are starting values. Set the real ones in Admin → Products → Edit.
3. Change the admin PIN from `1234`.
4. Delivery charge, free-delivery limit and deliverable pincodes (default `530`, `531` = Visakhapatnam).
5. Connect SMS for OTP (see above).
6. Upload real photos of the packed pouches in Admin → Products (the first photo is the cover).

## How payment works

1. Customer places the order → status **Awaiting payment**.
2. Pay screen shows a UPI QR (`upi://pay?pa=…&am=<total>&tn=Order AP2611-0007`). PhonePe, GPay, Paytm, BHIM all scan it. On a phone there is also a "Pay with a UPI app" button.
3. Customer enters the 12-digit UTR (+ optional screenshot) → **Payment being verified**.
4. Owner matches the UTR and amount in PhonePe Business, taps **Confirm** → Packed → Out for delivery → Delivered. The customer sees every step in My orders, and the owner can WhatsApp the customer an update with one tap.

The server rejects a UTR that was already used on another order. Automatic payment confirmation needs a PhonePe Payment Gateway merchant account; that can be added later on top of this flow.

## Demo mode

If the page is opened without the server (e.g. as static files), it runs in **demo mode**: everything is saved only in that browser, the OTP is shown on screen, admin PIN is `1234`, and three example orders are pre-loaded. Use this to show the client the flow.

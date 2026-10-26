# Content types: market taxonomy, payload specs, validation

Research date: **2026-10-25**. Companion to competitor-matrix.md and design-taxonomy.md. This
document answers: which content types do competitors actually ship, what are the exact payload
strings, what validation/escaping is required, and what should our 16 codecs implement.

**Notation.** [O] observed in shipped docs/UI; [S] standard/spec reference; [I] inferred. Payload
grammars are given as literal templates using `<field>` placeholders; `\n` means newline, `\;`
semicolon, etc.

**Compatibility warning baked into this doc.** Consumer cameras (iOS Camera, Google Lens) and
dedicated scanners disagree about several legacy formats. Generators converge on: URL, plain text,
WiFi, vCard 3.0, MeCard, mailto, tel, SMS, geo, and VEVENT; everything else (crypto, EPC, app-store,
social, PayPal) is either a URL or a specialist payload. We should encode the most compatible
variant by default and expose compatibility notes in the UI.

## 1. Platform content-type taxonomies

| Platform      | # of types observed                              | Observed type list (exact product names where captured)                                                                                                                                                                                                                                                                    | Evidence                                                                                                                                                       |
| ------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QRCode Monkey | 22+                                              | URL, Text, Email, Phone, SMS, vCard, MeCard, Location, Facebook, Twitter, Youtube, WIFI, Event, Bitcoin, more: MP3, Video, PDF, Social Media, App Store, Image Gallery, Rating, Feedback                                                                                                                                   | homepage type tabs [O] https://www.qrcode-monkey.com/                                                                                                          |
| QRCG by Bitly | "16 types of Dynamic QR Codes" + static variants | names not itemized in the captured article; describes "website destination ... video, social media channel, PDF" and points to their type guide                                                                                                                                                                            | [types article](https://support.qr-code-generator.com/hc/en-us/articles/7663644948621-Which-QR-Code-type-is-right-for-me) [O]                                  |
| Bitly         | URL-centric + barcode                            | links/QR codes for URLs; 2D barcodes with GTIN for packaging; no vCard/WiFi/event types observed                                                                                                                                                                                                                           | [pricing](https://bitly.com/pages/pricing), [API tutorial](https://dev.bitly.net/docs/tutorials/generate-qr-codes/) [O]                                        |
| Uniqode       | 15+ dynamic + static types                       | Dynamic: Website, Linkpage, PDF, Restaurant Menu, Form, Smart Rules, Social Media, Landing Page, Mobile App, Map Location, Coupon, Geolocation Redirect, Facebook, Business Page, Image, MP3, ...; static types documented separately                                                                                      | [types article](https://docs.uniqode.com/en/articles/7878270-types-of-qr-codes-on-uniqode) [O]                                                                 |
| Flowcode      | URL + landing pages                              | Flowcode/Flowpage destination types; CTA text; no structured vCard/WiFi/event payload observed                                                                                                                                                                                                                             | [design help](https://help.flowcode.com/en/articles/6927429-how-to-customize-a-flowcode-s-design) [O]                                                          |
| Scanova       | 22 create categories                             | Website URL, Google Maps, Business Card, Contact Card, Wi-Fi, Social Media, App Store, App Deep Link, Audio, Coupon, Text Message, Phone Number, Email, Calendar Event, Custom Page, Event, Wedding, Restaurant, Product, Feedback, Simple Text, GS1, AI QR                                                                | docs sidebar [O] https://docs.scanova.io/qr-codes/manage/custom-design                                                                                         |
| QR.io         | "QR code types" page; not itemized in capture    | dynamic vs static                                                                                                                                                                                                                                                                                                          | [pricing](https://qr.io/pricing), [static/dynamic help](https://help.qr.io/en/articles/6976947-what-is-the-difference-between-static-and-dynamic-qr-codes) [O] |
| QR TIGER      | 25+                                              | Sample page lists: File, vCard, URL, WiFi, App Store, Menu, Social Media, MP3, Pinterest, Instagram/YouTube/Facebook/TikTok/Twitter, Text, Email, H5 Editor, Multi URL, GS1 Digital Link, Video, SMS, Google Form, Event, Location; i18n adds Multi-URL, HTML, Google Review, App Store, Taobao, WeChat/Alipay aggregation | [sample QR codes](https://www.qrcode-tiger.com/sample-qr-codes-for-testing), shipped i18n [O]                                                                  |
| Hovercode     | link + documents                                 | Link, Text, PDF codes, short links, multi-link pages, forms, GS1 Digital Link; free tools for vCard, WhatsApp, Instagram, Google review                                                                                                                                                                                    | [API docs](https://hovercode.com/api/) [O]                                                                                                                     |
| Adobe Express | URL                                              | URL-centric generator; design/branding focus                                                                                                                                                                                                                                                                               | [page](https://www.adobe.com/express/feature/image/qr-code-generator) [O]                                                                                      |
| Canva         | URL                                              | URL generator (dynamic per Canva help title)                                                                                                                                                                                                                                                                               | [Canva help](https://www.canva.com/help/create-and-manage-dynamic-qr-codes/) [O, page 403]                                                                     |

**Normalized taxonomy (10 families):** link, text, contact (vCard/MeCard), message
(email/SMS/WhatsApp), wifi, event (VEVENT), payment (crypto/EPC/PayPal), social, app, location
(geo/maps). Our 16 types are a superset of what any single competitor ships in structured form.

## 2. Yopem 16 types vs market coverage

| Yopem type | In Yopem task-2 | Shipped by (examples)                                                                                        | Notes                                                                 |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| url        | yes             | all 11 products                                                                                              | universal                                                             |
| text       | yes             | QRCode Monkey, Scanova, QR TIGER, Hovercode                                                                  | universal                                                             |
| email      | yes             | QRCode Monkey, QRCG, Scanova, QR TIGER                                                                       | universal                                                             |
| phone      | yes             | QRCode Monkey, Scanova, QRCG                                                                                 | common                                                                |
| sms        | yes             | QRCode Monkey, QRCG, Scanova, QR TIGER                                                                       | common                                                                |
| whatsapp   | yes             | QR TIGER, Hovercode free tool, Scanova (social/message)                                                      | format is a URL, not a URI scheme                                     |
| wifi       | yes             | QRCode Monkey, QRCG, Scanova, QR TIGER, Uniqode (static only)                                                | Uniqode: "Wi-Fi QR Codes are static only" [O]                         |
| vcard      | yes             | QRCode Monkey, QRCG, Scanova, QR TIGER, Hovercode, Uniqode                                                   | universal on contact use cases                                        |
| mecard     | yes             | QRCode Monkey                                                                                                | niche legacy format; keep for scanner compatibility                   |
| geo        | yes             | QRCode Monkey ("Location"), Scanova (Google Maps), QR TIGER (Location), Uniqode (Map Location)               | often URLs instead of geo: URI                                        |
| event      | yes             | QRCode Monkey, QRCG, Scanova (Calendar Event/Event), QR TIGER                                                | VEVENT or event URL                                                   |
| crypto     | yes             | QRCode Monkey (Bitcoin)                                                                                      | niche; BIP21                                                          |
| epc        | yes             | Scanova (GS1/EPC not explicit; payment QR via landing pages), not common among US products                   | EU-specific differentiator                                            |
| app        | yes             | QR TIGER (App Store/App Deep Link), Scanova (App Store/App Deep Link), Uniqode (Mobile App), Flowcode (link) | usually dynamic landing with OS detection                             |
| social     | yes             | QRCode Monkey (Facebook/Twitter/Youtube), Scanova, QR TIGER, Uniqode, Hovercode tools                        | per-platform URL                                                      |
| paypal     | yes             | not captured as a first-class type in the core 11; premium generators (e.g. QRCodeChimp) market PayPal QR    | validate handle; PayPal business QR is generated in PayPal itself [I] |

**Coverage conclusion:** our 16-type set is at or above market breadth. The differentiated ones for
an EU/open-source product are **EPC/SEPA** and **PayPal**, which the US-centric leaders treat weakly
or not at all.

## 3. Payload specifications (exact strings, fields, validation)

### 3.1 URL

- Payload: `<absolute URL>`; recommended scheme http/https. Optional tracking UTM params.
- Fields: `url` (required).
- Validation [S RFC 3986]: parse with URL; require http/https for scanability and dynamic wrapping;
  reject javascript:/data: schemes; max practical length: keep <= 500 chars (dynamic short codes
  solve printed length).
- Notes: if type is dynamic, the QR encodes `<origin>/<shortCode>`, not the destination (server-side
  redirect). This is the only fully universal dynamic family.
- Spec: https://www.rfc-editor.org/rfc/rfc3986

### 3.2 Text

- Payload: raw UTF-8 text (byte mode). Embedding newlines is allowed (line breaks are part of the
  payload).
- Fields: `text` (required, rows textarea).
- Validation: non-empty; length budget per capacity table (section 4); reject NUL/control chars
  except LF; note that some scanners re-encode non-ASCII using Shift_JIS if no ECI is present [S
  ISO/IEC 18004].
- Capacity: version 40 byte-mode max is 2953/2331/1663/1273 bytes for EC L/M/Q/H [S].
- Spec: ISO/IEC 18004 (https://www.iso.org/standard/62021.html), qrcode.com capacity/EC pages.

### 3.3 Email

- Payload: `mailto:<to>?subject=<percent-encoded>&body=<percent-encoded>&cc=<...>&bcc=<...>`
- Fields: `to` (email, required), `subject`, `body` (textarea), optional cc/bcc.
- Validation [S RFC 6068]: RFC 5322 addr-spec for `to`; percent-encode subject/body (spaces as %20,
  CRLF as %0D%0A); do not include raw spaces in the URI. Multiple recipients comma-separated.
- Legacy alternative `MATMSG:TO:<to>;SUB:<subject>;BODY:<body>;;` — supported by older Android
  scanners; QRCode Monkey and ZXing document it; use mailto only (more universal today) [S ZXing].
- Spec: https://www.rfc-editor.org/rfc/rfc6068

### 3.4 Phone

- Payload: `tel:<number>`
- Fields: `number` (required).
- Validation [S RFC 3966]: keep leading `+`, strip spaces/dashes/parens; E.164 recommended (`+` and
  7-15 digits); `tel:` URI may include visual separators but keep them out for compatibility;
  extensions as `;ext=<digits>`.
- Spec: https://www.rfc-editor.org/rfc/rfc3966

### 3.5 SMS

- Payload (recommended): `sms:<number>?body=<percent-encoded message>`
- Legacy/alternative: `SMSTO:<number>:<message>` (documented by ZXing; used by several generators).
- Fields: `number` (required), `message` (optional, textarea).
- Validation [S RFC 5724]: number as tel (E.164 with +); percent-encode body; keep total payload
  short; note iOS/Android differences: `sms:?body=` generally works on iOS, `SMSTO:` on Android;
  emitting the RFC 5724 form is the safer default with a UI compatibility hint.
- Spec: https://www.rfc-editor.org/rfc/rfc5724, ZXing Barcode Contents

### 3.6 WhatsApp

- Payload: `https://wa.me/<digits>?text=<percent-encoded>` where `<digits>` is the international
  number without `+`, spaces or punctuation; alternative
  `https://api.whatsapp.com/send?phone=<digits>&text=...`
- Fields: `number` (required), `message` (optional, textarea).
- Validation: digits only, 7-15 digits, include country code; URL-encode text; reject empty number.
- Notes: this is a URL, not a URI scheme, so it is also a valid dynamic-QR destination [I]. WhatsApp
  QR is a first-class type at QR TIGER/Hovercode (generator tools) [O].
- Spec reference: WhatsApp's wa.me short link (platform doc; format stable) [I/S]

### 3.7 WiFi

- Payload: `WIFI:T:<WPA|WEP|nopass>;S:<ssid>;P:<password>;H:<true|false>;;`
- Fields: `ssid` (required), `password`, `encryption` (select WPA/WEP/nopass, default WPA), `hidden`
  (checkbox, emits `H:true` only when true).
- Escaping [S ZXing]: in SSID/password escape `\;`, `,`, `:`, `"` and `\` with a backslash; e.g.
  password `pass;word` becomes `pass\;word`. `H:true` for hidden networks. Omit `P:` for `nopass`
  (or leave empty).
- Validation: SSID 1-32 bytes (802.11 limit), WPA passphrase 8-63 chars or 64 hex; WEP key length
  5/13.
- Compatibility: iOS Camera and Android Lens handle WIFI:; some older scanners require `H:false` to
  be present or absent consistently.
- Spec: ZXing Barcode Contents https://github.com/zxing/zxing/wiki/Barcode-Contents

### 3.8 vCard

- Payload (vCard 3.0 preferred):
  `BEGIN:VCARD\nVERSION:3.0\nN:<last>;<first>;;;\nFN:<first> <last>\nORG:<org>\nTITLE:<title>\nTEL;TYPE=WORK,VOICE:<phone>\nEMAIL;TYPE=WORK:<email>\nURL:<url>\nADR;TYPE=WORK:;;<street>;<city>;<state>;<postal>;<country>\nNOTE:<note>\nEND:VCARD`
- Fields: `firstName`, `lastName`, `org`, `title`, `phone`, `email`, `website`, `address` (street,
  city, state, postal, country), `note`.
- Validation/escaping [S RFC 2426]: escape `\`, `;`, `,` and newlines (`\n` -> literal `\n`) in
  structured values; CRLF line endings per RFC (most QR readers accept LF; emit CRLF for spec
  correctness); TEL in international format with `tel:` URI optional
  (`TEL;TYPE=WORK,VOICE:+15551234567`); vCard 3.0 is the compatibility sweet spot — vCard 4.0
  (RFC 6350) is less consistently parsed by older Android scanners.
- Do not exceed version 40-M capacity with photos/URLs; consider a dynamic landing page for large
  cards.
- Specs: https://www.rfc-editor.org/rfc/rfc2426 (3.0), https://www.rfc-editor.org/rfc/rfc6350 (4.0),
  ZXing Barcode Contents

### 3.9 MeCard

- Payload:
  `MECARD:N:<last>,<first>;TEL:<phone>;EMAIL:<email>;ADR:<address>;URL:<url>;ORG:<org>;NOTE:<note>;;`
- Fields: same as vCard subset (first/last name, phone, email, website, address, org, note).
- Validation/escaping [S ZXing/DoCoMo]: semicolon-separated; escape `;`, `,`, `:`, `\` inside values
  with backslash; terminate with `;;`. Japanese-origin format, widely parsed by Japanese devices and
  most contact scanners; keep as an alternative output to vCard rather than default.
- Spec: ZXing Barcode Contents (MeCard section) https://github.com/zxing/zxing/wiki/Barcode-Contents

### 3.10 Geo / location

- Payload: `geo:<lat>,<lon>[,<alt>][?q=<lat>,<lon>]`
- Alternative: `https://maps.google.com/?q=<lat>,<lon>` or platform map URLs (Scanova "Google Maps"
  type).
- Fields: `lat` (required, -90..90), `lng` (required, -180..180), optional `label` (only for the URL
  variant; geo: has no label field — `q` carries coordinates, not a title).
- Validation [S RFC 5870]: decimal degrees, comma separator, no spaces (or percent-encode); 6
  decimals max meaningful; latitude/longitude ranges; reject NaN/Infinity.
- Spec: https://www.rfc-editor.org/rfc/rfc5870

### 3.11 Event (VEVENT)

- Payload:
  `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:<uuid>@<host>\nDTSTAMP:<UTC>Z\nDTSTART:<UTC>Z\nDTEND:<UTC>Z\nSUMMARY:<title>\nLOCATION:<location>\nDESCRIPTION:<description>\nEND:VEVENT\nEND:VCALENDAR`
- Fields: `title` (required), `start` (date+time), `end` (date+time, optional; default start+1h),
  `location`, `description`, optional `url`.
- Validation/escaping [S RFC 5545]: emit UTC with `Z` to avoid timezone ambiguity (encode local wall
  time converted to UTC in the browser, or send a TZID and include VTIMEZONE — UTC is far more
  robust); `DTSTART`/`DTEND` format `YYYYMMDDTHHMMSSZ`; escape `\`, `;`, `,`, newlines in text
  values; line folding at 75 octets per RFC (readers tolerate unfolded, but fold for correctness);
  UID must be unique.
- Note: Calendar Event is a named type at Scanova/QRCG; QRCode Monkey exposes "Event" [O].
- Spec: https://www.rfc-editor.org/rfc/rfc5545

### 3.12 Crypto (BIP21 / EIP-681)

- Bitcoin payload:
  `bitcoin:<address>?amount=<btc>&label=<percent-encoded>&message=<percent-encoded>`
- Ethereum payload (EIP-681): `ethereum:<address>[@<chainId>]?value=<wei>` (optionally `&data=`)
- Fields: `coin` (select BTC/ETH), `address` (required), `amount` (optional), `label`, `message`.
- Validation [S BIP21]: Bitcoin address base58/bech32 shape check (length, charset); amount in BTC
  with up to 8 decimals, no currency symbol; parameters percent-encoded; unknown params ignored by
  wallets. For ETH: 0x + 40 hex; chainId numeric; value in wei (integer).
- Niche: QRCode Monkey ships "Bitcoin" [O]; keep as an advanced type with clear warnings.
- Specs: https://github.com/bitcoin/bips/blob/master/bip-0021.mediawiki, EIP-681
  https://eips.ethereum.org/EIPS/eip-681 [S]

### 3.13 EPC / SEPA credit transfer (GiroCode, EPC069-12)

- Payload (newline-separated fields, optional marked):
  `BCD\n<version=002>\n<charset: 1=UTF-8|2=ISO-8859-1|... optional>\nSCT\n<BIC optional>\n<name>\n<IBAN>\nEUR<amount optional>\n<purpose code optional>\n<remittance reference optional>\n<remittance text optional>\n<information optional>`
- Fields: `name` (required, <=70 chars), `iban` (required), `bic` (optional for SEPA, required for
  non-EEA), `amount` (optional, EUR 0.01-999999999.99), `purpose` (4-char ISO 20022 code optional),
  `reference`, `message`.
- Validation [S EPC069-12 v3.x]: IBAN mod-97 checksum and country length; BIC 8 or 11 chars (ISO
  9362); amount uses dot decimal separator and `EUR` prefix; field charset restricted to the EPC
  character set; total payload <=331 bytes (v3) — validate before encoding; version field `002`
  signals v2+ layout; line breaks are real newlines, no trailing data after last field.
- Why it matters: EU-specific payment QR that US competitors ignore; a legitimate open-source
  differentiator for Yopem (EU/France context). Cite: European Payments Council EPC069-12 v3.0 PDF
  (public),
  https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2022-09/EPC069-12%20v3.0%20Quick%20Response%20Code%20-%20Guidelines%20to%20Enable%20the%20Data%20Capture%20for%20the%20Initiation%20of%20an%20SCT_0.pdf
  [S]

### 3.14 App store / deep link

- Payload: a URL. Two viable models:
  1. **Static**: one QR per store (`https://apps.apple.com/...`,
     `https://play.google.com/store/apps/details?id=...`).
  2. **Dynamic (recommended)**: QR encodes `<origin>/<shortCode>`; the redirect target is a small
     OS-aware router (`iOS URL` / `Android URL` / `fallback URL` / optional Harmony OS).
- Fields: `iosUrl`, `androidUrl`, `fallbackUrl` (required), optional `title`.
- Validation: each URL absolute http(s); store hosts allow-listed (apps.apple.com, play.google.com,
  appgallery.huawei.com, etc.) when the user picks a preset; deep-link schemes (myapp://) only
  allowed in the dynamic router config, never directly in the printed QR (scheme QRs break for users
  without the app).
- Market: QR TIGER ("App Store ... automatically links to the correct app store or play store
  link"), Scanova (App Store + App Deep Link), Uniqode (Mobile App with fallback URL) [O].
- Format is URL-only; no dedicated URI scheme. Cite QR TIGER shipped i18n "appstoreBody" and Uniqode
  types.

### 3.15 Social

- Payload: platform profile URL (e.g. `https://instagram.com/<handle>`, `https://x.com/<handle>`,
  `https://tiktok.com/@<handle>`, `https://facebook.com/<page>`, `https://youtube.com/@<channel>`,
  `https://linkedin.com/in/<profile>`).
- Fields: `platform` (select), `handle` or `url` (required), optional `label`.
- Validation: host + path shape per platform; normalize handle (strip @, leading URL if pasted);
  reject non-allow-listed hosts for the selected platform. Multi-link (linktree-style) pages are a
  dynamic landing feature, not a QR payload (QR TIGER "Multi URL", Uniqode Linkpage) [O].
- Market: QRCode Monkey (Facebook/Twitter/Youtube types), Scanova, QR TIGER, Uniqode, Hovercode
  tools [O].

### 3.16 PayPal

- Payload: `https://www.paypal.me/<handle>[/<amount><currency>]` or
  `https://www.paypal.com/paypalme/<handle>`
- Fields: `handle` (required), optional `amount` + `currency`.
- Validation: handle charset `[A-Za-z0-9._-]`, 1-20 chars; amount positive with 2 decimals;
  construct the URL with the user's locale-safe host; never encode credentials or merchant IDs [I].
- Note: PayPal's own business QR codes (generated inside PayPal for in-person payments) are not
  reproducible via a payload spec; our type is a "pay me" link QR. Treat as convenience, mark
  "external checkout".
- Evidence gap: not a named type in the 11 captured platforms; popular among premium generators [I].

## 4. Encoding constraints and capacity

- QR Code versions 1-40 (21x21 to 177x177 modules); our renderer uses `qrcode` (node-qrcode) which
  selects version by payload. Byte-mode capacity at version 40 [S ISO/IEC 18004, qrcode.com]: EC L
  2953 bytes, M 2331, Q 1663, H 1273.
- Higher error correction = lower capacity = denser code at fixed payload; the EC article quote from
  QRCG (30% tolerance at "high") matches EC H's ~30% recovery.
- **Practical budgets** we should enforce as warnings, not hard errors: URL <= 500 chars; text <=
  1000 chars (over that, suggest a dynamic landing page); vCard <= 800 chars (consider dynamic);
  WiFi <= 200; EPC <= 331 bytes (hard limit per spec); event <= 600.
- **UTF-8 vs ECI**: modern generators encode UTF-8 bytes; ISO/IEC 18004 ECI 26 declares UTF-8. Some
  scanners (esp. older Japanese devices) default to Shift_JIS when no ECI is present. For non-ASCII
  payloads, keeping the text short and testing on-device matters more than ECI tricks; node-qrcode
  can emit UTF-8 byte mode directly [I/S].
- **Dynamic vs static choice**: only URL-like payloads can be dynamic (server redirect). Our codec
  contract already marks `supportsDynamic` true for url, app, social, paypal. Everything else must
  be static — matching Uniqode's "Wi-Fi QR Codes are static only" rationale (WiFi credentials must
  be in the payload) [O].

## 5. Validation rules to implement (codec checklist)

| Type     | Hard validation                                     | Soft warnings                                    |
| -------- | --------------------------------------------------- | ------------------------------------------------ |
| url      | absolute http(s); no credentials in URL             | >500 chars; URL shortener domain; non-ASCII path |
| text     | non-empty                                           | >1000 chars; leading/trailing whitespace         |
| email    | addr-spec; required local+domain; no spaces         | long body; multiple recipients                   |
| phone    | E.164-ish, 7-15 digits, optional +                  | no country code                                  |
| sms      | number valid; message encoded                       | >160 chars (multi-part SMS)                      |
| whatsapp | digits only 7-15, country code required             | >500-char message                                |
| wifi     | SSID 1-32 bytes; WPA 8-63 chars                     | open network; hidden network; WEP legacy         |
| vcard    | N/FN present; valid email/phone if present          | >800 chars; missing FN derived                   |
| mecard   | N present; escaped delimiters                       | legacy format warning                            |
| geo      | lat/lon ranges, finite numbers                      | missing label; >6 decimal places                 |
| event    | title; start valid; end > start                     | duration >7 days; no end (default +1h)           |
| crypto   | coin-specific address shape; amount decimals        | test-network addresses; unsupported coin         |
| epc      | IBAN checksum; BIC shape; amount range; <=331 bytes | missing BIC; non-EUR; missing purpose            |
| app      | iOS/Android/fallback URLs absolute http(s)          | scheme-only deep links; no fallback              |
| social   | host allow-list for chosen platform; handle shape   | handle vs URL mismatch                           |
| paypal   | handle charset; amount positive 2dp                 | currency not supported by paypal.me path         |

Escaping test vectors every codec should include in unit tests:
semicolons/commas/colons/quotes/backslashes in WiFi SSID/password; newline + comma + semicolon in
vCard N/ADR/NOTE; `%20`, `%26`, `%3F` in mailto subject/body; timezone conversion for VEVENT; IBAN
with spaces normalized then checksum-validated; SSID with emoji (UTF-8 byte length, not JS length).

## 6. Scanner/parser compatibility notes (for the parse + scanner slice)

- Parse by **scheme/shape detection**, not by trust: `WIFI:` / `BEGIN:VCARD` / `MECARD:` /
  `BEGIN:VCALENDAR` / `mailto:` / `tel:` / `sms:`/`SMSTO:` / `geo:` / `bitcoin:` / `ethereum:` /
  `BCD\n` (EPC) / `http(s)://` / else text.
- Consumers: iOS Camera detects WiFi and vCard natively; Google Lens detects vCard/WiFi/URLs;
  browsers do not. Our scanner should offer copy/open/save-contact actions regardless.
- Security: never auto-open URLs from scanned codes without an interstitial; strip `javascript:` and
  `data:` payloads; vCard fields can contain phishing links — display before opening; EPC should
  show a "verify IBAN" warning. This is also a differentiator: none of the captured generators shows
  a structured pre-open safety card [O/I].
- BarcodeDetector API (https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector) is
  Chrome/Android only; jsQR (already a dependency) remains the cross-browser fallback. That hybrid
  is exactly what our scanner slice plans.

## 7. Decisions for Yopem codecs

1. Implement all 16 types with **URL-first compatibility**: every specialized type should offer a
   "compatibility mode" that encodes a hosted landing page URL instead of the raw payload (dynamic
   users), because app-store/social/event links often need it.
2. vCard default = **3.0**; keep MeCard as a legacy alternative (scanner parse target, not default
   output).
3. Event default = **UTC VEVENT with UID + DTSTAMP + DTEND** and RFC 5545 escaping/folding.
4. WiFi = ZXing grammar with strict escaping tests; encryption default WPA; hidden toggle emits
   `H:true`.
5. EPC = full validation (mod-97 IBAN, BIC, amount, 331-byte cap) — this is the EU wedge; do not
   ship a half-validated version.
6. Crypto = BIP21 for BTC + EIP-681 for ETH, with address-shape validation and "test network"
   warning.
7. Keep `supportsDynamic` limited to url/app/social/paypal (URL-only payloads) — matches market
   behavior and the redirect model.
8. Add a payload-length warning per type (see section 4 budgets) wired into the same ScanWarning
   surface as design errors (the type already has `data-too-long`).
9. Unit-test exact strings for every type (the codec slice plan) with the escaping vectors in
   section 5.
10. Parser must be defensive on malformed input and return a discriminated `kind` — the scanner card
    is a differentiator no captured generator ships on the web.

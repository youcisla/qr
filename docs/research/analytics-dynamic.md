# Analytics and dynamic-QR lifecycle: market evidence and plan gating

Research date: **2026-10-25**. Companion to competitor-matrix.md. Scope: what scan analytics
dimensions the market actually measures, how "unique" is defined (with verbatim quotes), how dynamic
codes are managed after printing (edit/pause/expire/password/routing), bulk/API capabilities, and
how all of it is gated. Ends with a concrete recommended schema/API for the Yopem backend slice.

**Notation.** [O] observed in cited artifact; [I] inferred; [S] spec/standard. `x` is inline code.

## 1. Tracking dimensions observed per platform

| Dimension                | QRCG            | Bitly                              | Uniqode                    | Flowcode                      | Scanova                                | qr.io       | QR TIGER                          | Hovercode       |
| ------------------------ | --------------- | ---------------------------------- | -------------------------- | ----------------------------- | -------------------------------------- | ----------- | --------------------------------- | --------------- |
| Total scans              | ✔              | ✔ (engagements)                   | ✔ "Total scans"           | ✔                            | ✔                                     | ✔          | ✔                                | ✔              |
| Unique scans/devices     | ✔ device-based | ✔ unique clicks (metrics article) | ✔ distinct devices        | ✔ unique scanners            | ✔ (scan-counting doc)                 | ~           | ✔ "individual people"            | ~               |
| Time series              | ✔ customizable | ✔ dashboards                      | ✔ timeline; day + hour    | ✔ 7/30/90/365/custom         | ✔ date/day/time                       | ✔          | ✔ day/week/month                 | ~               |
| Country / city           | ✔              | ✔                                 | ✔ Core+                   | ✔ Geography                  | ✔ city/country                        | ✔ location | ✔ top locations                  | ✔ paid         |
| Device type / OS         | ✔ OS           | ✔                                 | ✔ device + browser        | ✔ Traffic                    | ✔ device/browser/OS/handset           | ✔ OS       | ✔ iOS/Android                    | ✔ paid         |
| Browser                  | —               | ~                                  | ✔                         | ~ Traffic                     | ✔                                     | —           | —                                 | —               |
| Referrer / UTM           | —               | ✔ UTM campaigns                   | ✔ UTM on Core+            | ✔ tags/folders               | ✔ UTM builder + event tracking        | —           | ✔ UTM + GA4 + retargeting pixels | —               |
| GPS coordinates          | —               | —                                  | ✔ Plus/Business+          | —                             | ✔ exact GPS (with consent)            | —           | ✔ GPS heatmap                    | ✔ Business     |
| Hour-of-day              | —               | ✔ (dashboards)                    | ✔ hour-wise               | —                             | ✔ time                                | —           | —                                 | —               |
| Language                 | —               | —                                  | —                          | —                             | ✔ (API endpoint exists)               | —           | ✔ API                            | —               |
| Bot filtering            | —               | —                                  | —                          | —                             | ✔ "bot scans" docs                    | —           | —                                 | —               |
| CSV / Excel export       | ✔ CSV          | ✔                                 | ✔ CSV Core+               | ✔ CSV + PDF                  | ✔ CSV + Excel, aggregate + scan-level | —           | ✔ reports                        | ✔ CSV Business |
| Scheduled email reports  | —               | ✔ Weekly Insights                 | ✔ email reports all plans | ~                             | ✔ email reports                       | —           | —                                 | —               |
| Watchlist / alerts       | —               | ~                                  | ✔ Core+ watchlist         | —                             | —                                      | —           | ✔ scan notifications             | —               |
| GA / webhook integration | —               | ✔                                 | ✔ GA4                     | ✔ pixel                      | ✔ GA + webhooks                       | —           | ✔ GA4                            | ~               |
| Raw scan-level export    | —               | ✔ API                             | —                          | ✔ raw events (analytics API) | ✔ export-raw API                      | —           | —                                 | —               |
| Public API               | —               | ✔                                 | ✔ Core+                   | ✔ analytics API              | ✔ Management API v2                   | ✔          | ✔                                | ✔ Business     |

Evidence: QRCG
[scan statistics article](https://support.qr-code-generator.com/hc/en-us/articles/7665832310413-What-scan-statistics-do-Dynamic-QR-Codes-collect);
Bitly
[metrics](https://support.bitly.com/hc/en-us/articles/20370474672141-What-metrics-are-available-in-Bitly);
Uniqode
[analytics intro](https://docs.uniqode.com/en/articles/9305836-introduction-to-qr-code-analytics)
and
[analytics FAQ](https://docs.uniqode.com/en/articles/17213712-what-are-the-key-features-and-limitations-of-uniqode-s-qr-code-analytics);
Flowcode
[analytics breakdown](https://help.flowcode.com/en/articles/7061584-flowcode-analytics-breakdown);
Scanova [tracking page](https://scanova.io/features/qr-code-tracking) and docs sidebar
(https://docs.scanova.io/analytics/dashboard, /analytics/email-reports, /analytics/scan-counting,
/analytics/bot-scans, /analytics/reports); qr.io
[static/dynamic help](https://help.qr.io/en/articles/6976947-what-is-the-difference-between-static-and-dynamic-qr-codes);
QR TIGER
[tracking help](https://qrtiger.helpscoutdocs.com/article/124-how-do-i-track-my-qr-code-scans);
Hovercode [tracking page](https://hovercode.com/qr-code-tracking/) and pricing.

**Takeaway:** the market's analytics surface converges on 8 dimensions: total, unique, time series
(day+hour), country/city, device/OS/browser, referrer/UTM, GPS (premium), and export. Bot filtering
and scan-level raw export are differentiators (Scanova). Our planned schema (scan_events with
country, region, city, deviceType, os, browser, referer, ua, ipHash, visitorHash, isUnique) covers
the whole convergent set.

## 2. How "unique" is defined (verbatim, the most important analytics decision)

| Platform      | Definition (quoted)                                                                                                                                                                                                                                                                                                                                                         | Source                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| QRCG by Bitly | "**Unique Scans** refer to the specific device used for the scan. For example, if seven people scan your QR Code, and one of those people scans it twice, you get seven unique and eight total scans. Our system is tracking the devices that scan the QR Code, which means that if the same device is registered multiple times, it will still show one unique scan only." | [article](https://support.qr-code-generator.com/hc/en-us/articles/7665836150925-What-are-Total-Scans-and-Unique-Scans) [O]                  |
| Uniqode       | "**Unique Clicks**: The number of distinct devices that clicked your Linkpage. A single device counts as one Unique Click but can generate multiple Total Clicks."                                                                                                                                                                                                          | [analytics FAQ](https://docs.uniqode.com/en/articles/17213712-what-are-the-key-features-and-limitations-of-uniqode-s-qr-code-analytics) [O] |
| Flowcode      | "**Unique scanners** - number of scans by unique individuals. If I scanned a code more than once, this number filters out all those instances and would count me as 1 unique scan."                                                                                                                                                                                         | [analytics breakdown](https://help.flowcode.com/en/articles/7061584-flowcode-analytics-breakdown) [O]                                       |
| QR TIGER      | "**Total and Unique Scans**: The number of total scans and the number of individual people who scanned it."                                                                                                                                                                                                                                                                 | [tracking help](https://qrtiger.helpscoutdocs.com/article/124-how-do-i-track-my-qr-code-scans) [O]                                          |
| Scanova       | Docs ship a dedicated page "How scans are counted" plus "bot scans" filtering. Page content is client-rendered and was not captured; the page titles are shipped docs.                                                                                                                                                                                                      | [scan counting](https://docs.scanova.io/analytics/scan-counting), [bot scans](https://docs.scanova.io/analytics/bot-scans) [O, partial]     |
| Bitly         | "Engagement data is available for all of your Bitly Links, Bitly Codes, and Bitly Pages... The amount of data you can view ... depends on your subscription plan." Unique definition lives in their metrics docs; not quoted here.                                                                                                                                          | [metrics](https://support.bitly.com/hc/en-us/articles/20370474672141-What-metrics-are-available-in-Bitly) [O, partial]                      |

**Market reality:** "unique" is universally a **device/visitor identifier**, never a session and
never a person. No product publishes its hashing method or identifier lifetime. Yopem can win trust
by publishing: `uniqueScanCount` = first scan per (qrCode, visitorHash) over the code's lifetime;
`visitorHash = HMAC-SHA256(SCAN_SALT, ip + user-agent + accept-language)` with a rotating salt
policy; raw IP never stored. This matches the repo plan (ipHash + visitorHash columns) and is
GDPR-friendlier than any captured competitor's public description [I].

## 3. Time series, retention, and reporting cadence

| Platform  | Granularity                      | Retention                                                                                        | Reports                                                    | Evidence                                                                                                                                                                                                                         |
| --------- | -------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uniqode   | timeline; day-wise + hour-wise   | 60 days Essential / 90 Core / 180 Plus / lifetime Business+ (older plans: 30/60/90/180/lifetime) | weekly email reports to owner; separate QR vs form reports | [analytics intro](https://docs.uniqode.com/en/articles/9305836-introduction-to-qr-code-analytics), [FAQ](https://docs.uniqode.com/en/articles/17213712-what-are-the-key-features-and-limitations-of-uniqode-s-qr-code-analytics) |
| Hovercode | basic scans                      | 3 months free / 12 months Pro / unlimited Business+                                              | —                                                          | [pricing](https://hovercode.com/pricing/)                                                                                                                                                                                        |
| Flowcode  | 7/30/90/365/custom ranges        | — (plan-based dashboard access)                                                                  | CSV + PDF export                                           | [analytics breakdown](https://help.flowcode.com/en/articles/7061584-flowcode-analytics-breakdown)                                                                                                                                |
| QRCG      | day/week/month adjustable        | —                                                                                                | CSV download                                               | [scan stats](https://support.qr-code-generator.com/hc/en-us/articles/7665832310413-What-scan-statistics-do-Dynamic-QR-Codes-collect)                                                                                             |
| Bitly     | dashboards + weekly insights     | plan-dependent data access                                                                       | weekly insights + plain-language summaries (Bitly Assist)  | [metrics](https://support.bitly.com/hc/en-us/articles/20370474672141-What-metrics-are-available-in-Bitly)                                                                                                                        |
| Scanova   | date/day/time; scheduled reports | —                                                                                                | email scheduled reports, aggregate + scan-level CSV/Excel  | [tracking](https://scanova.io/features/qr-code-tracking), docs email-reports                                                                                                                                                     |
| QR TIGER  | day/week/month                   | —                                                                                                | reports page, watchlist alerts                             | [tracking](https://qrtiger.helpscoutdocs.com/article/124-how-do-i-track-my-qr-code-scans)                                                                                                                                        |

**Yopem plan:** range selector 7/30/90/all is the right minimum (matches Uniqode's old window scheme
and exceeds free tiers). Store raw events now; add daily rollups only if volume demands it (P2).

## 4. Dynamic QR lifecycle matrix

| Capability                         | QRCG                      | Bitly                         | Uniqode                                                 | Flowcode                    | Scanova                             | qr.io                   | QR TIGER                               | Hovercode                     | Yopem target (task-3)                    |
| ---------------------------------- | ------------------------- | ----------------------------- | ------------------------------------------------------- | --------------------------- | ----------------------------------- | ----------------------- | -------------------------------------- | ----------------------------- | ---------------------------------------- |
| Edit destination after print       | ✔                        | ✔                            | ✔                                                      | ✔ all plans                | ✔                                  | ✔                      | ✔                                     | ✔                            | P0 (updateQrCode + redirect)             |
| Pause / disable                    | ?                         | ?                             | ~ no direct disable; delete/redirect or start-end dates | — (codes permanent)         | ✔ scheduling / conditional disable | ?                       | ✔ scan limit, expiry                  | ~ codes don't expire; delete? | P0 status active/paused/archived         |
| Expiry / date window               | ?                         | ?                             | ✔ start/end dates in Advanced Settings; Smart Rules    | — never expire              | ✔ scheduling                       | ~ trial expiry only     | ✔ "stop working after a certain time" | —                             | P0 expiresAt + 410                       |
| Password                           | ?                         | ?                             | ~ Smart Rules                                           | —                           | ✔ password protection page         | ?                       | ✔ "add a password" article            | ?                             | P0 passwordHash (scrypt) + unlock cookie |
| Age restriction                    | —                         | —                             | —                                                       | —                           | ✔                                  | —                       | ?                                      | —                             | skip                                     |
| Conditional / A-B routing          | —                         | ✔ dynamic routing (10 rules) | ✔ Smart Rules + geolocation redirect                   | —                           | ✔ conditional redirection          | —                       | ✔ geofencing + multi-URL              | —                             | P2 weighted A/B                          |
| Geo routing                        | —                         | ✔ by country/region          | ✔ geolocation redirect                                 | —                           | ✔ GPS/geofencing                   | —                       | ✔ geofencing                          | —                             | P2 (country rule)                        |
| Scan limits                        | ✔ plan/scan-limit errors | ~ plan-based                  | —                                                       | ~ analytics visibility only | —                                   | ✔ unlimited            | ✔ free 500/code                       | ✔ unlimited all plans        | skip quotas for self-host                |
| Custom domain / short URL branding | ✔ customize short URL    | ✔                            | ✔ add-on Plus                                          | ✔ Domains                  | ✔ custom domains                   | ~ landing pages         | ✔                                     | ✔ Pro+                       | P2                                       |
| Multi-link / landing page          | —                         | Bitly Pages                   | ✔ Linkpage                                             | ✔ Flowpage                 | ✔ Page Builder                     | ✔ custom landing pages | ✔ Multi URL                           | ✔ multi-link pages           | skip (deliberate)                        |
| Tags/folders                       | ?                         | ✔ groups                     | ✔ labels                                               | ✔ folders/tags             | ✔ folders/tags                     | ?                       | ✔ campaigns/tags                      | ?                             | P0 tags[] + filter                       |
| Bulk operations                    | ✔ create multiple        | ?                             | ✔                                                      | ?                           | ✔ bulk ops                         | ✔ bulk creation        | ✔ up to 3,000/batch                   | ✔ Business+                  | P0 bulk actions API                      |
| API                                | ?                         | ✔ v4                         | ✔ Core+                                                | ✔ analytics API            | ✔ Management API v2                | ✔                      | ✔                                     | ✔ Business                   | P1 API keys + v1 endpoints               |
| Trash/restore                      | ?                         | ?                             | ✔ Trash                                                | ?                           | ✔ trash/restore                    | ?                       | ?                                      | ?                             | maybe P2                                 |

Key evidence:

- Uniqode: "While Uniqode doesn't offer a direct 'disable' function" + Start/End dates under
  Customization > Advanced Settings + Smart Rules can "disable a QR Code based on date, time, number
  of scans" and redirect elsewhere.
  [disable article](https://docs.uniqode.com/en/articles/9304694-how-do-i-disable-a-qr-code) [O]
- Bitly dynamic routing: "set up to 10 rules on a code, each based on one condition (country,
  region, device, or platform) using simple is or is not conditions. When someone clicks your code,
  Bitly checks the rules from top to bottom and sends the visitor to the destination for the first
  rule that matches." Conditions are ISO 3166-2 (country/region), Platform iOS/Android, Device
  Mobile/Tablet/Desktop; rules on a QR code apply to its paired link.
  [article](https://support.bitly.com/hc/en-us/articles/47519073494669-What-is-dynamic-routing-for-Bitly-QR-Codes)
  [O]
- Flowcode: "All Flowcodes are dynamic... update where your code scans to at any point in time" and
  "Flowcodes and Flowpages you create will never expire"; if a paid account downgrades, "only your 2
  most recent codes and Flowpages will remain editable" but codes keep scanning.
  [edit](https://help.flowcode.com/en/articles/6927428-how-to-edit-where-a-flowcode-scans-to),
  [expiry](https://help.flowcode.com/en/articles/7061611-will-my-codes-pages-expire) [O]
- QR TIGER: shipped help articles "How do I add a password to my QR code?", "Make a QR code stop
  working after a certain time", "Why does my QR code say it's expired", "How do I fix a QR code
  that has reached its scan limit". [O]
- Scanova: shipped docs pages under QR Codes — Manage: "QR Code scheduling", "Conditional
  redirection", "Password protection", "Age restriction", "GPS & geofencing", "UTM builder", "Custom
  domains", "Bulk Operations", "Trash, restore & permanent delete", "QR Health Center". [O, docs
  sidebar]
- QRCG: high-level scan limits produce a "Scan Limit" error page; trial expiry disables dynamic
  codes on some platforms (Uniqode note: "Dynamic QR Codes created on the free trial will
  automatically be disabled when the free trial period ends"). [O]

**Lifecycle semantics Yopem should adopt** (industry-aligned, better than most):

- `active`: redirect 307 to destination; delay counter update until after redirect decision.
- `paused`: HTTP 404 or a branded "temporarily paused" page; do not count scans (avoid polluting
  analytics); keep lastScannedAt unchanged.
- `expired` (expiresAt < now, status still active): HTTP 410 Gone with a branded page; record a scan
  event flagged non-counting if we want funnel data [I].
- `password`: challenge page at /unlock/<shortCode>, set a signed httpOnly cookie (30 min), then
  redirect; rate-limit attempts; never store plaintext; scrypt hash (repo plan).
- `archived`: 410, hidden from active list, restorable.
- Analytics on redirects: record scan only on the final successful redirect (after unlock/expiry
  checks), matching "scans" semantics rather than "attempts" [I].

## 5. Bulk operations and public APIs (shipped docs)

| Platform      | API surface                                                                                                                                                                                                                                                                                                                                                                                                      | Rate limits / auth                                                                                                    | Bulk                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Hovercode     | Base `https://hovercode.com/api/v2/`, token auth (`Authorization: Token <token>`), create/update dynamic QR codes, PDF codes, short links, landing pages, forms, GS1 Digital Link; fields: `qr_data`, `qr_type` (Link default; Text), `size` (default 220), `logo_url`, `template`, `logo_round`, `primary_color` (#111111), `background_color`, `pattern`, `eye_style`, `frame`, `has_border`, `text`, `folder` | Phase: reads 120/min, writes 60/min, unauth 20/min per IP; RateLimit-\* headers; 429 + Retry-After; MCP server 60/min | Business plan: bulk QR code generator; Business+ adds webhooks |
| Scanova       | Management API v2, e.g. `/api-reference/management-api/bulk-operation/{generate,validate,update-content,rename,quick-action}`; analytics `overview, countries, devices, languages, export, export-raw, qr-analytics`; `qr-assets/conditional-redirect-*` CRUD                                                                                                                                                    | n/a (docs)                                                                                                            | CSV/Excel bulk + API generation                                |
| QR TIGER      | QR Code API documented publicly; "Bulk QR code generation up to 3,000 per batch" (shipped i18n feature string)                                                                                                                                                                                                                                                                                                   | n/a                                                                                                                   | 3,000/batch                                                    |
| Bitly         | `POST /v4/qr-codes` (stand-alone: `destination.long_url`; coupled: `destination.bitlink_id`); `render_customizations` object; `POST` consumes QR quota                                                                                                                                                                                                                                                           | plan quota; API docs at dev.bitly.net                                                                                 | via API loops                                                  |
| Uniqode       | API on Core+; bulk creation; GPS/CSV/watchlist on Core+                                                                                                                                                                                                                                                                                                                                                          | plan-gated                                                                                                            | bulk                                                           |
| qr.io         | "API Access" and "Bulk Creation" listed in plan                                                                                                                                                                                                                                                                                                                                                                  | n/a                                                                                                                   | bulk                                                           |
| QRCode Monkey | Image API via RapidAPI: `/qr/custom`, `/qr/transparent`, `/qr/uploadImage`                                                                                                                                                                                                                                                                                                                                       | RapidAPI metering                                                                                                     | batch loops                                                    |
| Flowcode      | Analytics API + raw events (help categories "API & Developer Portal")                                                                                                                                                                                                                                                                                                                                            | n/a                                                                                                                   | —                                                              |

**Yopem target:** keep the simple server actions + REST endpoints from task-3 (PATCH /api/qr/[id],
POST /api/qr/bulk, GET /api/qr/export CSV) and add API keys + `/api/v1/qr` bearer auth as P1
(stretch in task-3). Mirror Hovercode's field naming where reasonable (`pattern`, `eye_style`,
`frame`, `text`) because it is the only captured product whose design is fully expressible via a
documented JSON API — that "design as API" is a differentiator we should claim.

## 6. Plan gating (analytics + lifecycle + API)

| Platform  | Free                                                     | Entry paid                                                            | Analytics gate                                                       | Lifecycle gate                                                              | API gate        |
| --------- | -------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------- |
| Uniqode   | static free (no analytics)                               | $9/mo yearly Essential (15 dynamic)                                   | retention 60/90/180/lifetime; CSV Core+; watchlist Core+; GPS Plus+  | start/end + Smart Rules available broadly; trial disables dynamic on expiry | Core+           |
| Flowcode  | 2 codes, unlimited scans, 500 analytics scans            | Pro / Pro+ (quote)                                                    | advanced analytics Pro/Pro+                                          | edit all plans; 2 most recent editable after downgrade                      | analytics API   |
| QR TIGER  | unlimited static; 3 dynamic × 500 scans; basic analytics | $7/mo Regular (12 dynamic, advanced analytics)                        | advanced analytics paid                                              | password/expiry paid features                                               | QR API paid     |
| Hovercode | 3 dynamic codes, unlimited scans, 3-month analytics      | €11/mo Pro                                                            | 12-month history Pro, unlimited Business; device/location + GPS paid | no expiry on free codes                                                     | Business        |
| Scanova   | 14-day trial                                             | public tiers (not captured in detail)                                 | feature pages for tracking; trial gate                               | password/scheduling/conditional in docs                                     | API docs public |
| qr.io     | 7-day trial; static survive                              | $39.99/mo unlimited everything                                        | included                                                             | included                                                                    | included        |
| Bitly     | free tier                                                | Core/Growth/Premium/Enterprise (prices client-rendered, not captured) | "data you can view depends on plan"; analytics dashboards paid       | dynamic routing paid                                                        | API plan-gated  |
| QRCG      | static without account; trial                            | Starter/Advanced/Professional                                         | dynamic-only stats                                                   | dynamic-only; scan limits                                                   | ?               |

**Yopem positioning implication:** every captured competitor gates analytics depth, password,
expiry, or API behind payment. An open-source, self-hosted product shipping
pause/expiry/password/analytics for free is a direct competitive answer to the market's most
consistent paywall.

## 7. Recommended analytics implementation for Yopem (maps to task-3)

Schema (already specified by the Lead in task-3, confirmed adequate):

- `scan_events(id, qrCodeId, scannedAt, country, region, city, deviceType, os, browser, referer, userAgent, ipHash, visitorHash, isUnique)`
  with index `(qrCodeId, scannedAt)`.
- `qr_codes.scanCount` / `uniqueScanCount` / `lastScannedAt` counters updated in the redirect path.

Dimensions to expose in the API (mirroring the convergent market set):

1. `totalScans`, `uniqueScans`, `lastScanAt`;
2. `daily[]` (`{date, total, unique}`) for 7/30/90/all;
3. `hours[24]` (hour-of-day histogram; Uniqode/Scanova parity);
4. `countries[]`, `cities[]` (`{name, count}`);
5. `devices[]` (mobile/tablet/desktop), `os[]`, `browsers[]`;
6. `referrers[]` (host + count), plus parsed `utmSource/Medium/Campaign` from referer where present
   [P2];
7. `browser/OS split` and `device split` charts in the dashboard UI slice;
8. CSV export: aggregate rows + raw scan-level rows (Scanova parity), respecting privacy (no raw
   IP).

Unique-scan policy (publish it):

- `visitorHash` = HMAC(SCAN_SALT, ipHash + "|" + UA + "|" +
  accept-language)`; `isUnique`= true only for the first event of that visitorHash on that qrCode;`uniqueScanCount`
  increments on those.
- Recompute-safe: `uniqueScans` in time ranges = count(distinct visitorHash) in range; all-time uses
  the stored counter (matches "unique devices over lifetime" semantics of Uniqode/QRCG).
- Bot handling: UA parser flags bots (`deviceType = "bot"`); exclude bots from unique and show a
  "filtered bots" note (Scanova's bot-scans page is the precedent). Add `isBot` at aggregation time;
  do not migrate schema for it.

Geo/UA sources: Vercel headers `x-vercel-ip-country/region/city` first, then `cf-ipcountry`;
dependency-free UA parser in `analytics/ua.ts` (repo plan). Referer from `Referer` header; strip own
origin.

Privacy: never persist raw IP; hash with salt (`SCAN_SALT` env, required in prod, fallback dev
constant); document retention (keep raw events 12 months by default, P2 configurable). This is a
trust differentiator versus the opaque definitions quoted in `2.

## 8. Dynamic lifecycle implementation notes (beyond task-3 minimum)

- **Password**: scrypt (`node:crypto`) with per-QR salt; signed unlock cookie bound to shortCode +
  expiry; attempt throttling by ipHash in a small in-memory/DB counter (P1). Hovercode/Scanova/QR
  TIGER all gate this behind paid tiers — shipping it free is notable.
- **Expiry**: `expiresAt` enforced in `[shortCode]/+server.ts`; return **410 Gone** (not 404) with a
  branded page so campaign owners can distinguish mis-scans from exhausted campaigns; market
  precedent: QR TIGER "Why does my QR code say it's expired", QRCG scan-limit error page.
- **Pause**: status `paused` -> 404/branded page without counting; different from expire
  (resumable).
- **A/B testing** (P2, market-thin): store `variants: [{url, weight}]` in `contentData` (or a new
  JSONB column) and bucket on `visitorHash` hash mod 100; log `variant` in scan_events metadata (add
  JSONB column). Only Bitly dynamic routing and Uniqode Smart Rules approximate this today, so a
  clean weighted split would be ahead of market.
- **Conditional rules** (P2): start with country + device rule sets (Bitly's exact four condition
  types: country, region, platform, device) because they are the observed market schema; expand to
  time windows.
- **Custom domains** (P2): redirect host mapping; Scanova/Hovercode/QR TIGER/Bitly all sell it.
- **Scan limits** (skip): only freemium SaaS needs them; self-host should never break a printed
  code.

## 9. Deliberate skips for this build

- Landing-page/flowpage builders, form builders, multi-link pages (Uniqode Linkpage, Flowcode
  Flowpage, Scanova Page Builder, QR TIGER Multi URL): large product surface, no QR-engine leverage.
- GPS-level tracking (Uniqode Plus+, Scanova, QR TIGER, Hovercode Business): requires browser
  geolocation consent flows on the redirect page; high privacy cost. IP-level country/city covers
  the 90% case.
- Age restriction (Scanova): compliance niche, no demand signal from the captured set.
- Retargeting pixels (Uniqode Core+, QR TIGER GA/FB pixels): marketing-tracking integrations; P2 if
  ever.
- Weekly insight emails / AI summaries (Bitly Assist, Uniqode AI analytics insights): email infra +
  LLM dependency; out of scope for an open-source self-host default.
- SSO/SAML/SCIM, audit logs, team seats: enterprise SaaS mechanics; the market sells them, but they
  do not improve the QR product core.

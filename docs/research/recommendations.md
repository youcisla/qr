# Recommendations: prioritized roadmap for the Yopem QR rebuild

Research date: **2026-10-25**. Synthesis of competitor-matrix.md, design-taxonomy.md,
content-types.md and analytics-dynamic.md. Priorities are ordered by _competitive necessity x
leverage on our existing slices_. Effort is S (up to 0.5 day), M (1-2 days), L (3+ days) for one
focused agent. "Slice" maps each item to the in-flight team tasks: lead = QR engine core +
integration; codec-dev = content codecs/parser/scanner; backend-dev = data
layer/analytics/redirect/APIs; studio-ui = /studio; management-ui = dashboard.

## 0. What the market says matters (one-paragraph summary)

Every serious competitor converges on the same core: a 3-layer design model (modules / eyes /
background), a logo with error-correction warnings, frames with CTA text, templates, PNG/SVG/PDF
export, dynamic short links with scan analytics, and a paid tier that gates analytics
depth/password/expiry/API. The market leaders win on **catalogue breadth + templates + guardrails**,
not on exotic QR math. Our rebuild already targets all of this; the recommendations below are about
hitting parity fast (P0), exceeding the market where it is weak (P1: design system breadth, print
safety, templates, API), and taking differentiated bets (P2: A/B routing, per-eye transforms) only
after the core is verified.

## 1. P0: ship these or the product is behind market

| #     | Recommendation                                                                                                                                                                                                                               | Why (evidence)                                                                                                                                                                              | Effort | Slice                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------- |
| P0-1  | **All 16 content types with exact payloads + validation**, especially WiFi/vCard 3.0/MeCard/mailto/tel/SMS/geo/VEVENT/BIP21/EPC069-12                                                                                                        | Market breadth is 15-25 types (Uniqode, Scanova, QR TIGER); EPC/SEPA is an EU wedge no US leader does properly                                                                              | L      | codec-dev (task-2)           |
| P0-2  | **Structured scan-result parser + camera scanner** (parseQrPayload -> actions)                                                                                                                                                               | No captured generator ships a structured-result web scanner; this is a real differentiator and feeds the "what was scanned" story                                                           | M      | codec-dev (task-2)           |
| P0-3  | **Full QrDesign engine** with split eyes, gradients, logo (clean mode), frames, quiet zone, EC                                                                                                                                               | The split dot/eye-frame/eye-ball model is the converged premium model (QRCode Monkey body/eye/eyeBall; Uniqode Eyes tab; Hovercode pattern+eye_style)                                       | L      | lead                         |
| P0-4  | **Scannability engine encoded as product rules**: contrast (Uniqode 40% rule), inverted colors, logo size + EC policy (QRCG 30% EC quote), quiet zone at least 4 modules, data-length budgets; warnings on preview, blocking error on export | Competitors encode these as prose/help tips; the auto-design guardrail (Flowcode) and "always scan to test" (QR TIGER) prove users need enforcement. Our ScanWarning type already models it | M      | lead + studio-ui             |
| P0-5  | **QR Studio**: type picker grid, generic form renderer, live client render, design panel, templates gallery, export panel, save/edit                                                                                                         | Table stakes: every paid competitor ships a live customizer with templates/colors/frames/exports                                                                                            | L      | studio-ui (task-4)           |
| P0-6  | **Dynamic QR lifecycle v1**: editable destination, pause, expiry, tags, status, short-code redirect                                                                                                                                          | Uniqode/Flowcode/Bitly/QR TIGER all make editing the core dynamic promise; expiry/pause are the base lifecycle                                                                              | L      | backend-dev (task-3)         |
| P0-7  | **Analytics v1 dimensions**: total, unique, daily series, country/city, device/OS/browser, last scan, CSV                                                                                                                                    | Convergent market set (QRCG, Uniqode, Flowcode, QR TIGER, Scanova); our scan_events schema already carries every dimension                                                                  | M      | backend-dev + management-ui  |
| P0-8  | **Unique-scan definition documented publicly** (first scan per visitorHash per code lifetime; ipHash+visitorHash salted, no raw IP)                                                                                                          | Definitions are device/visitor-based industry-wide (QRCG/Uniqode/Flowcode/QR TIGER quotes) but nobody publishes the method; transparency is trust leverage in EU                            | S      | backend-dev                  |
| P0-9  | **Export matrix**: SVG + PNG (transparent) + JPEG + PDF, size presets 512/1024/2048/4096 + custom, filename conventions                                                                                                                      | PNG/SVG/PDF are universal (QRCode Monkey, Uniqode, QR TIGER, Adobe); transparent and vector are premium elsewhere, free here is a wedge                                                     | M      | lead (export.ts) + studio-ui |
| P0-10 | **Bulk operations + CSV export** on dashboard (delete/archive/pause/activate/duplicate; CSV)                                                                                                                                                 | Bulk creation/actions sold by Scanova, QR TIGER (3,000/batch), Hovercode Business, Uniqode; CSV export is expected                                                                          | M      | backend-dev + management-ui  |
| P0-11 | **Password protection** (scrypt hash, signed 30-min unlock cookie, throttle attempts)                                                                                                                                                        | QR TIGER/Scanova gate it behind paid tiers; shipping free is a direct answer to the market paywall                                                                                          | M      | backend-dev                  |
| P0-12 | **Per-QR analytics page** with range selector + charts + country/device lists                                                                                                                                                                | Uniqode/Flowcode/QR TIGER all present a per-code analytics view; without it "dynamic analytics" is a promise not a product                                                                  | L      | management-ui (task-5)       |
| P0-13 | **Branded expired/paused pages** with 410/404 semantics (not generic errors)                                                                                                                                                                 | QR TIGER ships an "expired" help path; QRCG shows scan-limit errors; branded pages are campaign-safety basics                                                                               | S      | backend-dev                  |

**P0 exit criteria (definition of done):** a signed-in user can create any of 16 types, style it
from templates or manually, see live warnings, export SVG/PNG/PDF, make it dynamic,
pause/expire/password it, see total/unique/time/country/device analytics, and bulk-manage codes.
Guest users can create and export without an account (matching QRCode Monkey/Adobe free behavior).

## 2. P1: exceed market parity where competitors are weak

| #     | Recommendation                                                                                                                                                                     | Why (evidence)                                                                                                                                                                       | Effort | Slice                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------- |
| P1-1  | **User-saved templates** (save current design as a named preset; gallery of own templates)                                                                                         | "Save as a template"/"Your Templates" at QR TIGER, template IDs in Hovercode API, saved templates at Uniqode/QRCG; table stakes we do not yet have                                   | M      | studio-ui + backend-dev (small table or JSON on user) |
| P1-2  | **Expand frames to about 10 styles** (border, rounded, banner-above/below, badge, pill, speech bubble, card, circular band, viewfinder) + cap label 15-24 chars + font size family | Leaders ship 10-16 frames (Hovercode API lists 16 slugs; QR TIGER frame text limit 15 chars); we have 4                                                                              | M      | lead (types) + studio-ui                              |
| P1-3  | **Gradient UX presets**: 8 compass directions + radial, "apply gradient to eyes" toggle, 2-3 stop cap                                                                              | QR TIGER exposes 6 directions; QRCode Monkey has gradientOnEyes. Raw angle input alone is behind market UX                                                                           | S      | studio-ui (+ lead if design field added)              |
| P1-4  | **Combined eye presets** ("Square/Rounded/Drop/Leaf") on top of split selectors                                                                                                    | Hovercode's entire eye UI is one 4-option radio; we have split only, slower for beginners                                                                                            | S      | studio-ui                                             |
| P1-5  | **Quiet-zone ("Margin") control + print-size calculator** (min cm at scan distance per EC/logo/frame)                                                                              | No captured product exposes quiet-zone control or a print-size calculator (only prose: QRCG "increase the minimum printing size"; Uniqode 40% contrast). Clear differentiator, cheap | M      | lead (guidance math) + studio-ui                      |
| P1-6  | **In-app scan test**: render preview and decode it with the bundled jsQR/BarcodeDetector to show "scans OK at this size"                                                           | QR TIGER: "Always scan to test that your QR code works"; QRCG: test before/after at published size. Automated test-scan closes the loop                                              | M      | lead + codec-dev (scanner) + studio-ui                |
| P1-7  | **API keys + /api/v1** create/read/update/delete + design JSON schema                                                                                                              | Hovercode sells API on Business; Uniqode Core+; Bitly v4. A documented design-as-API is our differentiator                                                                           | M      | backend-dev (stretch in task-3)                       |
| P1-8  | **Hour-of-day heatmap + referrer/UTM breakdown + raw-scan CSV**                                                                                                                    | Uniqode has hour-wise + watchlist; Scanova exports scan-level CSV/Excel; Flowcode exports CSV/PDF. Raw CSV is the analyst expectation                                                | M      | backend-dev + management-ui                           |
| P1-9  | **Password attempt throttling + unlock UX polish** (error states, rate-limit response)                                                                                             | Password features are premium market-wide; a weak implementation is worse than none                                                                                                  | S      | backend-dev                                           |
| P1-10 | **Design JSON import/export + version field usage** (design versioning, migration-friendly)                                                                                        | No competitor exposes a portable design format (only Hovercode template IDs / QRCode Monkey config). Our QrDesign is already serializable; exposing it is a category-first           | S      | lead + studio-ui                                      |
| P1-11 | **Per-OS/browser/device icons and percentages with graceful empty states** in dashboard                                                                                            | Uniqode/Flowcode/Scanova all show device/browser splits; polish matters for perceived quality                                                                                        | S      | management-ui                                         |
| P1-12 | **Link short-domain path** (/r/CODE vs /CODE) and collision/length policy                                                                                                          | Competitors use branded short URLs (QRCG "customize the short URL"; Hovercode/Bitly custom domains). Our short codes should be short, unambiguous, case-sensitive-safe               | S      | backend-dev                                           |

## 3. P2: differentiated bets, after core is verified

| #     | Recommendation                                                                                           | Why (evidence)                                                                                                                                | Effort | Slice                   |
| ----- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------- |
| P2-1  | **A/B destination split** (weighted variants bucketed by visitorHash) with variant column in scan_events | Market-thin: only Bitly dynamic routing (first-match rules) and Uniqode Smart Rules approximate A/B; a true weighted split is ahead           | L      | backend-dev             |
| P2-2  | **Conditional routing rules** (country, region, device, platform; first-match)                           | Mirrors Bitly's exact observed schema (ISO 3166-2 country/region, iOS/Android, Mobile/Tablet/Desktop); proven demand at the link-platform end | M      | backend-dev             |
| P2-3  | **Per-eye flip/rotate transforms** (QRCode Monkey erf/brf arrays)                                        | Shipped idea no other captured product has; pure SVG transform, must be decode-tested (task-6 matrix)                                         | M      | lead + verification     |
| P2-4  | **EPS/WebP export, CMYK-safe PDF**                                                                       | EPS is rare (QRCode Monkey/Uniqode/QR TIGER/Scanova only); print shops ask for it                                                             | M      | lead (export)           |
| P2-5  | **Scheduled email/weekly reports + webhooks**                                                            | Uniqode/Scanova/Bitly ship scheduled reports; self-hosters can wire webhooks instead                                                          | M      | backend-dev             |
| P2-6  | **Custom domains for short links**                                                                       | Hovercode Pro+, Scanova, QR TIGER, Bitly all sell it; brand trust feature                                                                     | M      | backend-dev             |
| P2-7  | **QR health monitor** (periodic decode check of stored designs, alert on degradation)                    | Scanova QR Health Center is the only real precedent; cheap for us since we have the renderer + jsQR                                           | M      | lead + backend-dev      |
| P2-8  | **Watchlist/alerts** (scan spike/zero-scan anomaly)                                                      | Uniqode Core+ watchlist, QR TIGER scan notifications                                                                                          | M      | backend-dev             |
| P2-9  | **Dark-mode-aware previews + print proof sheet (PDF with crop marks/size ruler)**                        | Print-safety gap across market; natural extension of the print-size calculator                                                                | M      | studio-ui + lead        |
| P2-10 | **i18n (FR/EN first) for UI + payload examples**                                                         | Yopem context is FR/EU; none of the US leaders localize payload specs (EPC is a natural FR/EU feature)                                        | M      | studio-ui/management-ui |

## 4. Competitive benchmark targets (how we will know we are competitive)

| Benchmark            | Market reference                                      | Yopem target                                               |
| -------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| Content types        | Uniqode 15+, Scanova 22+, QR TIGER 25+                | 16 structured + 4 dynamic wrappers (met by task-2)         |
| Module styles        | Hovercode 6, QRCG 6, QRCode Monkey about 10           | 10 (already in types.ts)                                   |
| Eye controls         | Split at QRCode Monkey/Uniqode; combined at Hovercode | Split + combined presets (P1-4)                            |
| Frames               | Hovercode 16 slugs; QR TIGER many + CTA               | 10 styles + label cap (P1-2)                               |
| Templates            | Hovercode 13 presets; QR TIGER save-your-own          | at least 18 presets + user-saved (P0-5, P1-1)              |
| Export               | PNG/SVG/PDF universal; EPS rare                       | SVG/PNG/JPEG/PDF + transparency; EPS P2                    |
| Analytics dimensions | 8-dimension convergent set                            | 8 dimensions + raw CSV (P0-7, P1-8)                        |
| Unique definition    | device/visitor hash, unpublished                      | published + salted hashes (P0-8)                           |
| Dynamic lifecycle    | edit/pause/expire/password/routing                    | edit/pause/expire/password P0; routing P2                  |
| Free tier            | static free everywhere; dynamic paid                  | free dynamic (self-host) + free analytics (differentiator) |

## 5. Risks and how this research is bounded

1. **Bundle strings**: direct JS bundle downloads were blocked by the fetch toolchain
   (application/javascript MIME plus proxy failures). We substituted inline client-shipped JSON (QR
   TIGER i18n, Hovercode generator config) and public API docs. Full option enums for
   QRCG/Uniqode/QR TIGER pattern sets remain unverified; do not overfit style names from this
   dossier.
2. **Pricing is a 2026-10-25 snapshot**; several pages render prices client-side (Bitly, Flowcode,
   part of QR TIGER) and are marked not captured. Treat paid-tier claims as directional, not
   contractual.
3. **Client-rendered docs** (Scanova docs content, Canva/QR.io help) yielded page titles and
   structure but not body text in some cases; those claims are marked observed-partial.
4. **No competitor lets us observe their redirect/analytics backend**, so unique-scan behavior is
   inferred from their help-center definitions (quoted in analytics-dynamic.md section 2).
5. **Decode reliability is not captured**: no competitor publishes pass/fail matrices. Task-6's
   rendered design verification is our own evidence source and should gate design defaults
   (especially logos, frames and per-eye transforms).

## 6. What we deliberately skip (and why)

- **Landing-page / link-in-bio / form builders** (Uniqode Linkpage, Flowcode Flowpage, Scanova Page
  Builder, QR TIGER Multi URL): a separate product surface with its own editor, hosting and
  compliance burden; no leverage on our QR engine. We can link to external landing pages instead.
- **AI-generated QR art** (Scanova AI design beta): generative-image dependency plus high
  scanability risk; conflicts with our evidence-first "codes must decode" stance.
- **GS1 Digital Link / 2D barcodes** (Bitly, QR TIGER, Scanova, Hovercode): regulated packaging
  domain with GTIN validation, a different data model and buyer. P3 at the earliest.
- **GPS-level tracking** (Uniqode, Scanova, QR TIGER, Hovercode): needs a browser consent flow on
  every redirect and carries privacy risk; IP-based country/city covers the marketing use case.
- **Age restriction** (Scanova): niche compliance feature with no demand signal in the captured set.
- **Retargeting pixels / advertising integrations** (Uniqode Core+, QR TIGER): marketing-tracking
  surface that users of an open-source tool generally do not want by default; can be a plugin later.
- **Teams/SSO/SAML/SCIM/audit logs** (enterprise SaaS mechanics sold by Uniqode, Bitly, QR TIGER,
  Hovercode): not product-learning leverage for this rebuild; revisit if Yopem targets agencies.
- **Custom domains, scheduled reports, watchlists** are deferred to P2 rather than skipped forever:
  they are proven paid features but not required for a competitive core.

## 7. Slice-level handoff summary

| Slice (task)           | Must-read dossier section           | Highest-value actions                                                                                |
| ---------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| codec-dev (task-2)     | content-types.md sections 3-5       | exact payload templates + escaping vectors + EPC/WiFi/vCard validation; parser discrimination order  |
| backend-dev (task-3)   | analytics-dynamic.md sections 2-8   | unique definition, dimensions, lifecycle semantics (410/404), password flow, API field naming        |
| studio-ui (task-4)     | design-taxonomy.md sections 2-10    | design panel ordering, preset/eye/gradient UX, frame label caps, warnings-on-export, print-size calc |
| management-ui (task-5) | analytics-dynamic.md sections 1,3,7 | analytics dimensions/charts, range selector, CSV, empty states, per-QR page                          |
| lead (engine)          | design-taxonomy.md sections 3-9     | logo-to-EC policy, quiet zone, frame expansion, combined eye presets, design JSON as API             |
| verification (task-6)  | design-taxonomy.md sections 3,6,9   | test matrix for per-eye transforms, logo sizes, frames, inverted/contrast cases                      |

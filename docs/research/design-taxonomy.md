# Design taxonomy: observed QR customization systems

Research date: **2026-10-25**. Companion to competitor-matrix.md. This document covers the visual
design surface only: dot/module styles, eye (finder-pattern) frame + ball styles, gradients, colors,
logo handling, frames/templates, export formats/sizes, quiet zone, error correction, inverted
colors, and scannability guardrails. Exact product terminology is preserved; quoted strings are
verbatim.

**Notation.** [O] = observed in a shipped artifact (URL given). [I] = inferred from observed
evidence or standard QR behavior. "Shipped JSON" = a literal string found in client-shipped JSON
inside an HTML page.

**Bundle-access caveat.** The fetch tool rejects application/javascript responses, and public CORS
proxies returned 401/522, so direct bundle downloads were impossible for this run. Two products ship
their configuration dictionaries as inline JSON/Next.js flight data inside HTML, which is still
client-shipped artifact data: **QR TIGER** (i18n dictionary inside the rendered 404 page at
https://www.qrcode-tiger.com/qr-code-design) and **Hovercode** (generator field/template JSON inline
at https://hovercode.com/qr-code-generator-with-logo/). Those quotes are marked "shipped JSON". API
docs (QRCode Monkey, Hovercode, Bitly) are public shipped documentation and are quoted as such.

## 1. Terminology concordance

| Concept (Yopem QrDesign) | QRCode Monkey                                    | Hovercode                                          | QR TIGER                                                                                | Uniqode                                                  | Scanova                            | QRCG by Bitly                                | Bitly                              | Flowcode                       |
| ------------------------ | ------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------- | -------------------------------------------- | ---------------------------------- | ------------------------------ |
| Dark module shape        | `body` (body type id)                            | `pattern`                                          | "Pattern"                                                                               | "pattern shapes"                                         | "data patterns"                    | "six different pixel styles"                 | `render_customizations` shapes [I] | "pattern for your data points" |
| Finder outer ring        | `eye` ("eye frame")                              | part of `eye_style`                                | "Eyes"                                                                                  | Eye-frame shape                                          | "eye patterns"                     | "positioning detection markers or 'edges'"   | shapes [I]                         | "shape"                        |
| Finder inner 3x3         | `eyeBall`                                        | part of `eye_style`                                | "Eyes"                                                                                  | Eye-ball shape                                           | "eye patterns"                     | "positioning detection markers or 'edges'"   | shapes [I]                         | "shape"                        |
| Foreground fill          | `bodyColor`, `gradientColor1/2`                  | `primary_color`                                    | "Colors"                                                                                | "pattern color"                                          | "data colors"                      | "fore- and background colors"                | colors                             | "color"                        |
| Background fill          | `bgColor` + transparent endpoint                 | `background_color` (default transparent)           | "Background": Solid Color / Gradient / Image + Transparent background                   | solid color / image / transparent                        | background color / transparent     | fore-/background colors + transparent option | colors                             | "color"                        |
| Eye color overrides      | `eye1Color` to `eyeBall3Color`, `gradientOnEyes` | `eye_color_outer`                                  | "Eye color", "Custom Eye Color"                                                         | Eyes tab colors                                          | eye colors                         | "shape and color of ... 'edges'"             | colors [I]                         | [I] limited                    |
| Logo                     | `logo` + `logoMode:"clean"` + upload endpoint    | `logo_url`, `logo_round`, logo background checkbox | "Logo" ("pattern will automatically follow the color of your logo"), logo 300x300 72dpi | Logo tab: gallery/upload, size slider, remove background | "Add a logo or text"; logo gallery | ready-made or uploaded logo                  | logo                               | center logo/image              |
| Frame                    | -                                                | `frame` (16 slugs) + `has_border` + `text`         | "Frame" incl CTA "Scan Me!"                                                             | frames + CTA text + circular frame                       | "QR Code Frames"                   | "ready-made frame + color + text"            | -                                  | CTA/scan education around code |
| Template preset          | -                                                | `template` id                                      | "Templates", "Save as a template", "Your Templates"                                     | prebuilt + saved templates                               | "Themes"                           | "Save as a template"                         | -                                  | "themes"                       |
| Print/export size        | `size` (min px, default 300)                     | `size` default 220 px                              | dynamic plans: resolution slider                                                        | download formats incl EPS                                | "High-resolution QR Codes"         | format choice at download                    | plan-dependent file types          | [I] image export               |
| Quiet zone               | - (blank bg padding)                             | - (frame/padding implicit)                         | -                                                                                       | -                                                        | -                                  | -                                            | -                                  | -                              |
| Error correction         | not an API config field                          | not in API docs                                    | QR health features                                                                      | -                                                        | QR Health Center                   | "high error correction" 30% toggle           | -                                  | auto-design error-rate guard   |

No product exposed an explicit "quiet zone" control in captured artifacts [O across all captured UI
copy/API docs]. Quiet zone is implicit padding only. This is an open differentiator (see `9).

## 2. Module / dot styles (observed catalogues)

| Product       | Mechanism                                          | Observed style names                                                                                                                                                         | Evidence                                                                                                               |
| ------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| QRCode Monkey | `body` string id; API example defaults to "square" | "square" (default), "circle", "rounded-pointed" (shipped example); docs render a placeholder for the full list client-side                                                   | [API docs](https://www.qrcode-monkey.com/qr-code-api-with-logo/) [O]                                                   |
| Hovercode     | `pattern` radio in generator JSON                  | radio choices: **Squares, Original, Diamonds, Circles, Triangles, Lines**; "Original" is default; API doc lists Original, Circles, Squares, Diamonds, Triangles (no "Lines") | shipped JSON / [API docs](https://hovercode.com/api/) [O]                                                              |
| QR TIGER      | "Pattern"                                          | no enumeration captured; shipped warning string: "Please note: If you select this pattern, some older Android cameras may..."                                                | shipped JSON @ [qrcode-tiger.com/qr-code-design](https://www.qrcode-tiger.com/qr-code-design) [O]                      |
| QRCG by Bitly | pixel style picker                                 | "choose from **six different pixel styles**" (names not published)                                                                                                           | [design article](https://support.qr-code-generator.com/hc/en-us/articles/7665787780109-How-do-I-design-my-QR-Code) [O] |
| Uniqode       | pattern shapes                                     | "Uniqode offers multiple pattern shapes to choose from" (names not published)                                                                                                | [design article](https://docs.uniqode.com/en/articles/3313766-how-to-design-custom-qr-codes) [O]                       |
| Scanova       | data patterns                                      | "customizing the colors, shapes, eye patterns, logo, data patterns" + "30+ shapes" that change the code outline                                                              | [design feature page](https://scanova.io/features/qr-code-design/) [O]                                                 |
| Flowcode      | pattern for data points                            | "Choose a pattern for your data points (the dots within the code)" (names not published)                                                                                     | [design help](https://help.flowcode.com/en/articles/6927429-how-to-customize-a-flowcode-s-design) [O]                  |
| Bitly         | API shapes                                         | "There are multiple shapes for the diff..." (capture truncated); `render_customizations` object                                                                              | [QR API tutorial](https://dev.bitly.net/docs/tutorials/generate-qr-codes/) [O]                                         |
| Adobe Express | -                                                  | no module-level shape control observed                                                                                                                                       | [page](https://www.adobe.com/express/feature/image/qr-code-generator) [O]                                              |

**Market norm:** 4-6 module shapes, usually
"Original/Squares/Circles/Diamonds/Triangles/Lines"-class. **Yopem current:** 10
(`square, rounded, dots, diamond, star, cross, leaf, classy, hexagon, squircle`). Already above
market breadth; the practical risk is scanability at print size, not feature count. Mapping
suggestion: square to Squares/Original, rounded to a rounded-square shape, dots to Circles, diamond
to Diamonds; star/cross/hexagon/squircle/leaf/classy have no direct competitor equivalent (QRCode
Monkey's wider body set is the closest but names were not obtainable this run) [I]. Position novelty
behind a "Playful" template category rather than the default picker order.

## 3. Eye (finder pattern) systems

### 3.1 Split vs combined control

- **Split frame + ball**: QRCode Monkey (`eye` + `eyeBall`), Uniqode (Eyes tab: "Eye-ball color and
  shape" then "Eye-frame color and shape"), Yopem `eyeFrameStyle` + `eyeBallStyle`.
- **Combined single "eye style"**: Hovercode (one `eye_style` radio: **Square, Rounded, Drop,
  Leaf**), QR TIGER "Eyes" (single control), Flowcode "shape". Split gives more expressive range;
  combined is faster. Yopem already chose split, matching the premium end (QRCode Monkey/Uniqode).
  The studio should offer a "quick styles" row (combined presets) plus advanced split selectors [I].

### 3.2 Observed style names

| Product              | Frame styles                                                                                                                                                                               | Ball styles                               | Evidence                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| QRCode Monkey        | IDs `frame0` (default), `frame14` (example); full list client-rendered                                                                                                                     | IDs `ball0` (default), `ball16` (example) | [API docs](https://www.qrcode-monkey.com/qr-code-api-with-logo/) [O]                                                   |
| QRCode Monkey extras | per-eye mirror/rotate arrays `erf1/erf2/erf3` (eye frames) and `brf1/brf2/brf3` (eye balls) accepting "fv" (flip vertical) and "fh" (flip horizontal); e.g. `"erf2":["fh"], "erf3":["fv"]` | same                                      | [API docs](https://www.qrcode-monkey.com/qr-code-api-with-logo/) [O]                                                   |
| Hovercode            | combined: Square, Rounded, Drop, Leaf                                                                                                                                                      | same control                              | shipped JSON                                                                                                           |
| Uniqode              | "Select a frame shape from the available styles" (names not published)                                                                                                                     | "Choose from the available shape options" | [design article](https://docs.uniqode.com/en/articles/3313766-how-to-design-custom-qr-codes) [O]                       |
| QRCG                 | shape+color of "positioning detection markers or 'edges'"                                                                                                                                  | same control                              | [design article](https://support.qr-code-generator.com/hc/en-us/articles/7665787780109-How-do-I-design-my-QR-Code) [O] |
| QR TIGER             | "Eyes" tab / "Custom Eye Color"                                                                                                                                                            | same control                              | shipped JSON                                                                                                           |
| Yopem                | 6: square, rounded, circle, leaf, octagon, dots                                                                                                                                            | 5: square, rounded, dots, diamond, leaf   | repo `src/lib/qr/types.ts`                                                                                             |

**QRCode Monkey's per-eye flip/rotate arrays are a genuinely differentiating idea**: designing a
code whose three finder patterns are individually mirrored/rotated lets authors make non-symmetric
ornaments without breaking decode (finder patterns are rotationally tolerant). Yopem could add
per-eye transforms (P2): cheap in SVG, no matrix change, but must be tested against decoders.

**Opaque numeric IDs vs semantic names:** QRCode Monkey ships `frame0`/`ball16`; Hovercode ships
semantic names. Yopem already uses semantic names, which is better for API stability and docs. Keep
them and never renumber.

## 4. Gradients

| Product       | Gradient model                                                                                                                              | Exact strings / fields                                                                                                                                                                                                                                                                  | Evidence                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| QRCode Monkey | Two-color gradient on body; type linear/radial; optional gradient on eyes                                                                   | `gradientColor1` (default null), `gradientColor2` (default null), `gradientType` default "linear" ("Value can be \\"linear\\" or \\"radial\\""), `gradientOnEyes` default false ("Disable individual colors for the eye elements and set the gradient color for the complete QR code.") | [API docs](https://www.qrcode-monkey.com/qr-code-api-with-logo/) [O]                                  |
| QR TIGER      | Two-color gradient with 6 direction options + Radial                                                                                        | shipped JSON: "singleColor":"Solid Color", "colorGradient":"Gradient", "gradientType":"Gradient Type", "leftRight":"Left - Right", "topBottom":"Top - Bottom", "bottomTop":"Bottom - Top", "NWSE":"NW - SE", "SWNE":"SW - NE", "radial":"Radial"                                        | shipped JSON @ [qrcode-tiger.com/qr-code-design](https://www.qrcode-tiger.com/qr-code-design) [O]     |
| Uniqode       | "use a color gradient" (help subtitle); gradient editor not itemized                                                                        | -                                                                                                                                                                                                                                                                                       | [design article](https://docs.uniqode.com/en/articles/3313766-how-to-design-custom-qr-codes) [O]      |
| Scanova       | data patterns + image + frame colors; "Gradient" not in captured copy                                                                       | -                                                                                                                                                                                                                                                                                       | [feature page](https://scanova.io/features/qr-code-design/) [O]                                       |
| Flowcode      | "add in a HEX color (Pro+)" — solid colors; no gradient observed                                                                            | -                                                                                                                                                                                                                                                                                       | [design help](https://help.flowcode.com/en/articles/6927429-how-to-customize-a-flowcode-s-design) [O] |
| Hovercode     | no gradient in API docs/generator JSON; solid colors only                                                                                   | -                                                                                                                                                                                                                                                                                       | [API docs](https://hovercode.com/api/) [O]                                                            |
| Yopem         | `QrFill`: solid or gradient; linear with `angle` degrees + `stops[]`; radial with `stops[]`; separate `eyeFrameColor`/`eyeBallColor` solids | repo                                                                                                                                                                                                                                                                                    |

**Observations.** (1) The market settles on a **2-stop gradient**; QR TIGER exposes 6 direction
presets including diagonals; QRCode Monkey uses type only (linear/radial) and no explicit angle in
docs. (2) `gradientOnEyes` is an important toggle: eyes either follow the body gradient or keep
solid overrides. Yopem's null eye colors already give "inherit" semantics; add a design-level "apply
gradient to eyes" convenience in the studio (P1, no schema change: set eye colors to null). (3)
Multi-stop gradients are richer than market but increase scan risk on finder patterns; keep
gradients on modules only by default. (4) Direction presets beat a raw angle input for usability:
add 8 compass presets that write `angle` (P1 UI sugar).

## 5. Colors, contrast, inversion

- **Foreground/background**: universal (QRCG "fore- and background colors"; Hovercode
  `primary_color` default #111111, `background_color` default transparent; QR TIGER "Background":
  Solid Color / Gradient / Image / Transparent background; Uniqode solid/image/transparent; Scanova
  transparent; QRCode Monkey `bodyColor` default #000000, `bgColor` default #ffffff).
- **Eye color overrides**: QRCode Monkey per-eye (eye1Color to eyeBall3Color), QR TIGER "Eye
  color" + "Custom Eye Color", Hovercode "Eye color", Uniqode Eyes tab.
- **Contrast guidance is published as a rule by the strongest players**:
  - Uniqode: "Maintain a contrast ratio of at least 40%. This means the QR Code should be at least
    40% darker than the background." + "Always scan your QR Code on a mobile device after
    customization." [O]
  - QRCode Monkey API docs: "the background should always have a lighter color to be scanable with
    all devices." [O]
  - QRCG: "It's important to test your QR Code both before and after publishing, and at the size it
    will be published to make sure it is readable." [O]
- **Inverted colors (light modules on dark background)**: **no product in the captured set ships an
  "inverted/negative" design mode** [O]. All captured guidance points the same way (dark code on
  light background). Most phone scanners do not decode inverted codes reliably; ISO/IEC 18004
  defines dark modules on a light background as the normal polarity [I]. Yopem already models this
  as warning `inverted-colors`: keep it a warning visible at export, and consider a one-click "add a
  light plate" fix (P2).
- **Per-element color explosion is risky**: Bitly's API notes "You can specify the color of almost
  any element of the QR Code" — powerful but correlated with broken scans; Yopem's warning engine
  should evaluate final rendered contrast per region (eyes vs modules), not just per input [I].

## 6. Logo handling (and error-correction coupling)

| Product       | Upload rules                                                                                                                                                                                                | Placement/cleanup                                                                                                                                                  | Stated guidance                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| QRCode Monkey | logo = filename from upload endpoint; upload allows **PNG, JPG, SVG**; or image URL                                                                                                                         | `logoMode`: "default" or "clean" ("Set this value to \\"clean\\" to remove the background behind the integrated logo"); transparent-image endpoint for compositing | -                                                                      |
| QRCG by Bitly | "We recommend uploading a square or circular image with a width of at least **400px** in **PNG or JPG** format"; "Our software automatically detects the best and largest size possible for uploaded logos" | automatic sizing; help articles "Can I adjust the size of my logo inside the QR Code?" and "My logo shows up in the wrong colors. How do I fix it?"                | test before/after at published size                                    |
| QR TIGER      | shipped JSON: "logoFormat":"300 x 300 px, 72dpi"; "uploadImage":"Upload"; "removeLogo":"Remove logo"; "noLogo":"No logo"; "logoCodeGuide2":"Always scan to test that your QR code works"                    | "the QR code's pattern will automatically follow the color of your logo"                                                                                           | always scan to test                                                    |
| Uniqode       | Logo tab: built-in gallery or own upload; adjust with a slider; "Optionally, remove the background behind the logo"                                                                                         | "Keep the logo size moderate to avoid interfering with scan performance."                                                                                          | -                                                                      |
| Hovercode     | "Square or circle png/jpeg, max size 1Mb"; `logo_round` forces circle; logo background checkbox                                                                                                             | templates include `logo_background`, `logo_round`                                                                                                                  | -                                                                      |
| Bitly         | help article "Best practices for Bitly Code logos"; default logo setting                                                                                                                                    | [I] placement via render_customizations                                                                                                                            | -                                                                      |
| Scanova       | "Add a logo or text. You can upload a logo or choose one from the gallery."                                                                                                                                 | [I] size controls implied by design UI                                                                                                                             | QR Health Center                                                       |
| Flowcode      | upload center logo/image                                                                                                                                                                                    | CTA/scan education can surround the code                                                                                                                           | auto-design blocks risky combos                                        |
| Yopem         | data-URL logo, `size` 0.10-0.35 of content width, `padding`, `radius`, `backgroundColor`, `clearModules`                                                                                                    | -                                                                                                                                                                  | warnings: logo-too-large, logo-without-error-correction, external-logo |

**Error-correction coupling (the important part).**

- QR error correction levels L/M/Q/H recover roughly 7/15/25/30% damage; QRCG exposes this directly
  as "high-error correction ... sets the error tolerance at the **maximum of 30%**" and warns "using
  high error correction raises the density of the QR Code, and you'll need to increase the minimum
  printing size" [O,
  [EC article](https://support.qr-code-generator.com/hc/en-us/articles/7665789367565-What-is-high-error-correction-and-how-do-I-select-it)].
- Market behavior implies logo + EC H/Q pairing: QRCode Monkey's `logoMode:"clean"` and Uniqode's
  "remove background behind logo" exist so the cleared-module area behaves like intentional damage,
  and Uniqode explicitly cautions on size. No captured product _forces_ EC=H when a logo is present;
  they rely on guidance + testing [O].
- DENSO WAVE's own error-correction page documents the recovery percentages
  ([qrcode.com](https://www.qrcode.com/en/about/error_correction.html)) [O].
- **Yopem should encode the policy, not just warn**: when a logo is added and EC < Q, auto-bump to H
  (or show a blocking "error" with one-click fix). A centered logo covering 10-20% of the symbol
  plus a branding frame can eat the whole recovery budget at EC M. Keep `clearModules` default true
  and cap logo size at 0.25-0.30.

## 7. Frames and templates

### 7.1 Frame systems

| Product   | Frame model                                                                                                                                                                                                                                                                                                         | Text/CTA capability                                                                                                          | Evidence                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Hovercode | `frame` slug; API lists **border, border-small, border-large, square, speech-bubble, speech-bubble-above, card, card-above, text-frame, round-frame, circle-viewfinder, solid-spin, burst, scattered-lines, polkadot, swirl**; `has_border` toggle; generator JSON has a hidden `frame` field, 13+ template presets | `text` top + `text_secondary` "Bottom text"; per-frame `can_have_text`, `text_max_length` 16 or 24, `default_text` "SCAN ME" | [API docs](https://hovercode.com/api/), shipped JSON                                                        |
| QR TIGER  | "Frame" with many styles incl circular; CTA "Scan Me!"                                                                                                                                                                                                                                                              | "frameText":"Frame text (limited to 15 characters)", "frameTextFont":"Frame text font"                                       | shipped JSON                                                                                                |
| QRCG      | ready-made frames; frame color + text customizable                                                                                                                                                                                                                                                                  | "Can I use custom text on my QR Code frame?" help article                                                                    | [frame article](https://support.qr-code-generator.com/hc/en-us/articles/7665829340813-How-do-I-add-a-Frame) |
| Uniqode   | multiple frame styles incl circular                                                                                                                                                                                                                                                                                 | "Edit the CTA text using the frame text option"; circular frame converts to circular QR                                      | [design article](https://docs.uniqode.com/en/articles/3313766-how-to-design-custom-qr-codes)                |
| Flowcode  | CTA or "scan education" around/inside the code                                                                                                                                                                                                                                                                      | custom CTA text                                                                                                              | [design help](https://help.flowcode.com/en/articles/6927429-how-to-customize-a-flowcode-s-design)           |
| Scanova   | separate "QR Code Frames" feature + shapes                                                                                                                                                                                                                                                                          | frames are "separate controls" from shapes                                                                                   | [feature page](https://scanova.io/features/qr-code-design/)                                                 |
| QR.io     | frames (blog)                                                                                                                                                                                                                                                                                                       | [I]                                                                                                                          | [QR frame blog](https://qr.io/blog/qr-code-frame/)                                                          |
| Yopem     | 4 styles: none, rounded, banner, badge                                                                                                                                                                                                                                                                              | `label`, `labelColor`, `frameColor`, `backgroundColor`, `fontSize` 0.04-0.12                                                 | repo                                                                                                        |

**Market observation:** category leaders ship **10-16 frame variants** bound to templates; Yopem's 4
styles are functional but visually behind. Recommended P1: expand to ~10 frame styles (border,
rounded, banner-below, banner-above, badge, speech bubble, card, pill label, circular band,
viewfinder) and cap label length at ~15-24 chars to match QR TIGER/Hovercode; expose `fontSize`
(already in schema) and a small font choice (P2).

### 7.2 Templates

| Product   | Presets                                                                                                                                                                                                                                          | User-saved templates                   | Evidence                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Hovercode | 13+ named presets in shipped JSON: "Original", "Square with border and circle pattern", "Circle band", "Card", "Card 3D", "Bubble", "Pill label", "Scattered-lines", "Round frame", "Circle viewfinder", "Circle-pattern", "Burst", "Solid spin" | yes: template IDs via API (`template`) | shipped JSON, [API docs](https://hovercode.com/api/)                                                                                     |
| QR TIGER  | "Templates" + "Save as a template" box; "Your Templates" section                                                                                                                                                                                 | yes                                    | [design help](https://qrtiger.helpscoutdocs.com/article/68-customize-qr-code-design)                                                     |
| QRCG      | "save my QR Code design as a template" help article; "Can I edit the QR Code template?"                                                                                                                                                          | yes                                    | [template article](https://support.qr-code-generator.com/hc/en-us/articles/7665749135373-How-can-I-save-my-QR-Code-design-as-a-template) |
| Uniqode   | "several pre-built templates" + saved templates                                                                                                                                                                                                  | yes                                    | [design article](https://docs.uniqode.com/en/articles/3313766-how-to-design-custom-qr-codes)                                             |
| Scanova   | "Themes" (page builder) + design templates                                                                                                                                                                                                       | yes                                    | docs sidebar: "Themes"                                                                                                                   |
| Flowcode  | "themes"                                                                                                                                                                                                                                         | [I]                                    | [design help](https://help.flowcode.com/en/articles/6927429-how-to-customize-a-flowcode-s-design)                                        |
| Yopem     | templates.ts with >=18 presets in 7 categories (classic, brand, playful, elegant, dark, gradient, print): studio slice                                                                                                                           | not yet                                | repo                                                                                                                                     |

Market-validated pattern: **presets are grouped and named**, and users can save their own. Yopem's
18 presets + categories exceed observed per-product preset counts; the missing piece is user-saved
templates (P1, store design JSON per user or reuse qr_styles.design).

## 8. Export formats, sizes, and print safety

| Product       | Formats                                                                                                | Size control                            | Print guidance                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------ |
| QRCode Monkey | PNG, SVG, PDF, EPS; "eps (no support for color gradients)"; `size` = "minimum pixel size", default 300 | `size` number (returns >= requested px) | EC/print not exposed                                                                 |
| QRCG          | format selected at download; high-EC toggle                                                            | -                                       | test at published size; high EC raises density: "increase the minimum printing size" |
| QR TIGER      | PNG, SVG, PDF, EPS                                                                                     | resolution slider, dynamic codes only   | "Always scan to test"; logo 300x300 @72dpi                                           |
| Uniqode       | PNG, SVG, JPEG, EPS                                                                                    | -                                       | contrast >= 40% darker; always scan on mobile                                        |
| Scanova       | "High-resolution QR Codes", "Vector QR Codes", "Transparent QR Codes" feature pages                    | high-res                                | QR Health Center, "Test QR Code"                                                     |
| qr.io         | PNG, SVG                                                                                               | -                                       | -                                                                                    |
| Adobe Express | PNG, JPEG, PDF                                                                                         | -                                       | "QR codes never expire"                                                              |
| Hovercode     | API returns image; `size` default 220 px                                                               | size param                              | -                                                                                    |
| Yopem         | SVG, PNG (+ transparency), JPEG, PDF, WebP planned; presets 512/1024/2048/4096 + custom                | client-side rasterization               | warnings panel; quietZone 0-8; EC select                                             |

**Gaps worth exploiting:** (a) EPS remains rare (QRCode Monkey, Uniqode, QR TIGER, Scanova only);
(b) explicit **quiet-zone control** is absent everywhere; (c) **minimum print size** is prose-only
across the market: a print-size calculator ("this design at EC H with a 15% logo needs >= 2.8 cm at
30 cm scan distance") is cheap and differentiating; (d) transparent PNG is often premium (Scanova
lists it as an enterprise feature page): shipping it free is a wedge.

## 9. Quiet zone and error correction: what the shipped docs say

- Quiet zone is not configurable in any captured product; QRCode Monkey places padding on the canvas
  (transparent endpoint composites the QR into an image at x/y/size). Market default is the standard
  4-module margin [I, standard ISO/IEC 18004]. Yopem `quietZone` 0-8 modules with default 4 matches
  the standard; expose it in the studio ("Margin") with a "below 4 modules is not recommended"
  warning; the repo already has a `quiet-zone-small` warning.
- Error correction: QRCode Monkey/Uniqode/QR TIGER do not expose EC in captured docs; QRCG exposes
  only a "high" toggle (30%); Scanova's Health Center is the closest to automation. Yopem exposing
  L/M/Q/H with default M, plus a logo-driven auto-bump rule, exceeds the market [I].
- Scan warnings that competitors encode as prose should be encoded as data: low contrast (Uniqode
  40% rule), inverted colors (no product supports), logo too large/without EC (Uniqode/QR TIGER
  guidance), quiet zone too small (standard), transparent background (risk on dark surfaces),
  external logo (data-URL requirement for raster export), frame overlap (frames can cover modules;
  Uniqode's circular frames are the risky case).

## 10. Design paywall inventory

| Design capability       | Free at                                                                                      | Gated at                                                                              | Evidence                                     |
| ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| Colors + basic shape    | Hovercode free, QR TIGER free, QRCG static free, Adobe free                                  | Flowcode custom HEX on Pro+; Bitly colors plan-dependent                              | Hovercode/QR TIGER/Flowcode/Bitly pages      |
| Logo                    | Hovercode free, QR TIGER free (brand popup on scans)                                         | "your own logo and branding" listed as a paid benefit by QR TIGER                     | QR TIGER free article                        |
| Logo background removal | Uniqode customization available on all plans; QRCG tool                                      | -                                                                                     | Uniqode design article                       |
| Frames                  | [I] basic frames on free; "All design & customization options" listed under Pro at Hovercode | Hovercode Pro                                                                         | Hovercode pricing                            |
| Gradients               | Uniqode all plans; QR TIGER trial/paid; QRCode Monkey API paid                               | Flowcode has no gradient                                                              | QR TIGER feature lists                       |
| Save templates          | QRCG trial/paid, QR TIGER save-template, Uniqode templates all plans                         | -                                                                                     | help articles                                |
| Vector/SVG              | QR TIGER paid formats, Bitly file type plan-dependent                                        | Scanova lists vector as an enterprise feature page; Uniqode includes SVG on all plans | Scanova nav, Uniqode article, Bitly tutorial |
| Transparent/PNG         | QRCode Monkey free transparent endpoint                                                      | Scanova transparent = enterprise feature page                                         | QRCode Monkey API, Scanova nav               |
| High resolution         | QRCode Monkey size param free                                                                | QR TIGER resolution slider dynamic plans only                                         | design help                                  |
| Remove branding         | -                                                                                            | QR TIGER paid; Hovercode Pro                                                          | QR TIGER free article, Hovercode pricing     |

## 11. Exact quoted strings (provenance appendix)

All quotes below are verbatim from the cited artifact (client-shipped JSON or public docs).

QR TIGER: client-shipped i18n dictionary (Next.js flight data) in the HTML of
https://www.qrcode-tiger.com/qr-code-design (a 404 route that still ships the global dictionary):

- "pattern":"Pattern", "eyes":"Eyes", "logo":"Logo", "colors":"Colors", "frame":"Frame",
  "template":"Templates"
- "patternCustom":"You can customize these templates later to match your brand"
- "patternWarning":"Please note: If you select this pattern, some older Android cameras may"
  (captured truncated at the next JSON key)
- "singleColor":"Solid Color", "colorGradient":"Gradient", "backgroundImage":"Image"
- "gradientType":"Gradient Type", "leftRight":"Left - Right", "topBottom":"Top - Bottom",
  "bottomTop":"Bottom - Top", "NWSE":"NW - SE", "SWNE":"SW - NE", "radial":"Radial"
- "customEyeColor":"Custom Eye Color", "eyeColor":"Eye color", "transparentBackground":"Transparent
  background"
- "frameText":"Frame text (limited to 15 characters)", "frameTextFont":"Frame text font"
- "downloadSVG":"Download SVG", "downloadPNG":"Download PNG"
- "logoFormat":"300 x 300 px, 72dpi", "removeLogo":"Remove logo", "logoCodeGuide2":"Always scan to
  test that your QR code works"
- "needPaidToUseFeature":"You need a paid plan to use this feature.",
  "needPremiumToUseFeature":"This feature only works with a Premium account."
- "webApplicationFeature5":"QR code customization with logo, colors, patterns, eyes and frames"

Hovercode: inline generator JSON at https://hovercode.com/qr-code-generator-with-logo/:

- Field labels: "label": "Pattern color", "label": "Eye color", "label": "Frame color", "label":
  "Pattern", "label": "Eye style", "label": "Add a logo", "label": "Logo round", "label": "Logo
  background", "label": "Text", "label": "Bottom text", "label": "Border"
- "choices":
  [["Squares","Squares"],["Original","Original"],["Diamonds","Diamonds"],["Circles","Circles"],["Triangles","Triangles"],["Lines","Lines"]]
- "choices": [["Square","Square"],["Rounded","Rounded"],["Drop","Drop"],["Leaf","Leaf"]]
- color swatches: "#222222", "#059669", "#1d4ed8", "#4f46e5", "#7c3aed", "#ec4899", "#dc2626",
  "#f97316"; background swatches include "#FFFFFF", "#c9cbf2", "#f2bfc3", "#f7f6e1", "#da99e0",
  "#ccf2cb", "#83dcff"
- logo help: "Square or circle png/jpeg, max size 1Mb"
- template titles include "Original", "Square with border and circle pattern", "Circle band",
  "Card", "Card 3D", "Bubble", "Pill label", "Scattered-lines", "Round frame", "Circle viewfinder",
  "Circle-pattern", "Burst", "Solid spin"; frame objects carry "can_have_text", "text_max_length"
  (16/24), "default_text": "SCAN ME"
- API docs: pattern options "Original, Circles, Squares, Diamonds, Triangles"; eye_style "other
  options are: Rounded, Drop, and Leaf"; primary_color default "#111111"; size "Defaults to 220";
  frame slug list (see 7.1): https://hovercode.com/api/

QRCode Monkey: public API docs at https://www.qrcode-monkey.com/qr-code-api-with-logo/:

- body default "square"; eye default "frame0"; eyeBall default "ball0"
- "erf1" ... "brf3": "Rotate the upper left eye element. Add \\"fv\\" or \\"fh\\" to invert element
  vertically or horizontally."
- gradientType: "Value can be \\"linear\\" or \\"radial\\"."; gradientOnEyes default false
- logoMode: "Set this value to \\"clean\\" to remove the background behind the integrated logo."
- file: "png", "svg" (support all config options), "pdf", "eps" (no support for color gradients)
- Transparent QR endpoint /qr/transparent: image, size, x, y, crop, file, download.

QRCG by Bitly: Zendesk article bodies (API at support.qr-code-generator.com/api/v2/help_center):

- "choose from six different pixel styles"; "customize the shape and color of the positioning
  detection markers or 'edges'"
- "high-error correction rate ... sets the error tolerance at the maximum of 30%"; "using high error
  correction raises the density of the QR Code, and you'll need to increase the minimum printing
  size"
- logo: "We recommend uploading a square or circular image with a width of at least 400px in PNG or
  JPG format. Our system automatically..."

Uniqode: help center article at
https://docs.uniqode.com/en/articles/3313766-how-to-design-custom-qr-codes:

- "The 'eyes' are the three square markers at the corners of the QR Code."
- "Maintain a contrast ratio of at least 40%. This means the QR Code should be at least 40% darker
  than the background."
- "Keep the logo size moderate to avoid interfering with scan performance."
- "Convert your QR Code into a circular QR Code by selecting a circular frame."
- Downloads: "PNG, SVG, JPEG, or EPS formats."

Flowcode: help center article at
https://help.flowcode.com/en/articles/6927429-how-to-customize-a-flowcode-s-design:

- "Choose a pattern for your data points (the dots within the code)."
- "The design tool only allows for specific colors (instead of custom) and will not let you select
  certain color combinations, because they might have too high of an error rate."

Scanova: feature page at https://scanova.io/features/qr-code-design/:

- "customizing the colors, shapes, eye patterns, logo, data patterns, image, and more"
- "Scanova offers 30+ shapes ... a frame is a graphic that goes around your QR Code, a shape changes
  the code."
- "Adjust the QR Code weight" (AI-generated design, beta)

Bitly: API tutorial at https://dev.bitly.net/docs/tutorials/generate-qr-codes/:

- render_customizations: "Change the colors, shapes, add logos, and more. This object determines
  what the QR Code will look like."
- "You can specify the color of almost any element of the QR Code. There are multiple shapes for the
  diff..." (captured truncated)
- "QR Code colors and file type options may be available depending on your subscription plan."

## 12. Design decisions this suggests for Yopem QR

1. Keep the split dotStyle / eyeFrameStyle / eyeBallStyle model: it matches premium competitors.
2. Add **combined eye presets** ("Square", "Rounded", "Drop", "Leaf") that set both fields, for
   speed.
3. Add **gradient direction presets** (8 compass + radial) that write angle; keep 2-3 stops max.
4. Add an **"apply to eyes" toggle** for gradients (writes null eye colors / opt-in gradient on
   eyes).
5. Encode a **logo -> EC policy** (auto-suggest/require Q or H; cap logo size; clearModules default
   true).
6. Ship **quiet-zone control + print-size calculator** (market gap).
7. Expand frames to ~10 styles with CTA text capped ~15-24 chars; support label fonts later.
8. Ship user-saved templates (design JSON reuse), plus semantic, stable style ids (never renumber).
9. Surface all scanability rules as **live warnings** on the preview and **blocking errors** on
   export.
10. Consider per-eye flip/rotate transforms later (QRCode Monkey's erf/brf idea) as an advanced
    feature.

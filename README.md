# ThreadPass

**Live: https://lokegani.github.io/threadpass/**

Satellite + ground-sensor effluent compliance monitoring for MSME textile-dyeing
clusters. Two independent layers watch every enrolled unit, and only a finding
both layers agree on counts as a violation. Built by hand — no framework, no
build step, no dependencies.

---

## Start here

Three entry points, and only one of them needs an account:

| Page | Who it is for |
|---|---|
| [`/`](https://lokegani.github.io/threadpass/) | Anyone. Explains the product, the two layers and the Flagged/Watch rule. |
| [`/verify.html`](https://lokegani.github.io/threadpass/site/verify.html) | Buyers checking a certificate. **No account needed.** |
| [`/signin.html`](https://lokegani.github.io/threadpass/site/signin.html) | Monitors and textile units, for the dashboard. |

If you read one file, read **`site/assets/js/detect.js`**. Everything else is
presentation; that file is the actual method.

### Sign in

Every account uses the password `ThreadPass#2026`.

| Account | Sees |
|---|---|
| `monitor@threadpass.test` | The whole cluster, plus the Admin page |
| `tp.noyyal@threadpass.test` | Only Noyyal Textile Finishers — Certified, 1 Watch |
| `tp.velan@threadpass.test` | Only Velan Processing Mills — Flagged, certificate revoked |
| `er.bhavani@threadpass.test` | Only Bhavani Processing Unit — Flagged, under review |
| `kr.vasavi@threadpass.test` | Only Vasavi Fabric Processors — not yet eligible |

The full list is on the sign-in page under "Demonstration accounts" — click any
row there to fill the form.

The **verification page** at `/verify.html` needs no account at all. That is the
buyer-facing page a certificate's QR code points at. Because the site is served
from a real domain, the QR codes on issued certificates are genuinely scannable
with a phone.

---

## Running it locally

Not required — the live site above is the same build — but if you want it on
your own machine: clone the repo, then double-click **`start.cmd`**, or run

```
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

from the repository folder, and open **http://localhost:8000**. `Ctrl+C` stops
it. Port 8000 already in use? Add `-Port 8080` and open that instead.

**Requirements: none.** No Node, no Python, no npm install. The server is a
PowerShell script using the HTTP listener built into Windows, and the site is
plain HTML, CSS and JavaScript with no dependencies.

---

## What is where

```
  start.cmd              double-click to run locally
  serve.ps1              the local web server
  index.html             redirect so a root-published host lands on site/
  README.md              this file
  PROJECT-NOTES.md       the extracted spec and the longer-term build plan
  site\
    index.html           PUBLIC — the landing page, explains the product
    signin.html          sign in
    dashboard.html       cluster overview (Monitor) / redirect to own unit
    unit.html            one unit: status, charts, event log
    alerts.html          every Watch and Flagged event, filterable
    methodology.html     how a finding is produced, written out in full
    admin.html           Monitor only — revoke and reinstate certificates
    pending.html         a unit without enough history yet
    verify.html          PUBLIC — buyers verify a certificate ID
    report.html          printable 3-page buyer due-diligence report
    certificate.html     printable certificate with a scannable QR code
    favicon.svg
    tools\                development aid — safe to delete before deploying
      palette-check.html  checks the chart colours against the live stylesheet
      validate_palette.mjs
    assets\css\styles.css    the shared design system
    assets\css\landing.css   landing page only
    assets\js\
      data.js            units, scenarios, deterministic reading generation
      detect.js          THE PRODUCT — baseline, MAD, runs, dual-layer rule
      auth.js            session and role handling
      ui.js              header, footer, badges, formatting
      charts.js          hand-built SVG charts
      qr.js              hand-built QR encoder
```

---

## Making PDFs

Open a report or a certificate and press **Print / Save as PDF**. In the print
dialog choose "Save as PDF" as the destination. The page layout is already A4
with the on-screen navigation hidden, so what you get matches the documents you
generated previously.

---

## Two things to be honest about

**The sign-in is not real security.** The account list and the password are in
JavaScript the visitor has already downloaded, and the session is a
`localStorage` key anyone could set by hand. It exists to demonstrate the two
roles, not to protect anything. Real authentication needs a server: a password
hash the browser never sees, a session cookie it cannot forge, and the role
check performed before any data is sent. See the note at the top of `auth.js`.

**Every reading is simulated.** No satellite imagery is fetched and no sensor
exists. Unit names and UDYAM numbers are fictional. What is genuine is the
method — the 30-day median baseline, the MAD threshold, the sustained-run
requirement and the dual-layer correlation all run exactly as documented, on
generated data. Say this plainly when demonstrating it; the honesty is part of
the pitch, and the decks already make a point of it.

---

## Changing things

**Add or edit a unit** — `assets/js/data.js`, the `TP.UNITS` array. Each unit
has a baseline per channel, a noise level per channel, and an `excursions` list
that injects episodes. `amp` is measured in noise-sigma units, so `amp: 6.4`
lands at roughly 6.4 SD once detection scores it. Keep it comfortably above
`TP.THRESHOLD_SD` or noise will cancel the edge days of the run.

**Change the detection rules** — `assets/js/detect.js`, the three constants at
the top: `THRESHOLD_SD`, `MIN_RUN_DAYS`, `MIN_HISTORY`. Lower the threshold and
watch the Watch count climb; that is worth demonstrating live, because it shows
the trade-off is a deliberate choice rather than an accident.

**Change the monitoring window** — `TP.PERIOD` in `data.js`. It is currently
pinned to 31 Jul – 29 Aug 2026 so the app agrees with the certificate and report
PDFs already issued.

**Colours** — the CSS variables at the top of `assets/css/styles.css`. Chart
series colours are the `--series-*` variables; they come from a palette chosen
for colour-vision separation, so change them as a set rather than one at a time.

After changing any of them, open **http://localhost:8000/tools/palette-check.html**.
It reads the live CSS variables — not a copy of the hex values — and checks the
three sensor-channel colours for lightness band, chroma floor, colour-vision
separation, normal-vision separation and contrast, in light, dark and print.
It will tell you plainly if a change breaks one.

Two results there are expected and fine:

- **RELIEF on turbidity in light mode.** `#1baf7a` sits at 2.82:1 on white,
  under the 3:1 bar. The rule allows this when identity does not depend on the
  colour alone — and it does not here: every line is labelled at its end, listed
  in the legend, given its own dash pattern, and repeated in the data table.
- **NDTI is drawn in ink, not a colour.** It is the only series on its chart, so
  its hue carries no meaning; the title names it. Every fourth hue tried
  alongside the three sensor colours either failed colour-vision separation
  against the pH blue or fell outside the dark-mode lightness band, so ink is
  both the correct and the most legible answer.

---

## Deployment

Live at **https://lokegani.github.io/threadpass/**, published by GitHub Pages
from `main` at the repository root. The root `index.html` forwards to `site/`,
so nothing had to be restructured and there is no build step. Pushing to `main`
republishes.

The whole thing is static, so it moves to Netlify or Cloudflare Pages just as
easily by uploading the `site` folder.

The certificate QR encodes an absolute URL built from wherever the page is
served. Locally that is a `localhost` address a phone cannot reach; on the live
site it resolves to the public verification page, so the codes are scannable
with no code change.

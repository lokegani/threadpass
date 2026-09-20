# ThreadPass — manual rebuild notes

Reference document. Extracted from the two decks, the generated PDFs, and the
existing Lovable site. Keep this open while building.

---

## 1. What the product actually is

Two independent monitoring layers over an MSME textile-dyeing unit:

- **Layer 1 — Satellite.** NDTI (Normalised Difference Turbidity Index) computed
  from free Sentinel-2 imagery over the river stretch next to the unit.
  Wide-area, continuous, cannot be evaded by timing a discharge around an
  inspection.
- **Layer 2 — Ground sensor.** A low-cost node at the unit's own effluent outlet
  reading **pH, TDS, turbidity**. Cost ~Rs 7,000-17,400 deployed. Gives the one
  thing satellite cannot: a reading attributable to that specific unit.

**The core rule — this is the heart of the whole product:**

| Condition | Result |
|---|---|
| Satellite excursion AND sensor excursion overlap in the same window | **Flagged** (verified violation) |
| Only one layer shows an excursion | **Watch** (disclosed, non-blocking, NOT a violation) |
| Neither | Normal |

Framing: a **voluntary self-monitoring record** the unit shows to buyers, not a
policing tool. That framing is a deliberate design decision, not decoration.

---

## 2. Detection maths (implement exactly this)

- Each stream (NDTI, pH, TDS, turbidity) is scored **against its own 30-day median**.
- Threshold uses **MAD — median absolute deviation** (robust; a few wild values
  cannot drag the baseline like a mean/standard-deviation would).
- Only **sustained runs** count as an excursion — a single day's spike does not.
- Peak severity is reported in SD units, e.g. "peak 6.4 SD above baseline".
- For charting, each sensor channel is **indexed to its own 30-day median = 100**
  so pH, TDS and turbidity can share one Y axis.

---

## 3. Data model

**Unit**
- name, city, state, latitude, longitude
- process type (e.g. Mercerising; Bleaching & scouring)
- MSME UDYAM registration number (e.g. UDYAM-TN-19-0044530)
- status: `Certified` | `Flagged` | `Revoked` | `Not Yet Eligible`

**Reading** (one row per unit per day)
- date, ndti, ph, tds, turbidity

**Event**
- unit, severity (`Watch` | `Flagged`), start date, end date
- source (`Satellite + sensor` | `Satellite only` | `Sensor only`)
- description incl. peak SD per channel
- resolution text

**Certificate**
- id, e.g. `TP-TUP-260829-0IP4J0Z`
  (TP - cluster code TUP - YYMMDD - random suffix)
- unit, period start, period end, issue date, valid until (issue + 1 year)
- verified violation count, watch observation count
- revoked flag

**User**
- email, password hash, role (`MONITOR` | `UNIT`), linked unit (null for monitors)
- Accounts are **invitation-only**.

---

## 4. Roles

- **Monitor** — sees the whole cluster: every unit, all alerts, admin actions,
  can issue and revoke certificates.
- **Textile Unit** — sees only its own unit's report and certificate.
- **Buyer / public** — no account. Uses the public verification page only.

---

## 5. Routes to rebuild

| Route | Auth | Purpose |
|---|---|---|
| `/auth` | public | Sign in |
| `/` | authenticated | Dashboard (cluster view for Monitor, own unit for Unit) |
| `/alerts` | authenticated | Watch + Flagged event feed |
| `/methodology` | authenticated | How the detection works, stated plainly |
| `/admin` | Monitor only | Issue / revoke certificates, manage units |
| `/pending` | authenticated | Account awaiting unit assignment |
| `/verify/:certId` | **public** | Buyer scans QR, confirms certificate genuine + current |

Notes on `/verify/:certId`: it must work with no login, must reflect later
revocation, and must show a clear "Certificate not found" state for an
unknown ID.

---

## 6. Generated documents

**Certificate (1 page)** — unit name, location, lat-lon, process, UDYAM number,
monitoring period, the certifying paragraph, then a stat block: certificate ID,
period covered, issue date, valid until, verified violations, watch observations.
QR code linking to `/verify/:certId`. Disclaimer footer.

**Buyer due-diligence report (3 pages)**
1. Header stats (operational status, certification, flagged count, watch count),
   plain-English summary paragraph, status rationale.
2. NDTI chart, then the 3-channel sensor chart. Shaded bands mark excursions.
3. Event log — every Watch and Flagged event oldest first, each with its
   resolution — then a "How these findings are produced" methodology box.

---

## 7. Wording that must stay

Every generated document and the site footer carry a disclaimer. The existing
wording is:

> ThreadPass is a demonstration monitoring system operating on simulated
> satellite and ground-sensor data. This report is a due-diligence document,
> not a regulatory certification.

and

> ThreadPass - Demonstration build. All satellite and sensor readings are
> simulated; unit names and registration numbers are fictional.

Keep this. It is what makes the demo honest, and the decks make a point of the
project being honest about what is and is not proven.

---

## 8. What was built, and why this way

The original plan was Next.js + Prisma + SQLite. That was abandoned once the
machine turned out to have no Node **and** no working Python, and free space on
C: was too tight to add them comfortably. See section 9.

What exists instead is a **zero-dependency static build**: plain HTML, CSS and
vanilla JavaScript, served on localhost by a PowerShell script using the HTTP
listener built into Windows. Nothing was installed to make it run.

Done:

- [x] **Design system** — one stylesheet, CSS variables, light and dark themes
- [x] **Data layer** — 10 units, deterministic seeded readings, injected scenarios
- [x] **Detection engine** — 30-day median baseline, MAD threshold, sustained
      runs, dual-layer correlation. Reproduces the existing Velan and Noyyal
      PDFs exactly.
- [x] **Auth and roles** — Monitor vs Textile Unit, route protection *(browser-side
      only — a demo gate, not real security)*
- [x] **Dashboard, unit page, alerts, methodology, pending**
- [x] **Charts** — hand-built SVG, one axis, crosshair tooltip, data table,
      colour-vision-safe series palette, verified by running the checks against
      the live stylesheet at `site/tools/palette-check.html` in light, dark and
      print. The first attempt failed: the satellite series had been given a
      fourth hue (violet) that was nearly indistinguishable from the pH blue in
      dark mode — ΔE 1.9 under protanopia, 9.8 under normal vision, against a
      floor of 15. No fourth hue passed, so NDTI is now drawn in ink, which is
      correct anyway since it is the only series on its own chart and its title,
      not its colour, identifies it.
- [x] **Certificates** — issue state derived from data, Monitor override to
      revoke and reinstate
- [x] **Public verification page** — no account, reflects revocation, handles
      an unknown ID
- [x] **Printable documents** — 3-page buyer report and the certificate, both
      A4, via the browser's Save as PDF
- [x] **QR encoder** — written by hand, verified by decoding its own output with
      an independent decoder across versions 2, 4, 7 and 10

Still open:

- [ ] **Real authentication.** Needs a server. This is the one genuine gap
      between the demo and a product.
- [ ] **Deploy** to a real public URL. The QR only becomes truly scannable then,
      because it currently encodes a `localhost` address.
- [ ] **Port to Next.js + Prisma** if and when there is disk space. The detection
      engine and data model move across unchanged; only the serving layer and
      the auth change.

---

## 9. Machine facts (as of 17 Sep 2026)

- Node.js: **not installed**
- Python: **not installed** — `C:\Python314` was removed partway through setup;
  the `python3.14.exe` shim in the chocolatey bin folder is orphaned and fails
  with "No module named 'encodings'"
- VS Code: installed at `%LOCALAPPDATA%\Programs\Microsoft VS Code`
- winget: available
- PowerShell 5.1, and `[System.Net.HttpListener]::IsSupported` is true — which
  is what the local server relies on
- **C: has only ~2.3 GB free.** D: has ~336 GB. Everything for this project
  lives on D: by request.

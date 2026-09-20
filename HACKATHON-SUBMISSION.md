# ThreadPass — Hackathon Submission Answers

Copy each block into the matching form field.

**Live demo:** https://lokegani.github.io/threadpass/ ·
**Source:** https://github.com/lokegani/threadpass

Judge access — the verification page needs no account; every demo account uses the
password `ThreadPass#2026`. `monitor@threadpass.test` sees the whole cluster and the admin
page; `tp.velan@threadpass.test` is a Flagged unit with a revoked certificate;
`tp.noyyal@threadpass.test` is Certified with one Watch.

---

## Project Name

ThreadPass

---

## Project Description

ThreadPass is a dual-layer effluent compliance monitoring and certification platform for
MSME textile-dyeing units. It watches two independent signals over every enrolled unit and
only calls something a violation when both agree.

**Layer 1 — Satellite.** NDTI (Normalised Difference Turbidity Index) computed from free
Sentinel-2 imagery over the river stretch beside the unit. Wide-area and continuous, so it
cannot be evaded by timing a discharge around a scheduled inspection.

**Layer 2 — Ground sensor.** A low-cost node (~Rs 7,000–17,400 deployed) at the unit's own
effluent outlet reading pH, TDS and turbidity. This gives the one thing satellite cannot:
a reading attributable to that specific unit rather than to the river.

**The core rule:** a satellite excursion *and* a sensor excursion overlapping in the same
window is **Flagged** (a verified violation). One layer alone is **Watch** — disclosed on
the record, non-blocking, explicitly not a violation. Neither is Normal.

**The anti-evasion trapdoor.** Every ground reading is cryptographically signed at the
moment of capture, and a satellite anomaly automatically triggers a review of the sensor's
data window for that period. The obvious workaround — unplugging the sensor before
discharging — therefore fails: unexplained sensor downtime during a river anomaly is itself
flagged as a suspicious bypass event. Isolating one layer does not hide a discharge; it
becomes the evidence.

Every channel is scored against its own rolling 30-day median rather than a fixed legal
limit, with the spread measured by MAD (median absolute deviation) so a discharge episode
cannot inflate the threshold it needs to cross. Only sustained runs of 2+ consecutive days
count, so a cloud edge or a passing boat never becomes a finding.

On top of the engine the platform provides: a cluster dashboard for monitors, a per-unit
page with SVG charts and a full event log, a filterable Watch/Flagged alert feed, a written
methodology page, an admin console to issue, revoke and reinstate certificates, a printable
certificate carrying a scannable QR code, a printable 3-page buyer due-diligence report,
and a **public verification page** where any buyer can check a certificate ID with no
account — and which correctly reflects later revocation and unknown IDs.

Three roles: Monitor (whole cluster + admin), Textile Unit (its own record only), and
Buyer/public (verification page only).

---

## Problem Statement

India's textile-dyeing sector is dominated by MSME units in clusters like Tirupur and
Erode, and untreated dye effluent from these units is a primary cause of river pollution
in Tamil Nadu — the Noyyal and Bhavani systems being the well-known cases.

Enforcement today is inspection-based: a pollution control board officer visits a unit on a
known date. The failure is structural, not one of effort. Inspections are periodic, they
are announced or at least predictable, and a unit that wants to discharge simply waits for
the inspector to leave. A handful of officers cannot physically cover thousands of small
units, so the record of what any given unit actually did between visits does not exist.

This hurts three groups at once:

- **The river and the people downstream** bear the pollution that nobody recorded.
- **Compliant MSME units** get no credit for being compliant. A buyer cannot tell them
  apart from a polluting neighbour, so the investment in treating effluent properly earns
  nothing back and becomes a pure cost.
- **Global apparel buyers** now face supply-chain environmental due-diligence requirements
  (EU CSDDD, brand ESG commitments) and have no practical way to verify their Tier-2
  processing units. Their choices are to trust a self-declaration, or to pay for an audit
  that is, again, a single announced visit.

The missing thing is a **continuous, tamper-resistant, unit-attributable record** that is
cheap enough for an MSME to carry and credible enough for a buyer to act on.

---

## Your Solution

ThreadPass turns compliance from an event into a record, and reframes it from policing to
a **voluntary self-monitoring credential the unit shows to buyers**. That framing is a
deliberate design decision: a unit opts in because the certificate is commercially useful
to it, not because an inspector compelled it.

**Workflow**

1. **Enrol.** A unit is registered with its location, process type and UDYAM number. A
   low-cost sensor node goes on its effluent outlet. The satellite layer needs no hardware.
2. **Observe.** Daily readings accumulate on four channels: NDTI from imagery, plus pH,
   TDS and turbidity from the sensor.
3. **Baseline.** Each channel is scored against its *own* rolling 30-day median. Two units
   running different dye processes have genuinely different normal ranges; one fixed
   threshold would flag the wrong one. No verdict is issued at all until 30 days of paired
   history exist — a unit in that state shows as **Not Yet Eligible** rather than as clean.
4. **Detect.** Spread is measured with MAD (×1.4826), so the reported "peak 6.4 SD above
   baseline" stays meaningful while the statistic underneath cannot be dragged by the very
   outliers it is looking for. Only runs of 2+ consecutive days above 3.0 SD count.
   Direction matters: NDTI, TDS and turbidity are only excursions when they rise, while pH
   is scored in both directions because acidic and alkaline discharge are both events.
5. **Correlate.** Overlapping satellite + sensor excursion → **Flagged**. A single layer →
   **Watch**, disclosed but never a violation. This is what protects an honest unit from
   being condemned by an upstream neighbour's discharge showing up in the river.
6. **Certify.** A clean monitoring period issues a certificate (`TP-TUP-260829-0IP4J0Z`
   format) valid one year, carrying the verified-violation and watch-observation counts —
   not a pass/fail stamp, but a disclosed record.
7. **Verify.** The certificate's QR code points at a public page. A buyer scans it and sees
   the current state, including revocation that happened after the certificate was printed.
   No account, no login, no contacting ThreadPass.

**Key features:** cluster dashboard, per-unit charts and event log, filterable alert feed,
published methodology page, monitor-only admin for revoke/reinstate, printable A4
certificate and 3-page buyer report, hand-built QR encoder, public verification endpoint,
full light/dark theming, and a colour-vision-safe chart palette verified against the live
stylesheet in light, dark and print modes.

**Validation status.** The satellite layer is not a proposal: in Phase 0 the NDTI method was
reprocessed from historical public imagery and correlated against three years of real
Central Water Commission turbidity readings for the Noyyal basin, before any hardware spend.
The live demo linked above runs the full detection and certification pipeline on generated
readings with fictional unit names, and says so on every page — real sensor feeds and
server-side authentication arrive with the Phase 1 pilot.

**Deployment plan.** A 10-unit Phase 1 pilot across Tirupur and Karur is costed at
₹1.76L–₹3.89L — hardware, satellite pipeline extension, field surveys, six months of
operations and 10% contingency — with a 12-month path from procurement to an anchor-buyer
demonstration. Commercially the model is sequenced so the buyer pays first, not the MSME and
not the government: an export-facing buyer requires the attestation as a supply-chain
condition, units subscribe directly once field traction exists, and the long-term role is a
certified third-party compliance verifier. The system is designed to sit alongside existing
TNPCB monitoring and CPCB effluent categories rather than replace them, with report formats
shaped to buyer frameworks such as GOTS and Higg FEM.

---

## Uniqueness & Innovation

**1. The anti-evasion trapdoor.** Every sensor system shares one fatal weakness: the
monitored party controls the device and can switch it off before discharging. ThreadPass
turns that move into the evidence. Readings are cryptographically signed at capture, a
satellite anomaly automatically triggers review of the sensor's window for that period, and
unexplained downtime during a river anomaly is flagged as a suspicious bypass. Isolating a
layer does not create silence — it creates a finding.

**2. Validated before it was built.** Phase 0 reprocessed historical public imagery and
correlated the NDTI method against three years of real Central Water Commission turbidity
readings for the Noyyal basin, establishing the satellite layer's credibility with no
hardware and no capital spend. Most proposals at this stage are untested by construction;
this one had its core assumption checked against official government data first.

**3. Dual-layer correlation as the verdict rule.** Satellite water-quality monitoring
exists, and IoT effluent sensors exist. Both fail alone for the same reason from opposite
directions: satellite sees the river but cannot attribute a plume to one unit among twenty
on the same stretch, and a sensor at an outlet is a device the monitored party physically
controls. ThreadPass treats a violation as an *intersection* of the two. Neither layer can
produce a Flag by itself, so a false positive needs an atmospheric artefact and a sensor
fault to coincide in the same window, and evading a Flag needs the discharge to not reach
the river.

**4. Watch is a first-class, non-punitive state.** Most compliance tools are binary and
therefore have to choose between over-flagging and missing events. The explicit third state
lets ThreadPass disclose single-layer anomalies honestly without accusing anyone. A buyer
reading "2 watch observations, 0 verified violations" gets more real information than a
green tick would give.

**5. Per-unit adaptive baselines instead of fixed limits.** Nothing in the system compares
a unit to a universal number. Mercerising and bleaching have different normal signatures;
scoring each against its own history is what makes one rule work across a whole
heterogeneous cluster.

**6. Robust statistics chosen for this specific failure mode.** MAD over standard
deviation is not a stylistic choice — a discharge episode is precisely the kind of outlier
that inflates an SD and then hides inside the wider band it just created. The sustained-run
requirement kills the cloud-edge and passing-boat false positives that a per-day threshold
would generate.

**7. Buyer-facing verification with no account.** The commercial value is unlocked at the
point where a buyer in another country scans a QR code on a document and gets a live answer
that reflects a revocation issued yesterday. That path has no login and no gatekeeper.

**8. Economics that fit an MSME, and a buyer-funded model.** The satellite layer costs
nothing per unit — Sentinel-2 is free and open — so only the ground node is per-unit capex,
at ₹7,000–17,400. Geographic expansion is a software exercise, not a capital one. The
revenue sequencing matters just as much: the export buyer who needs the data pays for it,
which is what makes adoption possible for a cash-tight unit that would never buy monitoring
on its own.

**9. Built with honesty about what is proven.** Phase 0 used real government data; the live
demo runs on generated readings with fictional unit names, and every page and document says
so plainly. The detection engine, correlation rule and certificate lifecycle are real,
complete and running. Judges get to evaluate the method rather than guess at it.

**10. Zero-dependency engineering.** The whole thing is plain HTML/CSS/vanilla JS with no
framework, no npm install and no build step — including the SVG chart renderer and the QR
encoder, both written by hand. The QR encoder was verified by decoding its own output with
an independent decoder across versions 2, 4, 7 and 10. It therefore runs anywhere, deploys
to any static host, and loads on a low-end phone in a Tirupur workshop.

---

## Technology Stack

HTML5, CSS3 and vanilla JavaScript — no framework, no build step, zero dependencies — with
the detection engine (median baselines, MAD, dual-layer correlation), SVG charts and QR
encoder all written from scratch, served by a PowerShell `HttpListener` dev server and
deployable to any static host. Data sources: ESA Copernicus Sentinel-2 imagery (NDTI) and a
low-cost IoT node reading pH, TDS and turbidity. Tooling: Git, VS Code, browser print-to-PDF.

---

## GitHub / Source Code Link

https://github.com/lokegani/threadpass

---

## Deployment Link (optional)

https://lokegani.github.io/threadpass/

---

## Project Presentation (PPT) Link (optional)

_(upload your deck to Google Drive, set "Anyone with the link — Viewer", paste here)_

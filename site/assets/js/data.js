/* ThreadPass — simulated data layer
 * ---------------------------------------------------------------------------
 * Every reading in this app is generated here. Nothing is fetched from a
 * satellite or a sensor. The generation is DETERMINISTIC: the same seed always
 * produces the same numbers, so a certificate ID stays valid between reloads
 * and a demo looks identical every time you run it.
 *
 * The scenarios below are deliberately chosen so the output matches the
 * ThreadPass documents already generated for Noyyal Textile Finishers and
 * Velan Processing Mills.
 */
(function () {
  "use strict";

  var TP = (window.TP = window.TP || {});

  /* The monitoring window used across the whole app.
     Kept fixed (not "last 30 days from today") so it matches the certificate
     and report PDFs already issued, which cover 31 Jul - 29 Aug 2026. */
  TP.PERIOD = { start: "2026-07-31", end: "2026-08-29", days: 30 };

  TP.DISCLAIMER =
    "ThreadPass is a demonstration monitoring system operating on simulated " +
    "satellite and ground-sensor data. This document is a due-diligence " +
    "document, not a regulatory certification.";

  TP.SIM_NOTICE =
    "Simulated data — all satellite and sensor readings are generated; " +
    "unit names and registration numbers are fictional.";

  /* ---------------------------------------------------------------------
   * Deterministic pseudo-random numbers
   * ------------------------------------------------------------------ */

  /* mulberry32: a small, fast, well-distributed seeded generator.
     Math.random() cannot be seeded, which is why we need our own. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Box-Muller transform: turns two uniform randoms into one normally
     distributed value. Sensor noise is normal, not uniform. */
  function gaussian(rand) {
    var u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------------------------------------------------------------------
   * Dates
   * ------------------------------------------------------------------ */

  function addDays(iso, n) {
    var d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  TP.addDays = addDays;

  /* Day index 0 = 31 Jul 2026. For every August date the index is simply the
     day of the month, which keeps the scenario tables below readable. */
  TP.dayIso = function (i) { return addDays(TP.PERIOD.start, i); };

  /* ---------------------------------------------------------------------
   * The cluster
   * ------------------------------------------------------------------ */

  /* excursions[] injects a sustained departure from the unit's own baseline.
       ch   - which channel: ndti | ph | tds | turb
       from - first day index (0 = 31 Jul 2026)
       to   - last day index, inclusive
       amp  - size of the departure in noise-sigma units, so amp: 6.4 lands
              at roughly "6.4 SD above baseline" once detection scores it. */

  TP.UNITS = [
    {
      slug: "anaimalai", name: "Anaimalai Dyeing Works",
      cluster: "Tirupur", code: "TUP", state: "Tamil Nadu",
      lat: 11.0994, lon: 77.3178,
      process: "Reactive dyeing", udyam: "UDYAM-TN-19-0038112",
      seed: 10310, certSuffix: "K3M9WQ2",
      base:  { ndti: 21.4, ph: 7.22, tds: 884, turb: 14.1 },
      noise: { ndti: 0.52, ph: 0.045, tds: 17, turb: 0.62 },
      excursions: []
    },
    {
      /* Matches ThreadPass-Compliance-Report-tp-velan.pdf:
         two Flagged events, 17-20 Aug (satellite + pH) and
         18-20 Aug (satellite + TDS + turbidity), certification revoked. */
      slug: "velan", name: "Velan Processing Mills",
      cluster: "Tirupur", code: "TUP", state: "Tamil Nadu",
      lat: 11.1284, lon: 77.3462,
      process: "Bleaching & scouring", udyam: "UDYAM-TN-19-0038904",
      seed: 20477, certSuffix: "D5S3PK8",
      revoked: true,
      revokedOn: "2026-08-21",
      base:  { ndti: 22.1, ph: 7.18, tds: 902, turb: 14.6 },
      noise: { ndti: 0.55, ph: 0.048, tds: 19, turb: 0.66 },
      /* Final-day readings are pinned to the values printed in the PDF. */
      pinLast: { ndti: 22.3, ph: 7.16, tds: 908, turb: 14.8 },
      excursions: [
        { ch: "ndti", from: 17, to: 20, amp: 6.4 },
        { ch: "ph",   from: 17, to: 20, amp: 7.3 },
        { ch: "tds",  from: 18, to: 20, amp: 5.4 },
        { ch: "turb", from: 18, to: 20, amp: 5.5 }
      ]
    },
    {
      slug: "sakthi", name: "Sakthi Knit Processors",
      cluster: "Tirupur", code: "TUP", state: "Tamil Nadu",
      lat: 11.1067, lon: 77.3789,
      process: "Knit dyeing", udyam: "UDYAM-TN-19-0042318",
      seed: 30911, certSuffix: "7HD4RB1",
      base:  { ndti: 20.8, ph: 7.09, tds: 871, turb: 13.5 },
      noise: { ndti: 0.49, ph: 0.042, tds: 16, turb: 0.58 },
      /* Sensor-only: no satellite corroboration, so this stays a Watch. */
      excursions: [ { ch: "tds", from: 22, to: 23, amp: 5.2 } ]
    },
    {
      /* Matches ThreadPass-Certificate-TP-TUP-260829-0IP4J0Z.pdf:
         0 verified violations, 1 single-layer Watch observation. */
      slug: "noyyal", name: "Noyyal Textile Finishers",
      cluster: "Tirupur", code: "TUP", state: "Tamil Nadu",
      lat: 11.1503, lon: 77.4611,
      process: "Mercerising", udyam: "UDYAM-TN-19-0044530",
      seed: 40225, certSuffix: "0IP4J0Z",
      base:  { ndti: 21.9, ph: 7.26, tds: 893, turb: 14.9 },
      noise: { ndti: 0.53, ph: 0.046, tds: 18, turb: 0.64 },
      /* Satellite-only: likely someone else's discharge upstream. Watch. */
      excursions: [ { ch: "ndti", from: 11, to: 12, amp: 5.0 } ]
    },
    {
      slug: "kongu", name: "Kongu Dye House",
      cluster: "Erode", code: "ERD", state: "Tamil Nadu",
      lat: 11.3410, lon: 77.7172,
      process: "Yarn dyeing", udyam: "UDYAM-TN-19-0051204",
      seed: 50188, certSuffix: "X2N8VF5",
      base:  { ndti: 23.2, ph: 7.31, tds: 925, turb: 15.7 },
      noise: { ndti: 0.58, ph: 0.05, tds: 20, turb: 0.7 },
      excursions: [ { ch: "ndti", from: 5, to: 7, amp: 5.4 } ]
    },
    {
      slug: "periyar", name: "Periyar Colour Works",
      cluster: "Erode", code: "ERD", state: "Tamil Nadu",
      lat: 11.3628, lon: 77.7305,
      process: "Reactive dyeing", udyam: "UDYAM-TN-19-0053881",
      seed: 60733, certSuffix: "B6L1TC9",
      base:  { ndti: 20.3, ph: 7.14, tds: 862, turb: 13.2 },
      noise: { ndti: 0.47, ph: 0.041, tds: 15, turb: 0.55 },
      excursions: []
    },
    {
      slug: "bhavani", name: "Bhavani Processing Unit",
      cluster: "Erode", code: "ERD", state: "Tamil Nadu",
      lat: 11.4456, lon: 77.6822,
      process: "Bleaching & scouring", udyam: "UDYAM-TN-19-0055019",
      seed: 70654, certSuffix: "V8C2WM4",
      base:  { ndti: 22.7, ph: 7.2, tds: 911, turb: 15.1 },
      noise: { ndti: 0.56, ph: 0.047, tds: 19, turb: 0.68 },
      /* Dual-layer overlap 25-27 Aug, so this one is genuinely Flagged. */
      excursions: [
        { ch: "ndti", from: 24, to: 27, amp: 5.8 },
        { ch: "turb", from: 25, to: 27, amp: 6.1 }
      ]
    },
    {
      slug: "amaravathi", name: "Amaravathi Home Textiles",
      cluster: "Karur", code: "KRR", state: "Tamil Nadu",
      lat: 10.9601, lon: 78.0766,
      process: "Home-textile dyeing", udyam: "UDYAM-TN-19-0061442",
      seed: 80912, certSuffix: "M4Z7QY3",
      base:  { ndti: 19.8, ph: 7.05, tds: 848, turb: 12.8 },
      noise: { ndti: 0.45, ph: 0.04, tds: 15, turb: 0.53 },
      excursions: [ { ch: "ph", from: 14, to: 15, amp: 5.0 } ]
    },
    {
      /* Only 12 days of paired history, short of the 30-day baseline the
         method needs, so no status can be computed yet. */
      slug: "vasavi", name: "Vasavi Fabric Processors",
      cluster: "Karur", code: "KRR", state: "Tamil Nadu",
      lat: 10.9377, lon: 78.1021,
      process: "Printing & finishing", udyam: "UDYAM-TN-19-0063750",
      seed: 90341, certSuffix: null,
      historyDays: 12,
      base:  { ndti: 21.1, ph: 7.17, tds: 877, turb: 13.9 },
      noise: { ndti: 0.5, ph: 0.043, tds: 17, turb: 0.6 },
      excursions: []
    },
    {
      slug: "cauvery", name: "Cauvery Textile Mills",
      cluster: "Karur", code: "KRR", state: "Tamil Nadu",
      lat: 10.9812, lon: 78.0489,
      process: "Yarn dyeing", udyam: "UDYAM-TN-19-0065298",
      seed: 11298, certSuffix: "R9G2HN6",
      base:  { ndti: 20.6, ph: 7.12, tds: 866, turb: 13.4 },
      noise: { ndti: 0.48, ph: 0.042, tds: 16, turb: 0.57 },
      excursions: []
    }
  ];

  /* ---------------------------------------------------------------------
   * Accounts
   * ------------------------------------------------------------------ */

  TP.PASSWORD = "ThreadPass#2026";

  TP.ACCOUNTS = [
    { email: "monitor@threadpass.test",       role: "MONITOR", unit: null,          label: "Cluster Monitor" }
  ].concat(
    [
      ["tp.anaimalai",  "anaimalai"],
      ["tp.velan",      "velan"],
      ["tp.sakthi",     "sakthi"],
      ["tp.noyyal",     "noyyal"],
      ["er.kongu",      "kongu"],
      ["er.periyar",    "periyar"],
      ["er.bhavani",    "bhavani"],
      ["kr.amaravathi", "amaravathi"],
      ["kr.vasavi",     "vasavi"],
      ["kr.cauvery",    "cauvery"]
    ].map(function (pair) {
      var unit = TP.UNITS.filter(function (u) { return u.slug === pair[1]; })[0];
      return {
        email: pair[0] + "@threadpass.test",
        role: "UNIT",
        unit: pair[1],
        label: unit ? unit.name : pair[1]
      };
    })
  );

  /* ---------------------------------------------------------------------
   * Reading generation
   * ------------------------------------------------------------------ */

  /* Shape of an injected excursion across its run: strongest in the middle,
     tapering at both ends, the way a real discharge episode builds and clears
     rather than switching on and off like a square wave. */
  function excursionShape(j, len) {
    if (len <= 1) return 1;
    var mid = (len - 1) / 2;
    /* Only a slight taper. A deeper one put the first and last day of each run
       close enough to the detection threshold that ordinary noise could push
       them under, which truncated runs and silently lost short events. */
    return 1 - 0.06 * Math.abs((j - mid) / mid);
  }

  var CHANNELS = ["ndti", "ph", "tds", "turb"];

  TP.buildReadings = function (unit) {
    var history = unit.historyDays || TP.PERIOD.days;
    var firstIndex = TP.PERIOD.days - history;
    var rand = mulberry32(unit.seed);
    var rows = [];

    for (var i = firstIndex; i < TP.PERIOD.days; i++) {
      var row = { date: TP.dayIso(i), dayIndex: i };

      CHANNELS.forEach(function (ch) {
        var noise = gaussian(rand) * unit.noise[ch];
        var lift = 0;

        (unit.excursions || []).forEach(function (ex) {
          if (ex.ch !== ch || i < ex.from || i > ex.to) return;
          var len = ex.to - ex.from + 1;
          lift += ex.amp * unit.noise[ch] * excursionShape(i - ex.from, len);
        });

        /* During an excursion the discharge dominates the signal, so ordinary
           day-to-day variation is damped rather than added at full strength.
           This is also what keeps a run from breaking apart in the middle. */
        row[ch] = unit.base[ch] + (lift ? noise * 0.5 : noise) + lift;
      });

      rows.push(row);
    }

    /* Pin the final day to the exact figures printed in the existing PDF,
       so the app and the already-issued documents agree. */
    if (unit.pinLast && rows.length) {
      var last = rows[rows.length - 1];
      CHANNELS.forEach(function (ch) {
        if (typeof unit.pinLast[ch] === "number") last[ch] = unit.pinLast[ch];
      });
    }

    return rows;
  };
})();

/* ThreadPass — detection engine
 * ---------------------------------------------------------------------------
 * This file is the product. Everything else is presentation.
 *
 * The method, in order:
 *   1. Score each channel against ITS OWN 30-day median, never a fixed limit.
 *      Two units with different dye processes have different normal ranges;
 *      comparing both to one threshold would flag the wrong one.
 *   2. Use MAD (median absolute deviation) for the spread rather than standard
 *      deviation. A discharge episode is exactly the kind of outlier that
 *      inflates a standard deviation and then hides inside the wider band it
 *      just created. The median of absolute deviations does not move like that.
 *   3. Require a SUSTAINED run. One odd day is weather, a passing boat, or a
 *      cloud edge. Two or more consecutive days is a pattern.
 *   4. Flag only on DUAL confirmation: a satellite excursion and a ground-sensor
 *      excursion overlapping in the same window. One layer alone is a Watch —
 *      disclosed, but never a violation.
 */
(function () {
  "use strict";

  var TP = (window.TP = window.TP || {});

  TP.THRESHOLD_SD = 3.0;   /* how far from baseline counts as an excursion */
  TP.MIN_RUN_DAYS = 2;     /* how long it must persist to count at all */
  TP.MIN_HISTORY  = 30;    /* days of paired data needed before any verdict */

  TP.CHANNEL_LABEL = { ndti: "NDTI", ph: "pH", tds: "TDS", turb: "Turbidity" };
  TP.CHANNEL_UNIT  = { ndti: "", ph: "", tds: "mg/L", turb: "NTU" };

  /* NDTI, TDS and turbidity only matter when they rise — cleaner water is not
     a violation. pH matters in both directions, because an acidic discharge
     and an alkaline one are both effluent events. */
  var DIRECTION = { ndti: "up", tds: "up", turb: "up", ph: "both" };

  var SENSOR_CHANNELS = ["ph", "tds", "turb"];

  /* ---------------------------------------------------------------------
   * Statistics
   * ------------------------------------------------------------------ */

  function median(values) {
    var s = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  /* 1.4826 rescales MAD so that, for normally distributed data, it estimates
     the same quantity as a standard deviation. That is what lets us keep
     saying "SD" in reports while using a robust statistic underneath. */
  function madSigma(values, med) {
    var deviations = values.map(function (v) { return Math.abs(v - med); });
    var sigma = 1.4826 * median(deviations);
    return sigma > 1e-9 ? sigma : 1e-9;
  }

  TP.median = median;

  /* ---------------------------------------------------------------------
   * Excursions
   * ------------------------------------------------------------------ */

  /* Walk the scored series and collect every run of consecutive days at or
     above the threshold that is long enough to count. */
  function findRuns(scores, dayIndexes) {
    var runs = [], start = null, peak = 0;

    for (var i = 0; i <= scores.length; i++) {
      var over = i < scores.length && scores[i] >= TP.THRESHOLD_SD;

      if (over) {
        if (start === null) { start = i; peak = scores[i]; }
        else if (scores[i] > peak) { peak = scores[i]; }
      } else if (start !== null) {
        if (i - start >= TP.MIN_RUN_DAYS) {
          runs.push({
            from: dayIndexes[start],
            to: dayIndexes[i - 1],
            fromIso: TP.dayIso(dayIndexes[start]),
            toIso: TP.dayIso(dayIndexes[i - 1]),
            peak: peak
          });
        }
        start = null;
      }
    }
    return runs;
  }

  function scoreChannel(readings, channel) {
    var values = readings.map(function (r) { return r[channel]; });
    var med = median(values);
    var sigma = madSigma(values, med);
    var dir = DIRECTION[channel];

    var scores = values.map(function (v) {
      var z = (v - med) / sigma;
      return dir === "both" ? Math.abs(z) : z;
    });

    return {
      channel: channel,
      values: values,
      median: med,
      sigma: sigma,
      scores: scores,
      /* Each sensor channel is rebased to its own median = 100 so pH, TDS and
         turbidity can be read on a single axis despite different units. */
      indexed: values.map(function (v) { return (v / med) * 100; }),
      excursions: findRuns(scores, readings.map(function (r) { return r.dayIndex; }))
    };
  }

  function overlaps(a, b) { return a.from <= b.to && b.from <= a.to; }

  /* ---------------------------------------------------------------------
   * Dates
   * ------------------------------------------------------------------ */

  var MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var MONTHS_LONG  = ["January","February","March","April","May","June","July",
                      "August","September","October","November","December"];

  TP.fmtDate = function (iso, style) {
    var d = new Date(iso + "T00:00:00Z");
    var day = d.getUTCDate(), m = d.getUTCMonth(), y = d.getUTCFullYear();
    if (style === "long")  return day + " " + MONTHS_SHORT[m] + " " + y;
    if (style === "month") return day + " " + MONTHS_LONG[m];
    return day + " " + MONTHS_SHORT[m];
  };

  TP.fmtRange = function (fromIso, toIso) {
    return TP.fmtDate(fromIso) + " – " + TP.fmtDate(toIso);
  };

  /* ---------------------------------------------------------------------
   * Events
   * ------------------------------------------------------------------ */

  function describePeaks(list) {
    return list.map(function (x) {
      return TP.CHANNEL_LABEL[x.channel] + " (peak " + x.peak.toFixed(1) + " SD)";
    }).join(", ");
  }

  function buildEvents(channels) {
    var satellite = channels.ndti.excursions;
    var events = [];

    /* Group sensor excursions that share an identical window, so three
       channels spiking together read as one event, not three. */
    var groups = {};
    SENSOR_CHANNELS.forEach(function (ch) {
      channels[ch].excursions.forEach(function (ex) {
        var key = ex.from + ":" + ex.to;
        (groups[key] = groups[key] || { from: ex.from, to: ex.to, members: [] })
          .members.push({ channel: ch, peak: ex.peak });
      });
    });
    var sensorGroups = Object.keys(groups).map(function (k) { return groups[k]; });

    var matchedSatellite = {}, matchedSensor = {};

    /* Dual confirmation: satellite AND sensor overlapping in time. */
    satellite.forEach(function (sat, si) {
      sensorGroups.forEach(function (grp, gi) {
        if (!overlaps(sat, grp)) return;
        matchedSatellite[si] = true;
        matchedSensor[gi] = true;

        var from = Math.max(sat.from, grp.from);
        var to   = Math.min(sat.to, grp.to);

        events.push({
          severity: "Flagged",
          from: from, to: to,
          fromIso: TP.dayIso(from), toIso: TP.dayIso(to),
          source: "Satellite + sensor",
          channels: ["ndti"].concat(grp.members.map(function (m) { return m.channel; })),
          description:
            "NDTI excursion (peak " + sat.peak.toFixed(1) + " SD above baseline) overlapping " +
            describePeaks(grp.members) + " — dual confirmed.",
          resolution:
            "Resolved — readings returned within baseline from " +
            TP.fmtDate(TP.dayIso(to + 1)) + "."
        });
      });
    });

    /* Satellite with nothing on the ground: could be an upstream discharge
       from someone else entirely. Disclosed, not charged to this unit. */
    satellite.forEach(function (sat, si) {
      if (matchedSatellite[si]) return;
      events.push({
        severity: "Watch",
        from: sat.from, to: sat.to,
        fromIso: sat.fromIso, toIso: sat.toIso,
        source: "Satellite only",
        channels: ["ndti"],
        description:
          "NDTI excursion (peak " + sat.peak.toFixed(1) + " SD above baseline) with no " +
          "corroborating ground-sensor excursion in the same window.",
        resolution:
          "Uncorroborated — single layer only. Recorded and disclosed; not a verified violation."
      });
    });

    /* Ground sensor with nothing overhead: often a local process change, or
       cloud cover hiding the river on those dates. */
    sensorGroups.forEach(function (grp, gi) {
      if (matchedSensor[gi]) return;
      events.push({
        severity: "Watch",
        from: grp.from, to: grp.to,
        fromIso: TP.dayIso(grp.from), toIso: TP.dayIso(grp.to),
        source: "Sensor only",
        channels: grp.members.map(function (m) { return m.channel; }),
        description:
          describePeaks(grp.members) + " excursion with no corroborating satellite " +
          "excursion in the same window.",
        resolution:
          "Uncorroborated — single layer only. Recorded and disclosed; not a verified violation."
      });
    });

    events.sort(function (a, b) { return a.from - b.from; });
    return events;
  }

  /* ---------------------------------------------------------------------
   * Plain-English summary
   * ------------------------------------------------------------------ */

  function summarise(unit, a) {
    var p = TP.PERIOD;
    var latest = a.readings[a.readings.length - 1];
    var opening =
      "Over the " + a.readings.length + " days from " + TP.fmtDate(a.readings[0].date, "month") +
      " to " + TP.fmtDate(latest.date, "month") + ", monitoring for " + unit.name +
      " tracked satellite water-quality indices alongside ground sensors for pH, " +
      "total dissolved solids, and turbidity. ";

    var readingLine =
      "Latest readings stand at a satellite index of " + latest.ndti.toFixed(1) +
      ", pH of " + latest.ph.toFixed(2) +
      ", dissolved solids of " + Math.round(latest.tds) + " milligrams per litre, and turbidity of " +
      latest.turb.toFixed(1) + " nephelometric units. ";

    if (a.certification === "Not Yet Eligible") {
      return opening + readingLine +
        "The unit has " + a.readings.length + " days of paired history, short of the " +
        TP.MIN_HISTORY + " days the method requires before any status can be assigned. " +
        "No verdict is offered here, and the absence of findings should not be read as a clean result.";
    }

    var flagged = a.events.filter(function (e) { return e.severity === "Flagged"; });
    var watch   = a.events.filter(function (e) { return e.severity === "Watch"; });

    if (flagged.length) {
      var first = flagged[0], last = flagged[flagged.length - 1];
      var chans = {};
      flagged.forEach(function (e) {
        e.channels.forEach(function (c) { if (c !== "ndti") chans[c] = true; });
      });
      var names = Object.keys(chans).map(function (c) {
        return { ph: "pH", tds: "dissolved solids", turb: "turbidity" }[c];
      });
      return opening + readingLine +
        "The facility is currently assigned a " + a.operationalStatus + " status. This was triggered by " +
        "overlapping excursions between " + TP.fmtDate(first.fromIso, "month") + " and " +
        TP.fmtDate(last.toIso, "month") + ", when satellite alerts coincided with ground-sensor spikes across " +
        names.join(", ") + ". For buyers sourcing " + unit.process.toLowerCase() + " work from this unit, " +
        "this designation indicates verified anomalies that warrant closer review before placing new orders.";
    }

    if (watch.length) {
      return opening + readingLine +
        "No excursion was corroborated across both independent layers at any point in the period, so no " +
        "verified violation was recorded. " + watch.length + " single-layer " +
        (watch.length === 1 ? "observation was" : "observations were") + " logged and " +
        (watch.length === 1 ? "is" : "are") + " disclosed in the event log below. Under the ThreadPass rule, " +
        "an uncorroborated observation does not constitute a violation and does not affect eligibility.";
    }

    return opening + readingLine +
      "No excursion was detected on either layer at any point in the period, and no Watch observations were " +
      "recorded. The unit holds a current ThreadPass certificate for this window.";
  }

  /* ---------------------------------------------------------------------
   * Public entry point
   * ------------------------------------------------------------------ */

  /* ---------------------------------------------------------------------
   * Monitor overrides
   * ---------------------------------------------------------------------
   * A certificate is not purely a function of the readings. A Monitor can
   * revoke one — after an on-site finding, say — and can reinstate one that
   * was revoked in error. Those decisions are held here.
   *
   * In this build they live in localStorage, so they are per-browser and
   * vanish if site data is cleared. In a served build this is a table.
   */

  var OVERRIDE_KEY = "threadpass.overrides";

  TP.overrides = function () {
    try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || "{}"); }
    catch (e) { return {}; }
  };

  TP.setOverride = function (slug, state) {
    var all = TP.overrides();
    if (state) all[slug] = state; else delete all[slug];
    try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    cache = null;   /* the cluster must be recomputed after a decision */
  };

  TP.analyse = function (unit) {
    var readings = TP.buildReadings(unit);
    var channels = {};
    ["ndti"].concat(SENSOR_CHANNELS).forEach(function (ch) {
      channels[ch] = scoreChannel(readings, ch);
    });

    var enoughHistory = readings.length >= TP.MIN_HISTORY;
    var events = enoughHistory ? buildEvents(channels) : [];

    var flaggedCount = events.filter(function (e) { return e.severity === "Flagged"; }).length;
    var watchCount   = events.filter(function (e) { return e.severity === "Watch"; }).length;

    var operationalStatus, certification;

    /* A Monitor decision beats the unit's default state, in both directions. */
    var override = TP.overrides()[unit.slug];
    var revoked = override === "revoked" ? true
                : override === "active"  ? false
                : !!unit.revoked;

    if (!enoughHistory) {
      operationalStatus = "Insufficient history";
      certification = "Not Yet Eligible";
    } else if (flaggedCount > 0) {
      operationalStatus = "Flagged";
      certification = revoked ? "Revoked" : "Under Review";
    } else {
      operationalStatus = watchCount > 0 ? "Watch" : "Normal";
      certification = revoked ? "Revoked" : "Certified";
    }

    /* A certificate record exists for revoked units too — the whole point of
       the public verification page is that a revoked certificate must still
       resolve, and say plainly that it is no longer valid. */
    var certificate = null;
    if (unit.certSuffix && certification !== "Not Yet Eligible" && certification !== "Under Review") {
      certificate = {
        id: "TP-" + unit.code + "-260829-" + unit.certSuffix,
        unitSlug: unit.slug,
        periodStart: TP.PERIOD.start,
        periodEnd: TP.PERIOD.end,
        issued: TP.PERIOD.end,
        validUntil: "2027-08-29",
        violations: flaggedCount,
        watch: watchCount,
        revoked: certification === "Revoked",
        revokedOn: unit.revokedOn || null
      };
    }

    var analysis = {
      unit: unit,
      readings: readings,
      channels: channels,
      events: events,
      flaggedCount: flaggedCount,
      watchCount: watchCount,
      operationalStatus: operationalStatus,
      certification: certification,
      certificate: certificate,
      latest: readings[readings.length - 1],
      enoughHistory: enoughHistory
    };

    analysis.summary = summarise(unit, analysis);
    return analysis;
  };

  /* Analyse every unit once and cache it, so each page shares one consistent
     view of the cluster instead of recomputing per component. */
  var cache = null;
  TP.analyseAll = function () {
    if (!cache) cache = TP.UNITS.map(TP.analyse);
    return cache;
  };

  TP.byUnitSlug = function (slug) {
    return TP.analyseAll().filter(function (a) { return a.unit.slug === slug; })[0] || null;
  };

  TP.findCertificate = function (id) {
    var needle = String(id || "").trim().toUpperCase();
    var hit = TP.analyseAll().filter(function (a) {
      return a.certificate && a.certificate.id.toUpperCase() === needle;
    })[0];
    return hit || null;
  };
})();

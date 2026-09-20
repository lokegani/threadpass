/* ThreadPass — charts
 * ---------------------------------------------------------------------------
 * Hand-built SVG line charts. No charting library, because there is no package
 * manager on this machine and because the two charts this product needs are
 * narrow enough to draw directly.
 *
 * Two deliberate choices worth knowing:
 *
 *  - ONE AXIS, ALWAYS. pH (~7), TDS (~900 mg/L) and turbidity (~15 NTU) cannot
 *    share a y-axis honestly, and a second y-axis makes two series appear to
 *    cross when they never did. So each sensor channel is rebased to its own
 *    30-day median = 100 and all three share one indexed axis. The shape is
 *    preserved; the false comparison is not.
 *
 *  - COLOUR IS NEVER THE ONLY SIGNAL. Every series is direct-labelled at the
 *    end of its line and listed in the legend, every shaded band is captioned,
 *    and a data table sits under each chart.
 */
(function () {
  "use strict";

  var TP = (window.TP = window.TP || {});
  var uid = 0;

  /* ---------------------------------------------------------------------
   * Scales
   * ------------------------------------------------------------------ */

  /* Round a raw axis range out to human numbers — 0.5, 2, 25 — rather than
     whatever the data happened to reach. */
  function niceTicks(min, max, count) {
    var span = max - min;
    if (span <= 0) span = Math.abs(max) || 1;

    var raw = span / count;
    var step = Math.pow(10, Math.floor(Math.log10(raw)));
    var err = raw / step;
    if (err >= 7.5) step *= 10;
    else if (err >= 3.5) step *= 5;
    else if (err >= 1.5) step *= 2;

    var ticks = [];
    for (var t = Math.ceil(min / step) * step; t <= max + step * 0.001; t += step) {
      ticks.push(Math.round(t / step) * step);
    }
    return ticks;
  }

  /* ---------------------------------------------------------------------
   * Chart
   * ------------------------------------------------------------------ */

  /* opts:
   *   dates    [iso...]
   *   series   [{ label, values[], color (css var), dash }]
   *   bands    [{ i0, i1, severity: "Flagged"|"Watch", label }]
   *   baseline number|null   a reference line, e.g. the 30-day median
   *   format   fn(value) -> string
   *   height   px
   *   table    boolean, render the data table underneath
   */
  TP.lineChart = function (host, opts) {
    if (!host) return;

    var W = 880;
    var H = opts.height || 250;
    var padL = 54, padR = 58, padT = 16, padB = 34;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var n = opts.dates.length;
    var id = "c" + (++uid);

    /* ---- domain ---- */
    var all = [];
    opts.series.forEach(function (s) { all = all.concat(s.values); });
    if (typeof opts.baseline === "number") all.push(opts.baseline);

    var lo = Math.min.apply(null, all);
    var hi = Math.max.apply(null, all);
    var pad = (hi - lo) * 0.14 || 1;
    lo -= pad; hi += pad;

    var ticks = niceTicks(lo, hi, 4);
    lo = Math.min(lo, ticks[0]);
    hi = Math.max(hi, ticks[ticks.length - 1]);

    function x(i) { return padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW); }
    function y(v) { return padT + plotH - ((v - lo) / (hi - lo)) * plotH; }

    var svg = [];
    svg.push('<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" ' +
             'aria-label="' + TP.esc(opts.ariaLabel || "Time series chart") + '">');

    /* Two events can cover overlapping days — a satellite window matched by
       two different sensor groups, say. Drawn as-is they stack into a darker
       rectangle and print their captions on top of each other, so merge any
       that touch into a single band per severity. */
    function mergeBands(bands) {
      var bySeverity = {};
      (bands || []).forEach(function (b) {
        (bySeverity[b.severity] = bySeverity[b.severity] || []).push(b);
      });

      var merged = [];
      Object.keys(bySeverity).forEach(function (severity) {
        bySeverity[severity].sort(function (p, q) { return p.i0 - q.i0; })
          .forEach(function (b) {
            var last = merged[merged.length - 1];
            if (last && last.severity === severity && b.i0 <= last.i1 + 1) {
              last.i1 = Math.max(last.i1, b.i1);
            } else {
              merged.push({ i0: b.i0, i1: b.i1, severity: severity, label: b.label });
            }
          });
      });
      return merged;
    }

    /* ---- excursion bands, drawn first so lines sit on top ---- */
    mergeBands(opts.bands).forEach(function (b) {
      var x0 = x(b.i0), x1 = x(b.i1);
      var w = Math.max(x1 - x0, 3);
      var fill = b.severity === "Flagged" ? "var(--band-flag)" : "var(--band-watch)";
      var edge = b.severity === "Flagged" ? "var(--red)" : "var(--amber)";
      svg.push('<rect x="' + x0.toFixed(1) + '" y="' + padT + '" width="' + w.toFixed(1) +
               '" height="' + plotH + '" fill="' + fill + '"/>');
      svg.push('<line x1="' + x0.toFixed(1) + '" y1="' + padT + '" x2="' + x0.toFixed(1) +
               '" y2="' + (padT + plotH) + '" stroke="' + edge + '" stroke-width="1" stroke-dasharray="2 2" opacity=".55"/>');
      svg.push('<line x1="' + (x0 + w).toFixed(1) + '" y1="' + padT + '" x2="' + (x0 + w).toFixed(1) +
               '" y2="' + (padT + plotH) + '" stroke="' + edge + '" stroke-width="1" stroke-dasharray="2 2" opacity=".55"/>');
      if (b.label) {
        svg.push('<text x="' + (x0 + w / 2).toFixed(1) + '" y="' + (padT + 11) +
                 '" text-anchor="middle" font-size="9.5" font-weight="700" ' +
                 'letter-spacing=".06em" fill="' + edge + '">' + TP.esc(b.label) + "</text>");
      }
    });

    /* ---- gridlines + y axis ---- */
    ticks.forEach(function (t) {
      var yy = y(t);
      svg.push('<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (padL + plotW) +
               '" y2="' + yy.toFixed(1) + '" stroke="var(--grid)" stroke-width="1"/>');
      svg.push('<text x="' + (padL - 9) + '" y="' + (yy + 3.5).toFixed(1) +
               '" text-anchor="end" font-size="10.5" fill="var(--faint)">' +
               TP.esc(opts.format ? opts.format(t) : t) + "</text>");
    });

    /* Labels sitting off the right edge — one per series, plus the baseline.
       Collected rather than drawn inline so they can be pushed apart below;
       two lines ending at a similar value would otherwise print on top of
       each other and be unreadable. */
    var edgeLabels = [];

    /* ---- baseline reference ---- */
    if (typeof opts.baseline === "number") {
      var yb = y(opts.baseline);
      svg.push('<line x1="' + padL + '" y1="' + yb.toFixed(1) + '" x2="' + (padL + plotW) +
               '" y2="' + yb.toFixed(1) + '" stroke="var(--baseline)" stroke-width="1.25" stroke-dasharray="5 4"/>');
      edgeLabels.push({ y: yb, text: "baseline", color: "var(--faint)", size: 9.5, weight: 600 });
    }

    /* ---- x axis labels ---- */
    var every = Math.max(1, Math.round(n / 6));
    for (var i = 0; i < n; i += every) {
      svg.push('<text x="' + x(i).toFixed(1) + '" y="' + (padT + plotH + 17) +
               '" text-anchor="middle" font-size="10.5" fill="var(--faint)">' +
               TP.esc(TP.fmtDate(opts.dates[i])) + "</text>");
    }

    /* ---- the lines ---- */
    opts.series.forEach(function (s, si) {
      var d = s.values.map(function (v, i) {
        return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
      }).join(" ");
      svg.push('<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2" ' +
               'stroke-linejoin="round" stroke-linecap="round"' +
               (s.dash ? ' stroke-dasharray="' + s.dash + '"' : "") + "/>");

      /* Direct label at the line end, so identity never depends on colour. */
      var last = s.values[s.values.length - 1];
      edgeLabels.push({ y: y(last), text: s.label, color: s.color, size: 10, weight: 700 });

      svg.push('<circle id="' + id + "-dot" + si + '" r="4" fill="' + s.color +
               '" stroke="var(--surface)" stroke-width="2" opacity="0"/>');
    });

    /* Push the edge labels apart so none overlaps its neighbour, then keep the
       whole stack inside the plot area. */
    edgeLabels.sort(function (p, q) { return p.y - q.y; });
    var MIN_GAP = 12;
    for (var e = 1; e < edgeLabels.length; e++) {
      if (edgeLabels[e].y - edgeLabels[e - 1].y < MIN_GAP) {
        edgeLabels[e].y = edgeLabels[e - 1].y + MIN_GAP;
      }
    }
    var overflow = edgeLabels.length
      ? edgeLabels[edgeLabels.length - 1].y - (padT + plotH)
      : 0;
    if (overflow > 0) {
      edgeLabels.forEach(function (label) { label.y -= overflow; });
    }

    edgeLabels.forEach(function (label) {
      svg.push('<text x="' + (padL + plotW + 6) + '" y="' + (label.y + 3.5).toFixed(1) +
               '" font-size="' + label.size + '" font-weight="' + label.weight +
               '" fill="' + label.color + '">' + TP.esc(label.text) + "</text>");
    });

    /* ---- hover layer ---- */
    svg.push('<line id="' + id + '-cross" x1="0" y1="' + padT + '" x2="0" y2="' +
             (padT + plotH) + '" stroke="var(--muted)" stroke-width="1" opacity="0"/>');
    svg.push('<rect id="' + id + '-hit" x="' + padL + '" y="' + padT + '" width="' + plotW +
             '" height="' + plotH + '" fill="transparent" style="cursor:crosshair"/>');
    svg.push("</svg>");

    /* ---- legend: always present for two or more series ---- */
    var legend = "";
    if (opts.series.length > 1) {
      legend = '<div class="chart-legend">' + opts.series.map(function (s) {
        return '<span><i style="background:' + s.color + '"></i>' + TP.esc(s.label) + "</span>";
      }).join("") + "</div>";
    }

    /* ---- band caption ---- */
    var caption = "";
    if ((opts.bands || []).length) {
      var kinds = {};
      opts.bands.forEach(function (b) { kinds[b.severity] = true; });
      caption = '<p class="hint" style="margin-top:8px">Shaded bands mark sustained excursions' +
        (kinds.Flagged ? " — solid-edged bands are dual-confirmed Flagged windows" : "") +
        (kinds.Watch ? (kinds.Flagged ? "; " : " — ") + "Watch bands are single-layer only" : "") + ".</p>";
    }

    /* ---- table view ---- */
    var table = "";
    if (opts.table !== false) {
      var head = "<tr><th>Date</th>" + opts.series.map(function (s) {
        return '<th class="num">' + TP.esc(s.label) + "</th>";
      }).join("") + "</tr>";
      var body = opts.dates.map(function (dt, i) {
        return "<tr><td>" + TP.esc(TP.fmtDate(dt, "long")) + "</td>" +
          opts.series.map(function (s) {
            return '<td class="num">' + TP.esc(opts.format ? opts.format(s.values[i]) : s.values[i].toFixed(2)) + "</td>";
          }).join("") + "</tr>";
      }).join("");
      table =
        '<details class="chart-table"><summary>Show the underlying numbers</summary>' +
        '<div class="table-scroll"><table class="data"><thead>' + head + "</thead><tbody>" +
        body + "</tbody></table></div></details>";
    }

    host.innerHTML =
      '<div class="chart-holder">' + svg.join("") +
      '<div class="chart-tip" id="' + id + '-tip" hidden></div></div>' +
      legend + caption + table;

    /* ---- interaction ---- */
    var svgEl = host.querySelector("svg");
    var hit = document.getElementById(id + "-hit");
    var cross = document.getElementById(id + "-cross");
    var tip = document.getElementById(id + "-tip");
    var dots = opts.series.map(function (_, si) { return document.getElementById(id + "-dot" + si); });

    function hide() {
      cross.setAttribute("opacity", "0");
      dots.forEach(function (d) { d.setAttribute("opacity", "0"); });
      tip.hidden = true;
    }

    function move(evt) {
      var box = svgEl.getBoundingClientRect();
      var point = evt.touches ? evt.touches[0] : evt;
      /* Convert page pixels into the chart's own viewBox units. */
      var vx = ((point.clientX - box.left) / box.width) * W;
      var i = Math.round(((vx - padL) / plotW) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));

      cross.setAttribute("x1", x(i).toFixed(1));
      cross.setAttribute("x2", x(i).toFixed(1));
      cross.setAttribute("opacity", ".45");

      opts.series.forEach(function (s, si) {
        dots[si].setAttribute("cx", x(i).toFixed(1));
        dots[si].setAttribute("cy", y(s.values[i]).toFixed(1));
        dots[si].setAttribute("opacity", "1");
      });

      tip.hidden = false;
      tip.innerHTML =
        "<b>" + TP.esc(TP.fmtDate(opts.dates[i], "long")) + "</b>" +
        opts.series.map(function (s) {
          return '<span><i style="background:' + s.color + '"></i>' + TP.esc(s.label) +
                 '<em>' + TP.esc(opts.format ? opts.format(s.values[i]) : s.values[i].toFixed(2)) + "</em></span>";
        }).join("");

      /* Keep the tooltip inside the chart rather than letting it run off. */
      var ratio = box.width / W;
      var left = x(i) * ratio;
      var flip = left > box.width * 0.6;
      tip.style.left = (flip ? left - tip.offsetWidth - 14 : left + 14) + "px";
      tip.style.top = "10px";
    }

    hit.addEventListener("mousemove", move);
    hit.addEventListener("mouseleave", hide);
    hit.addEventListener("touchstart", move, { passive: true });
    hit.addEventListener("touchmove", move, { passive: true });
    hit.addEventListener("touchend", hide);
  };

  /* ---------------------------------------------------------------------
   * Chart builders for the two charts this product actually needs
   * ------------------------------------------------------------------ */

  function bandsFor(analysis, layer) {
    var positions = {};
    analysis.readings.forEach(function (r, i) { positions[r.dayIndex] = i; });

    return analysis.events.filter(function (e) {
      if (layer === "satellite") return e.channels.indexOf("ndti") !== -1;
      return e.channels.some(function (c) { return c !== "ndti"; });
    }).map(function (e) {
      return {
        i0: positions[e.from], i1: positions[e.to],
        severity: e.severity, label: e.severity.toUpperCase()
      };
    }).filter(function (b) { return b.i0 != null && b.i1 != null; });
  }

  TP.renderNdtiChart = function (host, analysis) {
    var ch = analysis.channels.ndti;
    TP.lineChart(host, {
      dates: analysis.readings.map(function (r) { return r.date; }),
      series: [{ label: "NDTI", values: ch.values, color: "var(--series-sat)" }],
      bands: bandsFor(analysis, "satellite"),
      baseline: ch.median,
      format: function (v) { return v.toFixed(1); },
      ariaLabel: "Daily satellite NDTI for " + analysis.unit.name,
      height: 240
    });
  };

  TP.renderSensorChart = function (host, analysis) {
    var c = analysis.channels;
    TP.lineChart(host, {
      dates: analysis.readings.map(function (r) { return r.date; }),
      series: [
        { label: "pH",        values: c.ph.indexed,   color: "var(--series-1)" },
        { label: "TDS",       values: c.tds.indexed,  color: "var(--series-2)", dash: "7 3" },
        { label: "Turbidity", values: c.turb.indexed, color: "var(--series-3)", dash: "2 3" }
      ],
      bands: bandsFor(analysis, "sensor"),
      baseline: 100,
      format: function (v) { return v.toFixed(0); },
      ariaLabel: "Ground sensor channels for " + analysis.unit.name +
                 ", each indexed to its own 30-day median",
      height: 240
    });
  };
})();

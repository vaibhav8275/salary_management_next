"use client";

import { useId, useState } from "react";

/**
 * Charts, hand-built in SVG.
 *
 * No charting library: these five charts are all simple shapes, and a library
 * would add ~100kB and a React wrapper for axis maths that is a few lines here.
 * Everything is real `<svg>` markup, so it scales, prints, and takes colour from
 * the same CSS custom properties as the rest of the app.
 *
 * The one rule that shapes all of them: **amounts are never summed across
 * currencies.** The reports return one row per (group, currency) — GBP and JPY
 * in the same payload — so every chart takes a currency that has already been
 * selected and only ever draws rows matching it. The currency picker lives in
 * the dashboard, above the charts.
 */

const SERIES = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

// --- Shared axis helpers ---------------------------------------------------

/**
 * A "nice" axis maximum, so ticks land on round numbers.
 *
 * `1, 2, 2.5, 5 × 10^n` are the steps that make ticks read as round values
 * (25,000 / 50,000 / 75,000) instead of arbitrary ones (27,431 / 54,862).
 */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;

  const step = [ 1, 2, 2.5, 5, 10 ].find((candidate) => normalised <= candidate) ?? 10;
  return step * magnitude;
}

function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, index) => (max / count) * index);
}

function shortAxisValue(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(value / 1_000)}k`;
  return trim(value);
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

// --- Bar chart -------------------------------------------------------------

export interface BarDatum {
  label: string;
  value: number;
  /** Optional override, for charts where the bar is not the value itself. */
  display?: string;
}

/**
 * Horizontal bars.
 *
 * Horizontal rather than vertical because the category labels here are names —
 * "Customer Support", "Human Resources" — which do not fit under a column
 * without rotating them. Labelled directly on each bar, so there is no legend
 * to look away from the data.
 */
export function BarChart({
  data,
  formatValue,
  emptyMessage = "No data for this selection.",
  colorByIndex = true,
}: {
  data: BarDatum[];
  formatValue: (value: number) => string;
  emptyMessage?: string;
  colorByIndex?: boolean;
}) {
  if (data.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  const max = niceCeiling(Math.max(...data.map((d) => d.value), 0));
  const rowHeight = 34;
  const barHeight = 20;
  const labelWidth = 132;
  const valueWidth = 84;
  // `md:` is a soft minimum: the row is label + bar + value, and the bar takes
  // whatever is left, so it reflows with the container rather than scaling.
  const chartWidth = 560;
  const barArea = chartWidth - labelWidth - valueWidth;
  const height = data.length * rowHeight + 8;

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${height}`}
      className="w-full"
      role="img"
      aria-label="Bar chart"
    >
      {data.map((datum, index) => {
        const y = index * rowHeight + 4;
        const width = max > 0 ? Math.max((datum.value / max) * barArea, datum.value > 0 ? 2 : 0) : 0;

        return (
          <g key={datum.label}>
            <text
              x={labelWidth - 10}
              y={y + barHeight / 2}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-ink-soft text-[12px]"
            >
              {truncate(datum.label, 18)}
            </text>
            <rect
              x={labelWidth}
              y={y}
              width={barArea}
              height={barHeight}
              rx={4}
              className="fill-surface-sunken"
            />
            <rect
              x={labelWidth}
              y={y}
              width={width}
              height={barHeight}
              rx={4}
              className={colorByIndex ? "" : "fill-chart-1"}
              style={colorByIndex ? { fill: SERIES[index % SERIES.length] } : undefined}
            >
              <title>{`${datum.label}: ${datum.display ?? formatValue(datum.value)}`}</title>
            </rect>
            <text
              x={chartWidth - 4}
              y={y + barHeight / 2}
              textAnchor="end"
              dominantBaseline="central"
              className="tabular fill-ink text-[12px] font-medium"
            >
              {datum.display ?? formatValue(datum.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// --- Column chart (grouped) ------------------------------------------------

export interface GroupedDatum {
  label: string;
  /** One value per series, aligned with `series` below. */
  values: number[];
}

/**
 * Grouped columns for the salary distribution, where each band holds a count per
 * currency. Only the selected currency is drawn, so this is a single-series
 * column chart — `values` is still a list so the shape matches GroupedDatum and
 * the axis maths is shared with the legend below.
 */
export function ColumnChart({
  data,
  series,
  formatValue,
  emptyMessage = "No data for this selection.",
}: {
  data: GroupedDatum[];
  series: string[];
  formatValue: (value: number) => string;
  emptyMessage?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  const total = data.reduce((sum, d) => sum + d.values.reduce((a, b) => a + b, 0), 0);
  const max = niceCeiling(
    Math.max(...data.flatMap((d) => d.values), 0),
  );

  const width = 560;
  const height = 220;
  const padding = { top: 16, right: 8, bottom: 44, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const bandWidth = plotWidth / data.length;
  const groupGap = 6;
  const groupWidth = Math.min(bandWidth * 0.62, 46);
  const barWidth = (groupWidth - groupGap * (series.length - 1)) / series.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Column chart">
      {/* Horizontal gridlines with value labels. */}
      {ticks(max).map((tick) => {
        const y = padding.top + plotHeight - (tick / max) * plotHeight;
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              className="stroke-line"
              strokeWidth={1}
              strokeDasharray={tick === 0 ? undefined : "3 3"}
            />
            <text
              x={padding.left - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="central"
              className="tabular fill-muted text-[10px]"
            >
              {shortAxisValue(tick)}
            </text>
          </g>
        );
      })}

      {data.map((datum, bandIndex) => {
        const bandX = padding.left + bandIndex * bandWidth;
        const groupX = bandX + (bandWidth - groupWidth) / 2;

        return (
          <g
            key={datum.label}
            onMouseEnter={() => setHovered(bandIndex)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* A full-height hit area, so hovering anywhere over the band
                highlights it rather than only the drawn bars. */}
            <rect
              x={bandX}
              y={padding.top}
              width={bandWidth}
              height={plotHeight}
              fill="transparent"
            />
            {datum.values.map((value, seriesIndex) => {
              const barHeight = max > 0 ? (value / max) * plotHeight : 0;
              return (
                <rect
                  key={seriesIndex}
                  x={groupX + seriesIndex * (barWidth + groupGap)}
                  y={padding.top + plotHeight - barHeight}
                  width={Math.max(barWidth, 1)}
                  height={barHeight}
                  rx={3}
                  style={{
                    fill: SERIES[seriesIndex % SERIES.length],
                    opacity: hovered === null || hovered === bandIndex ? 1 : 0.45,
                  }}
                />
              );
            })}
            <text
              x={bandX + bandWidth / 2}
              y={height - padding.bottom + 16}
              textAnchor="middle"
              className="fill-muted text-[10px]"
            >
              {truncate(datum.label.replace("-", "–"), 12)}
            </text>
          </g>
        );
      })}

      {/* Hovered band gets a value callout, which keeps the reading precise
          without permanently labelling every column. */}
      {hovered !== null && total > 0 ? (
        <text
          x={padding.left + hovered * bandWidth + bandWidth / 2}
          y={padding.top - 4}
          textAnchor="middle"
          className="tabular fill-ink text-[11px] font-medium"
        >
          {formatValue(data[hovered].values.reduce((a, b) => a + b, 0))}
        </text>
      ) : null}
    </svg>
  );
}

// --- Line chart (multi-series over time) -----------------------------------

export interface LineSeries {
  name: string;
  points: { x: string; y: number }[];
}

/**
 * Multi-series line chart for salary trends.
 *
 * Every series is drawn against a *shared* y-axis, which is the honest choice
 * only because all the series on screen are the same currency — the dashboard
 * filters to one before rendering. A per-series axis would hide exactly the
 * cross-country comparison this is for.
 */
export function LineChart({
  series,
  xLabels,
  formatValue,
  emptyMessage = "No data for this selection.",
}: {
  series: LineSeries[];
  xLabels: string[];
  formatValue: (value: number) => string;
  emptyMessage?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const gradientId = useId();

  const allValues = series.flatMap((s) => s.points.map((p) => p.y));
  if (series.length === 0 || allValues.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  const max = niceCeiling(Math.max(...allValues));
  const min = 0;

  const width = 640;
  const height = 260;
  const padding = { top: 16, right: 16, bottom: 36, left: 56 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xAt = (index: number) =>
    padding.left + (xLabels.length <= 1 ? plotWidth / 2 : (index / (xLabels.length - 1)) * plotWidth);
  const yAt = (value: number) =>
    padding.top + plotHeight - ((value - min) / (max - min)) * plotHeight;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Salary trend over time"
        onMouseLeave={() => setHovered(null)}
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - bounds.left) / bounds.width;
          const index = Math.round(ratio * xLabels.length - 0.5);
          setHovered(index >= 0 && index < xLabels.length ? index : null);
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.14} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {ticks(max - min).map((tick) => {
          const value = min + tick;
          const y = yAt(value);
          return (
            <g key={value}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                className="stroke-line"
                strokeWidth={1}
                strokeDasharray={value === min ? undefined : "3 3"}
              />
              <text
                x={padding.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="central"
                className="tabular fill-muted text-[10px]"
              >
                {shortAxisValue(value)}
              </text>
            </g>
          );
        })}

        {/* One x label per series of labels, thinned so they never overlap. */}
        {xLabels.map((label, index) => {
          const step = Math.max(1, Math.ceil(xLabels.length / 7));
          if (index % step !== 0 && index !== xLabels.length - 1) return null;
          return (
            <text
              key={label + index}
              x={xAt(index)}
              y={height - padding.bottom + 16}
              textAnchor="middle"
              className="fill-muted text-[10px]"
            >
              {label}
            </text>
          );
        })}

        {hovered !== null ? (
          <line
            x1={xAt(hovered)}
            x2={xAt(hovered)}
            y1={padding.top}
            y2={padding.top + plotHeight}
            className="stroke-line-strong"
            strokeWidth={1}
          />
        ) : null}

        {series.map((line, seriesIndex) => {
          if (line.points.length === 0) return null;
          const color = SERIES[seriesIndex % SERIES.length];
          const path = line.points
            .map((point, index) => `${index === 0 ? "M" : "L"}${xAt(index)},${yAt(point.y)}`)
            .join(" ");

          return (
            <g key={line.name}>
              {/* Area under the first series only: with several overlapping,
                  fills turn the chart into mud, and the fill is there to give
                  the primary series weight. */}
              {seriesIndex === 0 && line.points.length > 1 ? (
                <path
                  d={`${path} L${xAt(line.points.length - 1)},${yAt(min)} L${xAt(0)},${yAt(min)} Z`}
                  fill={`url(#${gradientId})`}
                />
              ) : null}
              <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
              {line.points.map((point, index) => (
                <circle
                  key={index}
                  cx={xAt(index)}
                  cy={yAt(point.y)}
                  r={hovered === index ? 4 : 2.5}
                  fill={color}
                  stroke="var(--color-surface)"
                  strokeWidth={hovered === index ? 2 : 0}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend doubles as the hover readout, so the chart needs no floating
          tooltip box to position correctly. */}
      {hovered !== null ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-1 pt-2.5 text-xs">
          <span className="tabular text-muted">{xLabels[hovered]}</span>
          {series.map((line, seriesIndex) => (
            <span key={line.name} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: SERIES[seriesIndex % SERIES.length] }}
              />
              <span className="text-muted">{line.name}</span>
              <span className="tabular font-medium text-ink">
                {formatValue(line.points[hovered]?.y ?? 0)}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line px-1 pt-2.5">
          {series.map((line, seriesIndex) => (
            <span key={line.name} className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className="size-2 rounded-full"
                style={{ background: SERIES[seriesIndex % SERIES.length] }}
              />
              {line.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Donut ----------------------------------------------------------------

export interface DonutDatum {
  label: string;
  value: number;
}

/**
 * A donut for headcount split. Chosen over a pie because the centre can carry
 * the total, which is the number the reader actually wants, and a hole keeps
 * thin slices from rendering as a single ambiguous wedge.
 */
export function DonutChart({
  data,
  total,
  centerLabel,
  centerValue,
}: {
  data: DonutDatum[];
  total: number;
  centerLabel: string;
  centerValue: string;
}) {
  if (data.length === 0 || total <= 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted">No employees to chart.</p>;
  }

  const size = 200;
  const radius = 78;
  const thickness = 26;
  const centre = size / 2;
  // Start at 12 o'clock rather than 3, so the first (largest) slice reads from
  // the top instead of splitting the difference between two axes.
  const startAngle = -90;

  // Each slice starts where the previous one ended. Built with a reduce rather
  // than a running `let`, so the cumulative total is never a mutable binding
  // that outlives the render pass.
  const arcs = data.reduce<
    { datum: DonutDatum; index: number; from: number; to: number }[]
  >((all, datum, index) => {
    const from = all.length > 0 ? all[all.length - 1].to : startAngle;
    const sweep = (datum.value / total) * 360;
    all.push({ datum, index, from, to: from + sweep });
    return all;
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-[190px] shrink-0"
        role="img"
        aria-label={`${centerLabel}: ${centerValue}`}
      >
        {arcs.map(({ datum, index, from, to }) => {
          // A single slice filling the circle cannot be drawn with one arc
          // command — an arc from a to a+360 collapses to nothing — so it is
          // drawn as two 180° halves.
          const sweep = to - from;
          const full = sweep >= 359.99;
          const [start, end] = full ? [from, from + 180] : [from, to];
          const [start2, end2] = full ? [from + 180, from + 360] : [from, to];

          return (
            <g key={datum.label}>
              <path
                d={arcPath(centre, centre, radius, start, end)}
                fill="none"
                stroke={SERIES[index % SERIES.length]}
                strokeWidth={thickness}
                strokeLinecap="butt"
              >
                <title>{`${datum.label}: ${datum.value.toLocaleString("en-US")}`}</title>
              </path>
              {full ? (
                <path
                  d={arcPath(centre, centre, radius, start2, end2)}
                  fill="none"
                  stroke={SERIES[index % SERIES.length]}
                  strokeWidth={thickness}
                />
              ) : null}
            </g>
          );
        })}
        <text
          x={centre}
          y={centre - 6}
          textAnchor="middle"
          className="tabular fill-ink text-[22px] font-semibold"
        >
          {centerValue}
        </text>
        <text x={centre} y={centre + 16} textAnchor="middle" className="fill-muted text-[11px]">
          {centerLabel}
        </text>
      </svg>

      {/* Legend doubles as the value table: the chart is readable, and so is the
          number behind each slice, without a separate table beneath. */}
      <ul className="w-full space-y-1.5">
        {data.map((datum, index) => (
          <li key={datum.label} className="flex items-center gap-2.5 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: SERIES[index % SERIES.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{datum.label}</span>
            <span className="tabular text-muted">
              {datum.value.toLocaleString("en-US")}
            </span>
            <span className="tabular w-11 text-right font-medium text-ink">
              {Math.round((datum.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function arcPath(
  cx: number,
  cy: number,
  radius: number,
  fromAngle: number,
  toAngle: number,
): string {
  const start = polar(cx, cy, radius, toAngle);
  const end = polar(cx, cy, radius, fromAngle);
  const largeArc = toAngle - fromAngle <= 180 ? 0 : 1;
  return `M${start.x},${start.y} A${radius},${radius} 0 ${largeArc} 0 ${end.x},${end.y}`;
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

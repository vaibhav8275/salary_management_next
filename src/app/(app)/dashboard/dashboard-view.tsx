"use client";

import { useMemo, useState } from "react";
import { BarChart, ColumnChart, DonutChart, LineChart } from "@/components/charts";
import { Card, CardHeader } from "@/components/ui";
import { formatMonth, money, moneyShort, parseAmount, parseRange } from "@/lib/format";
import type { DashboardData } from "@/components/dashboard-data";

/**
 * The dashboard.
 *
 * A client component because the currency selection is shared state across five
 * charts: picking GBP should redraw the average, the payroll, the distribution
 * and the trend together. Lifting that into the URL would work too, but it would
 * put a presentational choice in the address bar, and the data is already server
 * rendered — the selection is a view concern.
 */
export function DashboardView(data: DashboardData) {
  const [currency, setCurrency] = useState(data.currencies[0] ?? null);

  // Ten is enough to show the shape without the chart becoming a wall of bars;
  // the longest tail is still on the employees page. The lookup and its `?? []`
  // are inside each `useMemo` so the dependency is the stable record from the
  // server payload rather than a fresh array literal on every render.
  const topDepartments = useMemo(
    () =>
      [...(data.averageByDepartment[currency ?? ""] ?? [])]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10),
    [data.averageByDepartment, currency],
  );

  const topPayroll = useMemo(
    () =>
      [...(data.payrollByCountry[currency ?? ""] ?? [])]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10),
    [data.payrollByCountry, currency],
  );

  // The distribution bands come back in API order (ascending). Sorting by the
  // parsed lower bound is what keeps the columns in ascending order even if the
  // API's bucket definitions change.
  const bands = useMemo(
    () =>
      [...(data.distribution[currency ?? ""] ?? [])]
        .map((row) => ({ label: row.range, lower: parseRange(row.range)[0], count: row.count }))
        .sort((a, b) => a.lower - b.lower),
    [data.distribution, currency],
  );

  /**
   * One line, one x position per effective date.
   *
   * `salary-trends` returns (effective_date, currency, amount) and no country,
   * so the series is the selected currency itself. The rows here are already
   * filtered to it, which is why the inner key is the date and not the currency.
   */
  const { xLabels, series } = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const row of data.trends[currency ?? ""] ?? []) {
      byDate.set(row.effective_date, parseAmount(row.amount));
    }

    const dates = [ ...byDate.keys() ].sort();

    return {
      xLabels: dates.map(formatMonth),
      series: [
        {
          name: currency ?? "salary",
          points: dates.map((date) => ({ x: date, y: byDate.get(date) ?? 0 })),
        },
      ],
    };
  }, [data.trends, currency]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Payroll and headcount across the company.
          </p>
        </div>

        {/* Every monetary figure on this page is per-currency, so the picker
            gates all of them at once rather than each chart inventing a
            default. */}
        {data.currencies.length > 0 ? (
          <div className="flex items-center gap-2">
            <label htmlFor="currency" className="text-xs font-medium text-ink-soft">
              Currency
            </label>
            <select
              id="currency"
              value={currency ?? ""}
              onChange={(event) => setCurrency(event.target.value)}
              className="field w-auto py-1.5 text-sm font-medium"
            >
              {data.currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total headcount"
          value={data.totalHeadcount.toLocaleString("en-US")}
          hint="Across all countries"
        />
        <StatTile
          label="Largest department"
          value={data.largestDepartment?.name ?? "—"}
          hint={
            data.largestDepartment
              ? `${data.largestDepartment.count.toLocaleString("en-US")} people · ${data.largestDepartment.share.toFixed(1)}% of headcount`
              : undefined
          }
        />
        <StatTile
          label="Largest payroll"
          value={data.biggestPayroll ? moneyShort(data.biggestPayroll.amount, data.biggestPayroll.currency) : "—"}
          // The maximum is taken across every (country, currency) pair, so the
          // hint names the row's own currency rather than the selected one —
          // the two can differ.
          hint={data.biggestPayroll ? `${data.biggestPayroll.label} · ${data.biggestPayroll.currency}` : undefined}
        />
        <StatTile
          label="Salary imports"
          value={data.importCount.toLocaleString("en-US")}
          hint="Uploaded CSVs on record"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Average salary by department"
            description={
              currency
                ? `Mean base salary per department, in ${currency}`
                : "Select a currency"
            }
          />
          <div className="p-5">
            <BarChart
              data={topDepartments.map((row) => ({
                label: row.label,
                value: row.amount,
                display: moneyShort(row.amount, currency),
              }))}
              formatValue={(value) => money(value, currency, { compact: true })}
              emptyMessage="No average salary data for this currency."
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Total payroll by country"
            description={currency ? `Annual payroll, in ${currency}` : "Select a currency"}
          />
          <div className="p-5">
            <BarChart
              data={topPayroll.map((row) => ({
                label: row.label,
                value: row.amount,
                display: moneyShort(row.amount, currency),
              }))}
              formatValue={(value) => money(value, currency, { compact: true })}
              colorByIndex={false}
              emptyMessage="No payroll data for this currency."
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Salary distribution"
            description={
              currency ? `Employees per salary band, in ${currency}` : "Select a currency"
            }
          />
          <div className="p-5">
            <ColumnChart
              data={bands.map((band) => ({
                label: band.label,
                values: [ band.count ],
              }))}
              series={[ currency ?? "count" ]}
              formatValue={(value) => `${Math.round(value).toLocaleString("en-US")} employees`}
              emptyMessage="No distribution data for this currency."
            />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Salary trends"
            description={
              currency
                ? `Average base salary over time, in ${currency}`
                : "Select a currency"
            }
          />
          <div className="p-5">
            <LineChart
              series={series}
              xLabels={xLabels}
              formatValue={(value) => money(value, currency, { compact: true })}
              emptyMessage="No trend data for this currency."
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Headcount by department" />
          <div className="p-5">
            <DonutChart
              data={data.headcountByDepartment}
              total={data.totalHeadcount}
              centerLabel="employees"
              centerValue={data.totalHeadcount.toLocaleString("en-US")}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Headcount by country" />
          <div className="p-5">
            <DonutChart
              data={data.headcountByCountry}
              total={data.totalHeadcount}
              centerLabel="employees"
              centerValue={data.totalHeadcount.toLocaleString("en-US")}
            />
          </div>
        </Card>
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="tabular mt-1.5 truncate text-2xl font-semibold text-ink" title={value}>
        {value}
      </p>
      {hint ? <p className="mt-1 truncate text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

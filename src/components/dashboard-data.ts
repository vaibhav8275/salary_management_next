import {
  averageSalaryByDepartment,
  employeeCountByCountry,
  employeeCountByDepartment,
  listImports,
  salaryDistribution,
  salaryTrends,
  totalPayrollByCountry,
} from "@/lib/api";
import { parseAmount } from "@/lib/format";
import type { DistributionRow, TrendRow } from "@/lib/types";

/**
 * Shapes the report endpoints for the dashboard.
 *
 * Two things happen here that are worth stating, because both are forced by the
 * shape of the data rather than by taste:
 *
 * 1. **Currency buckets are built, not assumed.** Every monetary report returns
 *    one row per (group, currency) — `average-salary-by-department` returns
 *    "Customer Support" seven times, once per currency. A chart that drew those
 *    as seven bars would be nonsense, so rows are folded into per-currency
 *    buckets and the UI picks one currency at a time. The available currencies
 *    are read off the data rather than hardcoded, so a new currency appears
 *    without a code change.
 *
 * 2. **Nothing is converted.** The API has no FX table, so converting would
 *    mean inventing rates. A currency selector is the honest alternative.
 */

export interface DepartmentAmount {
  label: string;
  amount: number;
}

export interface CountryAmount {
  label: string;
  amount: number;
}

export interface LabelledCount {
  label: string;
  value: number;
}

export interface DashboardData {
  /** Every currency present in the monetary reports, most-used first. */
  currencies: string[];
  averageByDepartment: Record<string, DepartmentAmount[]>;
  payrollByCountry: Record<string, CountryAmount[]>;
  distribution: Record<string, DistributionRow[]>;
  trends: Record<string, TrendRow[]>;
  headcountByDepartment: LabelledCount[];
  headcountByCountry: LabelledCount[];
  totalHeadcount: number;
  /** Headline figures for the stat tiles. */
  biggestPayroll: { amount: number; currency: string; label: string } | null;
  largestDepartment: { name: string; count: number; share: number } | null;
  importCount: number;
}

export async function loadDashboard(token: string): Promise<DashboardData> {
  const [ averages, payrolls, distribution, trends, byDepartment, byCountry, imports ] =
    await Promise.all([
      averageSalaryByDepartment(token),
      totalPayrollByCountry(token),
      salaryDistribution(token),
      salaryTrends(token),
      employeeCountByDepartment(token),
      employeeCountByCountry(token),
      // The import list rides along so the tile can count uploads, without the
      // dashboard reaching into the imports page.
      listImports(token),
    ]);

  const averageByDepartment: Record<string, DepartmentAmount[]> = {};
  for (const row of averages) {
    if (!row.department) continue;
    (averageByDepartment[row.currency] ??= []).push({
      label: row.department,
      amount: parseAmount(row.amount),
    });
  }

  const payrollByCountry: Record<string, CountryAmount[]> = {};
  for (const row of payrolls) {
    if (!row.country) continue;
    (payrollByCountry[row.currency] ??= []).push({
      label: row.country,
      amount: parseAmount(row.amount),
    });
  }

  const distributionByCurrency: Record<string, DistributionRow[]> = {};
  for (const row of distribution) {
    (distributionByCurrency[row.currency] ??= []).push(row);
  }

  const trendsByCurrency: Record<string, TrendRow[]> = {};
  for (const row of trends) {
    (trendsByCurrency[row.currency] ??= []).push(row);
  }

  // Union of every currency seen, ordered by how many rows mention it, so the
  // busiest currency is the default and the rest stay one click away.
  const tally = new Map<string, number>();
  for (const rows of [ averages, payrolls, distribution, trends ]) {
    for (const row of rows) {
      tally.set(row.currency, (tally.get(row.currency) ?? 0) + 1);
    }
  }
  const currencies = [ ...tally.entries() ]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([ code ]) => code);

  const headcountByDepartment = sortCounts(byDepartment, "department");
  const headcountByCountry = sortCounts(byCountry, "country");

  const totalHeadcount = headcountByCountry.reduce((sum, row) => sum + row.value, 0);
  const topDepartment = headcountByDepartment[0];

  // The biggest payroll is only meaningful within one currency, so this takes
  // the maximum across all (country, currency) pairs and reports the currency
  // it is in — never a cross-currency sum.
  let biggestPayroll: DashboardData["biggestPayroll"] = null;
  for (const [ currency, rows ] of Object.entries(payrollByCountry)) {
    for (const row of rows) {
      if (!biggestPayroll || row.amount > biggestPayroll.amount) {
        biggestPayroll = { amount: row.amount, currency, label: row.label };
      }
    }
  }

  return {
    currencies,
    averageByDepartment,
    payrollByCountry,
    distribution: distributionByCurrency,
    trends: trendsByCurrency,
    headcountByDepartment,
    headcountByCountry,
    totalHeadcount,
    biggestPayroll,
    largestDepartment: topDepartment
      ? {
          name: topDepartment.label,
          count: topDepartment.value,
          share: totalHeadcount ? (topDepartment.value / totalHeadcount) * 100 : 0,
        }
      : null,
    importCount: imports.length,
  };
}

function sortCounts(
  rows: { department?: string; country?: string; count: number }[],
  key: "department" | "country",
): LabelledCount[] {
  return rows
    .filter((row) => row[key])
    .map((row) => ({ label: row[key]!, value: row.count }))
    .sort((a, b) => b.value - a.value);
}

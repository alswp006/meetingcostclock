import type { MeetingRecord, TeamRank } from "@/lib/types";

/** now와 같은 (로컬) 달에 끝난 기록만 팀별로 합산해 비용 내림차순으로 순위를 매긴다. */
export function rankTeams(records: MeetingRecord[], now: Date): TeamRank[] {
  const list = Array.isArray(records) ? records : [];
  const totals = new Map<string, { totalCost: number; count: number }>();
  for (const r of list) {
    const end = new Date(r?.endedAt);
    if (Number.isNaN(end.getTime())) continue;
    if (end.getFullYear() !== now.getFullYear() || end.getMonth() !== now.getMonth()) continue;
    const name = typeof r.teamName === "string" ? r.teamName : "";
    const cur = totals.get(name) ?? { totalCost: 0, count: 0 };
    cur.totalCost += Number(r.totalCost) || 0;
    cur.count += 1;
    totals.set(name, cur);
  }
  const sum = [...totals.values()].reduce((s, t) => s + t.totalCost, 0);
  return [...totals.entries()]
    .sort((a, b) => b[1].totalCost - a[1].totalCost)
    .map(([teamName, t], i) => ({
      rank: i + 1,
      teamName,
      totalCost: t.totalCost,
      count: t.count,
      sharePercent: sum > 0 ? (t.totalCost / sum) * 100 : 0,
    }));
}

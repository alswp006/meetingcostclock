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

/** contract.ts getTeamRankingFn 입력 — contract Record + 앱 MeetingRecord 필드를 모두 허용한다. */
export type RankableRecord = {
  userId?: string;
  teamName?: string;
  durationMs?: number;
  durationSec?: number;
};

/** 기록을 userId(없으면 teamName)별로 합산해 회의 시간(분) 내림차순으로 순위를 매긴다. 동률은 같은 순위. */
export function getTeamRanking(
  records: RankableRecord[],
): { userId: string; totalMinutes: number; rank: number }[] {
  const list = Array.isArray(records) ? records : [];
  const totals = new Map<string, number>();
  for (const r of list) {
    if (!r) continue;
    const id = r.userId || r.teamName || "unknown";
    const ms =
      Number.isFinite(r.durationMs) ? (r.durationMs as number)
      : Number.isFinite(r.durationSec) ? (r.durationSec as number) * 1000
      : 0;
    if (ms <= 0) continue;
    totals.set(id, (totals.get(id) ?? 0) + ms);
  }
  const sorted = [...totals.entries()]
    .map(([userId, ms]) => ({ userId, totalMinutes: Math.round(ms / 60000) }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes || a.userId.localeCompare(b.userId));
  let prev = -1;
  let prevRank = 0;
  return sorted.map((t, i) => {
    const rank = t.totalMinutes === prev ? prevRank : i + 1;
    prev = t.totalMinutes;
    prevRank = rank;
    return { ...t, rank };
  });
}

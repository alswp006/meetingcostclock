import { MIN_SAVE_SEC, STORAGE_KEY_ACTIVE, STORAGE_KEY_NO_MEETING_DAYS, STORAGE_KEY_RECORDS } from "@/lib/constants";
import { calcCost } from "@/lib/cost";
import { getElapsedSec, localDateKeysBetween, resolveStale } from "@/lib/meetingTime";
import { loadActive, parseArray, readRaw, saveActive, writeRaw } from "@/lib/storageBase";
import { saveRecord } from "@/lib/storageRecords";
import type { Record as ContractRecord, Meeting as ContractMeeting } from "@/lib/contract";
import type { ActiveMeeting, FinalizeResult, MeetingRecord, SaveResult } from "@/lib/types";

function snapshot(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function restore(key: string, raw: string | null): void {
  try {
    if (raw === null) localStorage.removeItem(key);
    else localStorage.setItem(key, raw);
  } catch {
    // 복원 실패는 더 할 수 있는 게 없다
  }
}

function fail(r: SaveResult): FinalizeResult {
  return { ok: false, reason: !r.ok && r.reason === "quota" ? "quota" : "unknown" };
}

/**
 * active를 endMs 시점으로 확정한다.
 * 순서: 스냅샷 → NoMeetingDay 취소 → records upsert → active=null. 실패하면 역순 롤백.
 */
export function finalizeAt(
  active: ActiveMeeting,
  endMs: number,
  autoClosed: "elapsed_cap" | "wall_cap" | null,
): FinalizeResult {
  const durationSec = getElapsedSec(active, endMs);
  if (durationSec < MIN_SAVE_SEC) {
    saveActive(null);
    return { ok: false, reason: "too_short" };
  }

  const snapDays = snapshot(STORAGE_KEY_NO_MEETING_DAYS);
  const snapRecords = snapshot(STORAGE_KEY_RECORDS);
  const snapActive = snapshot(STORAGE_KEY_ACTIVE);
  // 쓰기 순서의 역순으로, 실제로 건드린 키만 복원한다
  const rollback = (touched: { days?: boolean; records?: boolean; active?: boolean }) => {
    if (touched.active) restore(STORAGE_KEY_ACTIVE, snapActive);
    if (touched.records) restore(STORAGE_KEY_RECORDS, snapRecords);
    if (touched.days) restore(STORAGE_KEY_NO_MEETING_DAYS, snapDays);
  };

  const keys = new Set(localDateKeysBetween(active.startedAt, endMs));
  const p = parseArray(readRaw(STORAGE_KEY_NO_MEETING_DAYS));
  const days = p.ok ? p.items : [];
  const dateOf = (d: unknown): string | null => {
    const v = typeof d === "object" && d !== null ? (d as { date?: unknown }).date : null;
    return typeof v === "string" ? v : null;
  };
  const cancelledDates = days.map(dateOf).filter((v): v is string => v !== null && keys.has(v));
  if (cancelledDates.length > 0) {
    const w = writeRaw(
      STORAGE_KEY_NO_MEETING_DAYS,
      days.filter((d) => !keys.has(dateOf(d) ?? "")),
    );
    if (!w.ok) {
      rollback({ days: true });
      return fail(w);
    }
  }

  const { setup } = active;
  const totalCost = calcCost(setup.attendees, setup.annualSalaryManwon, durationSec);
  const now = new Date().toISOString();
  const draft: Omit<MeetingRecord, "createdAt" | "updatedAt"> = {
    id: active.id,
    title: setup.title,
    teamName: setup.teamName,
    attendees: setup.attendees,
    annualSalaryManwon: setup.annualSalaryManwon,
    plannedMinutes: setup.plannedMinutes,
    startedAt: new Date(active.startedAt).toISOString(),
    endedAt: new Date(endMs).toISOString(),
    durationSec,
    totalCost,
    outcome: null,
    wasteCost: null,
    reportUnlocked: false,
    shareUnlocked: false,
  };
  const saved = saveRecord({ ...draft, createdAt: now, updatedAt: now });
  if (!saved.ok) {
    rollback({ days: cancelledDates.length > 0, active: true });
    return fail(saved);
  }

  const cleared = saveActive(null);
  if (!cleared.ok) {
    rollback({ days: cancelledDates.length > 0, records: true, active: true });
    return fail(cleared);
  }

  const record: MeetingRecord = { ...draft, createdAt: now, updatedAt: now };
  return {
    ok: true,
    record,
    cancelledNoMeetingDates: cancelledDates,
    noMeetingCancelled: cancelledDates.length > 0,
    autoClosed,
  };
}

export function finalizeActive(now: number): FinalizeResult {
  const active = loadActive();
  if (!active) return { ok: false, reason: "no_active" };
  const stale = resolveStale(active, now);
  if (stale.stale) return finalizeAt(active, stale.endedAtMs, stale.reason);
  return finalizeAt(active, now, null);
}

function toDateKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 계약(contract.ts) 시그니처의 회의 종료.
 * 'confirmed'는 진행 중 회의를 지금 시각으로 확정해 기록을 돌려주고, 'discarded'는 기록 없이 버린다.
 * 진행 중 회의가 없거나 id가 다르거나 저장에 실패하면 null.
 */
export async function finalizeMeeting(
  meeting: ContractMeeting,
  finalizeMode: "confirmed" | "discarded",
): Promise<ContractRecord | null> {
  const active = loadActive();
  if (!active || active.id !== meeting.id) return null;
  if (finalizeMode === "discarded") {
    saveActive(null);
    return null;
  }
  const result = finalizeActive(Date.now());
  if (!result.ok) return null;
  const { record } = result;
  return {
    id: record.id,
    meetingId: record.id,
    date: toDateKey(new Date(record.startedAt).getTime()),
    durationMs: record.durationSec * 1000,
    costKrw: record.totalCost,
  };
}

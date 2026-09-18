import { isMeetingSetupInput } from "@/lib/schema";
import { finalizeActive } from "@/lib/finalize";
import { loadActive, newId, saveActive, saveLastSetup } from "@/lib/storageBase";
import type { ActiveMeeting, MeetingSetupInput, SaveResult } from "@/lib/types";

export type StartResult =
  | { ok: true; active: ActiveMeeting }
  | { ok: false; reason: "invalid" | "quota" | "unknown" };

/** 새 회의 시작. 진행 중인 회의가 있으면 먼저 저장(확정)한다. */
export function startMeeting(setup: MeetingSetupInput, now: number): StartResult {
  if (!isMeetingSetupInput(setup)) return { ok: false, reason: "invalid" };
  if (loadActive()) {
    const prev = finalizeActive(now);
    if (!prev.ok && (prev.reason === "quota" || prev.reason === "unknown")) {
      return { ok: false, reason: prev.reason };
    }
  }
  const iso = new Date(now).toISOString();
  const active: ActiveMeeting = {
    id: newId(),
    setup: { ...setup },
    startedAt: now,
    pausedAt: null,
    totalPausedMs: 0,
    createdAt: iso,
    updatedAt: iso,
  };
  const saved = saveActive(active);
  if (!saved.ok) return { ok: false, reason: saved.reason === "quota" ? "quota" : "unknown" };
  saveLastSetup(setup);
  return { ok: true, active };
}

export function pauseMeeting(now: number): SaveResult {
  const active = loadActive();
  if (!active) return { ok: false, reason: "not_found" };
  if (active.pausedAt !== null) return { ok: true };
  return saveActive({ ...active, pausedAt: now, updatedAt: new Date(now).toISOString() });
}

export function resumeMeeting(now: number): SaveResult {
  const active = loadActive();
  if (!active) return { ok: false, reason: "not_found" };
  if (active.pausedAt === null) return { ok: true };
  const paused = Math.max(0, now - active.pausedAt);
  return saveActive({
    ...active,
    pausedAt: null,
    totalPausedMs: active.totalPausedMs + paused,
    updatedAt: new Date(now).toISOString(),
  });
}

export { finalizeActive, finalizeMeeting } from "@/lib/finalize";
export { autoFinalizeStale, resetAutoFinalizeRetries } from "@/lib/autoFinalize";

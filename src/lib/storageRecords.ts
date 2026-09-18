import { HISTORY_PAGE_SIZE, STORAGE_KEY_MEETINGS, STORAGE_KEY_RECORDS } from "@/lib/constants";
import type { Meeting, Record as ContractRecord } from "@/lib/contract";
import { normalizeRecords } from "@/lib/schema";
import { newId, parseArray, readRaw, writeRaw } from "@/lib/storageBase";
import type { MeetingRecord, Page, SaveResult } from "@/lib/types";

export type RecordInput = Omit<MeetingRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<MeetingRecord, "id" | "createdAt" | "updatedAt">>;

/** 저장된 기록 전체. 손상된 값은 빈 목록 + error로 돌려준다(쓰지 않는다). */
function readRecords():
  | { ok: true; records: MeetingRecord[] }
  | { ok: false; error: "corrupted" | "unavailable" } {
  const p = parseArray(readRaw(STORAGE_KEY_RECORDS));
  return p.ok ? { ok: true, records: normalizeRecords(p.items) } : p;
}

/** id 기준 upsert. createdAt은 유지하고 updatedAt만 갱신. 500건 초과 시 endedAt이 가장 오래된 행부터 삭제. */
export function saveRecord(r: RecordInput): SaveResult {
  const cur = readRecords();
  if (!cur.ok && cur.error === "unavailable") return { ok: false, reason: "unknown" };
  const list = cur.ok ? cur.records : []; // 손상 데이터는 어차피 읽을 수 없으므로 덮어쓴다
  const id = r.id ?? newId();
  const now = new Date().toISOString();
  const prev = list.find((x) => x.id === id);
  const next: MeetingRecord = {
    ...r,
    id,
    createdAt: prev?.createdAt ?? r.createdAt ?? now,
    updatedAt: now,
  };
  const merged = [...list.filter((x) => x.id !== id), next];
  return writeRaw(STORAGE_KEY_RECORDS, normalizeRecords(merged));
}

export function getRecord(id: string): MeetingRecord | null {
  const cur = readRecords();
  return cur.ok ? (cur.records.find((x) => x.id === id) ?? null) : null;
}

export function updateRecord(id: string, patch: Partial<MeetingRecord>): SaveResult {
  const cur = readRecords();
  if (!cur.ok) return { ok: false, reason: cur.error === "corrupted" ? "not_found" : "unknown" };
  const prev = cur.records.find((x) => x.id === id);
  if (!prev) return { ok: false, reason: "not_found" };
  const next: MeetingRecord = {
    ...prev,
    ...patch,
    id: prev.id,
    createdAt: prev.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const merged = cur.records.map((x) => (x.id === id ? next : x));
  return writeRaw(STORAGE_KEY_RECORDS, normalizeRecords(merged));
}

export function deleteRecord(id: string): SaveResult {
  const cur = readRecords();
  if (!cur.ok) return { ok: false, reason: cur.error === "corrupted" ? "not_found" : "unknown" };
  if (!cur.records.some((x) => x.id === id)) return { ok: false, reason: "not_found" };
  return writeRaw(
    STORAGE_KEY_RECORDS,
    cur.records.filter((x) => x.id !== id),
  );
}

export function loadRecordsPage(offset: number): Page<MeetingRecord> {
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const page = Math.floor(start / HISTORY_PAGE_SIZE) + 1;
  const cur = readRecords();
  if (!cur.ok) return { items: [], total: 0, page, error: cur.error };
  return {
    items: cur.records.slice(start, start + HISTORY_PAGE_SIZE),
    total: cur.records.length,
    page,
  };
}

const MEETING_STATES = ["active", "paused", "finalized"];

function isMeeting(v: unknown): v is Meeting {
  if (typeof v !== "object" || v === null) return false;
  const m = v as { [k: string]: unknown };
  return (
    typeof m.id === "string" &&
    typeof m.startedAt === "string" &&
    typeof m.state === "string" &&
    MEETING_STATES.includes(m.state) &&
    typeof m.pausedMs === "number" &&
    typeof m.hourlyRate === "number" &&
    typeof m.timezone === "string"
  );
}

/** 회의 upsert(id 기준). 저장 실패(용량/접근 불가)는 reject. */
export async function saveMeeting(meeting: Meeting): Promise<void> {
  const p = parseArray(readRaw(STORAGE_KEY_MEETINGS));
  if (!p.ok && p.error === "unavailable") throw new Error("storage unavailable");
  const list = p.ok ? p.items.filter(isMeeting) : []; // 손상 데이터는 덮어쓴다
  const res = writeRaw(STORAGE_KEY_MEETINGS, [...list.filter((m) => m.id !== meeting.id), meeting]);
  if (!res.ok) throw new Error(`save failed: ${res.reason}`);
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const p = parseArray(readRaw(STORAGE_KEY_MEETINGS));
  return p.ok ? (p.items.filter(isMeeting).find((m) => m.id === id) ?? null) : null;
}

function toContractRecord(r: MeetingRecord): ContractRecord {
  return {
    id: r.id,
    meetingId: r.id,
    date: r.startedAt.slice(0, 10),
    durationMs: r.durationSec * 1000,
    costKrw: r.totalCost,
  };
}

/** 저장된 기록을 계약 모양으로 조회. 날짜는 YYYY-MM-DD 포함 범위, 최신순. */
export async function createQuery(opts: {
  meetingIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<ContractRecord[]> {
  const cur = readRecords();
  if (!cur.ok) return [];
  const { meetingIds, dateFrom, dateTo, limit, offset } = opts;
  const rows = cur.records
    .slice()
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
    .map(toContractRecord)
    .filter(
      (r) =>
        (!meetingIds || meetingIds.includes(r.meetingId)) &&
        (!dateFrom || r.date >= dateFrom) &&
        (!dateTo || r.date <= dateTo),
    );
  const start = offset !== undefined && Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const end = limit !== undefined && Number.isFinite(limit) && limit >= 0 ? start + Math.floor(limit) : undefined;
  return rows.slice(start, end);
}

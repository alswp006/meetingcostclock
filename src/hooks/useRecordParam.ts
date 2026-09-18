import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { getRecord } from "@/lib/storage";
import type { MeetingRecord } from "@/lib/types";

function normalizeId(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    // 잘못된 퍼센트 인코딩은 원문 그대로 조회한다
    return raw.trim();
  }
}

/** 라우트 :id 파라미터로 저장된 회의 기록을 조회한다. 없거나 읽기 실패면 null. */
export function useRecordParam(): MeetingRecord | null {
  const { id } = useParams<{ id: string }>();
  const recordId = normalizeId(id);

  return useMemo(() => {
    if (!recordId) return null;
    try {
      return getRecord(recordId) ?? null;
    } catch {
      return null;
    }
  }, [recordId]);
}

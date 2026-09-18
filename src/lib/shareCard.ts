import type { MeetingRecord } from "@/lib/types";
import { calcWaste } from "@/lib/cost";
import { formatWon, formatDuration } from "@/lib/format";

function wasteOf(record: MeetingRecord): number | null {
  if (typeof record.wasteCost === "number") return record.wasteCost;
  if (!record.outcome) return null;
  return calcWaste(record, record.outcome).wasteCost;
}

export function buildShareText(record: MeetingRecord): string {
  const lines = [
    `'${record.title}' 회의, ${formatWon(record.totalCost)}이 들었어요`,
    `${record.teamName} · ${record.attendees}명 · ${formatDuration(record.durationSec * 1000)}`,
  ];
  const waste = wasteOf(record);
  if (waste !== null) lines.push(`이 중 낭비된 비용은 ${formatWon(waste)}`);
  return lines.join("\n");
}

function token(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

export function renderShareCard(canvas: HTMLCanvasElement, record: MeetingRecord): { ok: boolean } {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false };
    const w = 600;
    const h = 400;
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = token("--tds-color-background", "Canvas");
    ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = "top";
    ctx.fillStyle = token("--tds-color-grey700", "CanvasText");
    ctx.font = "600 24px sans-serif";
    ctx.fillText(record.title, 40, 40, w - 80);
    ctx.fillStyle = token("--tds-color-blue500", "CanvasText");
    ctx.font = "700 56px sans-serif";
    ctx.fillText(formatWon(record.totalCost), 40, 140, w - 80);
    ctx.fillStyle = token("--tds-color-grey600", "CanvasText");
    ctx.font = "400 22px sans-serif";
    ctx.fillText(`${record.attendees}명 · ${formatDuration(record.durationSec * 1000)}`, 40, 240, w - 80);
    const waste = wasteOf(record);
    if (waste !== null) ctx.fillText(`낭비된 비용 ${formatWon(waste)}`, 40, 290, w - 80);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

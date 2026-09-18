import { Paragraph, Spacing } from "@toss/tds-mobile";
import { Card } from "@/components/Card";
import { CountUp } from "@/components/CountUp";
import { MiniBar } from "@/components/MiniBar";
import { SummaryHero } from "@/components/SummaryHero";
import { calcHourly, calcWaste } from "@/lib/cost";
import { formatWon } from "@/lib/format";
import type { MeetingOutcome, MeetingRecord } from "@/lib/types";

const OUTCOME_TEXT: Record<MeetingOutcome, string> = {
  decided: "결론이 난 회의였어요",
  partial: "일부만 결론이 난 회의였어요",
  none: "결론 없이 끝난 회의였어요",
};

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div
      data-testid={testId}
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, minHeight: 48 }}
    >
      <Paragraph.Text typography="t6">{label}</Paragraph.Text>
      <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        <Paragraph.Text typography="t6">{value}</Paragraph.Text>
      </span>
    </div>
  );
}

export function ReportBody({ record, outcome }: { record: MeetingRecord; outcome: MeetingOutcome }) {
  const waste = calcWaste(record, outcome);
  const minutes = Math.max(1, Math.round(record.durationSec / 60));
  const overtimeMin = Math.round(waste.overtimeSec / 60);
  const team = calcHourly(record.attendees, record.annualSalaryManwon).team;

  return (
    <>
      <SummaryHero
        testId="report-hero"
        label="이번 회의 비용"
        value={<CountUp value={waste.totalCost} />}
        caption={`${minutes}분 · ${record.attendees}명 · 팀 시급 ${formatWon(team)}`}
      />
      <Spacing size={16} />
      <Card testId="report-waste-card">
        <Row label="기본 비용" value={formatWon(waste.baseCost)} />
        <Row label={`초과 비용 (${overtimeMin}분)`} value={formatWon(waste.overtimeCost)} />
        <Row label={`낭비 추정 (${waste.wasteRate}%)`} value={formatWon(waste.wasteCost)} />
        <Paragraph.Text typography="st6" color="tertiary">
          초과 시간 비용 + 결론 여부에 따른 비율로 계산해요
        </Paragraph.Text>
        <Spacing size={12} />
        <MiniBar ratio={waste.wasteRate / 100} testId="waste-bar" />
        <Spacing size={12} />
        <Paragraph.Text typography="t6">{OUTCOME_TEXT[outcome]}</Paragraph.Text>
      </Card>
    </>
  );
}

export default ReportBody;

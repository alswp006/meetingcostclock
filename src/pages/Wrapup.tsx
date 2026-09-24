import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Chip, ChipItem, Paragraph, Spacing, Toast, Top } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SummaryHero } from "@/components/SummaryHero";
import { CountUp } from "@/components/CountUp";
import { SubmitFooter } from "@/components/BottomCTA";
import { RecordNotFound } from "@/components/RecordNotFound";
import { useRecordParam } from "@/hooks/useRecordParam";
import { useToastQueue } from "@/hooks/useToastQueue";
import { calcWaste } from "@/lib/cost";
import { formatDurationLabel } from "@/lib/format";
import { QUOTA_TOAST } from "@/lib/messages";
import { updateRecord } from "@/lib/storage";
import type { MeetingOutcome } from "@/lib/types";

// TDS Chip은 그룹 컨테이너(div)이고 개별 칩은 ChipItem(button, selected/onClick)이다 — 둘 다 최상위 export.
// (Chip 자체에 selected/onClick을 주면 알약이 아니라 맨 텍스트로 렌더되고 선택 표시도 안 난다.)
const OPTIONS: { value: MeetingOutcome; label: string }[] = [
  { value: "decided", label: "결론 났어요" },
  { value: "partial", label: "일부만 났어요" },
  { value: "none", label: "결론이 없었어요" },
];

function tick() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export default function Wrapup() {
  const record = useRecordParam();
  const toast = useToastQueue();
  const [outcome, setOutcome] = useState<MeetingOutcome | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (!record) return <RecordNotFound />;
  if (done) return <Navigate to={`/report/${record.id}`} replace />;

  const submit = () => {
    if (!outcome || saving) return;
    setSaving(true);
    try {
      const { wasteCost } = calcWaste(record, outcome);
      const res = updateRecord(record.id, { outcome, wasteCost });
      if (res.ok) {
        setDone(true);
        return;
      }
      toast.push(res.reason === "quota" ? QUOTA_TOAST : "저장하지 못했어요. 다시 시도해 주세요");
    } catch {
      toast.push("저장하지 못했어요. 다시 시도해 주세요");
    }
    setSaving(false);
  };

  return (
    <ScreenScaffold
      top={<Top title="회의는 어땠어요?" />}
      bottom={
        <SubmitFooter
          label="리포트 보기"
          disabled={!outcome}
          loading={saving}
          onClick={submit}
          hint={outcome ? undefined : "결론 여부를 고르면 리포트를 볼 수 있어요"}
        />
      }
    >
      <Spacing size={16} />
      <SummaryHero
        testId="wrapup-summary"
        label="이번 회의 비용"
        value={<CountUp value={record.totalCost} />}
        caption={`${formatDurationLabel(record.durationSec)} · ${record.attendees}명`}
      />
      <Spacing size={24} />
      <Paragraph.Text typography="t5">결론이 났나요?</Paragraph.Text>
      <Spacing size={8} />
      <Chip kind="select" margin="none" wrap>
        {OPTIONS.map((o) => (
          <ChipItem
            key={o.value}
            selected={outcome === o.value}
            onClick={() => {
              tick();
              setOutcome(o.value);
            }}
          >
            {o.label}
          </ChipItem>
        ))}
      </Chip>
      <Toast open={toast.current !== null} position="bottom" text={toast.current ?? ""} onClose={toast.dismiss} />
    </ScreenScaffold>
  );
}

import { useState } from "react";
import type React from "react";
import { Navigate } from "react-router-dom";
import { Chip, Paragraph, Spacing, Toast, Top } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card } from "@/components/Card";
import { SubmitFooter } from "@/components/BottomCTA";
import { RecordNotFound } from "@/components/RecordNotFound";
import { useRecordParam } from "@/hooks/useRecordParam";
import { useToastQueue } from "@/hooks/useToastQueue";
import { calcWaste } from "@/lib/cost";
import { formatWon } from "@/lib/format";
import { QUOTA_TOAST } from "@/lib/messages";
import { updateRecord } from "@/lib/storage";
import type { MeetingOutcome } from "@/lib/types";

// 패킷 계약: 옵션 하나가 selected/onClick을 받는 Chip이다(.d.ts엔 그룹 props만 있어 느슨하게 캐스팅).
const SelectChip = Chip as unknown as React.ComponentType<{
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}>;

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

  const minutes = Math.max(1, Math.round(record.durationSec / 60));

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
        <SubmitFooter label="리포트 보기" disabled={!outcome} loading={saving} onClick={submit} />
      }
    >
      <Spacing size={16} />
      <Card testId="wrapup-summary">
        <Paragraph.Text typography="st6" color="secondary">
          이번 회의 비용
        </Paragraph.Text>
        <Paragraph.Text typography="t2">{formatWon(record.totalCost)}</Paragraph.Text>
        <Paragraph.Text typography="st5" color="secondary">
          {minutes}분 · {record.attendees}명
        </Paragraph.Text>
      </Card>
      <Spacing size={24} />
      <Paragraph.Text typography="t5">결론이 났나요?</Paragraph.Text>
      <Spacing size={8} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {OPTIONS.map((o) => (
          <SelectChip
            key={o.value}
            selected={outcome === o.value}
            onClick={() => {
              tick();
              setOutcome(o.value);
            }}
          >
            {o.label}
          </SelectChip>
        ))}
      </div>
      <Toast open={toast.current !== null} position="bottom" text={toast.current ?? ""} onClose={toast.dismiss} />
    </ScreenScaffold>
  );
}

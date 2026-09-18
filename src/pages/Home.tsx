import { useEffect, useMemo, useState } from "react";
import { Asset, Button, ListRow, Paragraph, Spacing, Top } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { useNavigate } from "react-router-dom";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SummaryHero } from "@/components/SummaryHero";
import { Card } from "@/components/Card";
import { CountUp } from "@/components/CountUp";
import { EmptyState } from "@/components/StateView";
import { SubmitFooter } from "@/components/BottomCTA";
import { calcCost } from "@/lib/cost";
import { formatWon } from "@/lib/format";
import { getElapsedSec } from "@/lib/meetingTime";
import { STORAGE_KEY_RECORDS } from "@/lib/constants";
import { loadActive, readRaw } from "@/lib/storage";
import { weekSummary } from "@/lib/weekSummary";
import type { MeetingRecord } from "@/lib/types";

function fireHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

/** 저장된 기록 전체. 홈은 표시 전용이라 엄격 검증 대신 필수 필드만 확인한다(일부 손상 행이 나머지를 가리지 않게). */
function loadAllRecords(): MeetingRecord[] {
  const raw = readRaw(STORAGE_KEY_RECORDS);
  if (!raw.ok || !Array.isArray(raw.value)) return [];
  return raw.value.filter(
    (r): r is MeetingRecord =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as MeetingRecord).id === "string" &&
      typeof (r as MeetingRecord).title === "string" &&
      Number.isFinite(Date.parse((r as MeetingRecord).endedAt)),
  );
}

function subtitle(r: MeetingRecord): string {
  const d = new Date(r.endedAt);
  const minutes = Math.max(1, Math.round((Number(r.durationSec) || 0) / 60));
  return `${d.getMonth() + 1}월 ${d.getDate()}일 · ${minutes}분 · ${r.attendees}명`;
}

export default function Home() {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [records] = useState<MeetingRecord[]>(() => loadAllRecords());
  const [active] = useState(() => loadActive());

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const { weekTotal, weekCount, recent3 } = useMemo(
    () => weekSummary(records, now),
    // 주간 집계는 초 단위로 다시 계산할 필요가 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records],
  );

  const liveCost = active
    ? calcCost(active.setup.attendees, active.setup.annualSalaryManwon, getElapsedSec(active, now))
    : 0;
  const hasRecords = records.length > 0;

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>회의비용 시계</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label={active ? "진행 중인 회의로 이동" : "새 회의 시작"}
          onClick={() => { navigate(active ? "/meeting" : "/setup"); }}
        />
      }
    >
      <Spacing size={16} />
      {active && (
        <>
          <Card testId="active-meeting-card">
            <Paragraph.Text typography="st6" color="secondary">
              진행 중 · {active.setup.title}
            </Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="t2">{formatWon(liveCost)}</Paragraph.Text>
            <Spacing size={12} />
            <Button
              variant="weak"
              size="large"
              display="block"
              onClick={() => {
                fireHaptic("success");
                navigate("/meeting");
              }}
            >
              이어서 보기
            </Button>
          </Card>
          <Spacing size={16} />
        </>
      )}
      {hasRecords ? (
        <>
          <SummaryHero
            testId="week-summary-hero"
            label="이번 주 회의 비용"
            value={<CountUp value={weekTotal} />}
            caption={`이번 주 회의 ${weekCount}회`}
          />
          <Spacing size={24} />
          <Paragraph.Text typography="t5">최근 회의</Paragraph.Text>
          <Spacing size={8} />
          {recent3.map((r) => (
            <ListRow
              key={r.id}
              contents={<ListRow.Texts type="2RowTypeA" top={r.title} bottom={subtitle(r)} />}
              right={<Paragraph.Text typography="st5">{formatWon(r.totalCost)}</Paragraph.Text>}
              onClick={() => {
                fireHaptic("tickWeak");
                navigate(r.outcome ? `/report/${r.id}` : `/wrapup/${r.id}`);
              }}
            />
          ))}
          <Spacing size={8} />
          <Button variant="weak" size="medium" display="block" onClick={() => navigate("/history")}>
            전체 보기
          </Button>
        </>
      ) : (
        !active && (
          <EmptyState
            icon={
              <Asset.ContentIcon
                name="icon-search-bold-mono"
                alt=""
                style={{ width: 48, height: 48 }}
              />
            }
            title="회의 한 번에 얼마가 드는지 확인해보세요"
          />
        )
      )}
      <Spacing size={120} />
    </ScreenScaffold>
  );
}

import { Navigate, useNavigate } from "react-router-dom";
import { Button, Spacing, Top } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { RecordNotFound } from "@/components/RecordNotFound";
import { TossRewardAd } from "@/components/TossRewardAd";
import { ReportBody } from "@/components/report/ReportBody";
import { useRecordParam } from "@/hooks/useRecordParam";
import { updateRecord } from "@/lib/storage";
import type { RouteState } from "@/lib/types";

export default function Report() {
  const record = useRecordParam();
  const navigate = useNavigate();

  if (!record) return <RecordNotFound />;
  if (record.outcome === null) return <Navigate to={`/wrapup/${record.id}`} replace />;
  const outcome = record.outcome;

  // 저장 실패해도 이번 열람에서는 본문을 보여준다(게이트는 이미 열림).
  const unlock = () => {
    try {
      updateRecord(record.id, { reportUnlocked: true });
    } catch {
      /* 무시 */
    }
  };

  const restart = () => {
    const state: RouteState["/setup"] = {
      prefill: {
        title: record.title,
        teamName: record.teamName,
        attendees: record.attendees,
        annualSalaryManwon: record.annualSalaryManwon,
        plannedMinutes: record.plannedMinutes,
      },
    };
    navigate("/setup", { state });
  };

  const share = () => {
    try {
      Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
    } catch {
      /* WebView 밖에서는 throw — 무시 */
    }
    navigate(`/report/${record.id}/card`);
  };

  const body = <ReportBody record={record} outcome={outcome} />;

  return (
    <ScreenScaffold
      top={
        <Top
          title={
            <Top.TitleParagraph>{record.title} 리포트</Top.TitleParagraph>
          }
        />
      }
      bottom={<SubmitFooter label="같은 설정으로 다시 시작" onClick={restart} />}
    >
      <Spacing size={16} />
      {record.reportUnlocked ? (
        body
      ) : (
        <TossRewardAd
          slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}
          onRewarded={unlock}
          description="광고를 보면 낭비 분석 리포트를 확인할 수 있어요"
        >
          {body}
        </TossRewardAd>
      )}
      <Spacing size={24} />
      <Button variant="weak" size="large" display="block" onClick={share}>
        공유 카드 만들기
      </Button>
      <Spacing size={96} />
    </ScreenScaffold>
  );
}

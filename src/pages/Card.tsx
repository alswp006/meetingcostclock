import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button, Paragraph, Spacing, Toast, Top } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card as CardBox } from "@/components/Card";
import { RecordNotFound } from "@/components/RecordNotFound";
import { TossRewardAd } from "@/components/TossRewardAd";
import { CardActions } from "@/components/card/CardActions";
import { useRecordParam } from "@/hooks/useRecordParam";
import { useToastQueue } from "@/hooks/useToastQueue";
import { renderShareCard } from "@/lib/shareCard";
import { updateRecord } from "@/lib/storage";
import { QUOTA_TOAST } from "@/lib/messages";
import type { MeetingRecord } from "@/lib/types";

function CardView({ record, onToast }: { record: MeetingRecord; onToast: (m: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    let ok = false;
    try {
      ok = canvas ? renderShareCard(canvas, record).ok : false;
    } catch {
      ok = false;
    }
    setFailed(!ok);
  }, [record]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <>
      <CardBox testId="share-card">
        <canvas ref={canvasRef} style={{ width: "100%", display: failed ? "none" : "block" }} />
        {failed && (
          <>
            <Paragraph.Text typography="t5">카드를 만들지 못했어요</Paragraph.Text>
            <Spacing size={12} />
            <Button variant="weak" display="block" onClick={draw}>
              다시 시도
            </Button>
          </>
        )}
      </CardBox>
      <Spacing size={24} />
      <CardActions record={record} canvasRef={canvasRef} onToast={onToast} />
    </>
  );
}

export default function Card() {
  const record = useRecordParam();
  const toast = useToastQueue();
  const [unlocked, setUnlocked] = useState(false);

  if (!record) return <RecordNotFound />;
  if (record.outcome === null) return <Navigate to={`/wrapup/${record.id}`} replace />;
  if (!record.reportUnlocked) return <Navigate to={`/report/${record.id}`} replace />;

  const open = record.shareUnlocked || unlocked;
  const onRewarded = () => {
    try {
      const r = updateRecord(record.id, { shareUnlocked: true, updatedAt: new Date().toISOString() });
      if (!r.ok) toast.push(r.reason === "quota" ? QUOTA_TOAST : "카드 해제를 저장하지 못했어요. 다시 시도해 주세요");
    } catch {
      /* 저장 실패해도 이번 화면에서는 열어 둔다 */
    }
    setUnlocked(true);
  };

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>공유 카드</Top.TitleParagraph>} />}>
      <Spacing size={16} />
      {open ? (
        <CardView record={record} onToast={toast.push} />
      ) : (
        <TossRewardAd
          slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID ?? "share-card"}
          description="광고를 보면 공유 카드를 만들 수 있어요"
          buttonText="광고 보고 카드 만들기"
          onRewarded={onRewarded}
        >
          <CardView record={record} onToast={toast.push} />
        </TossRewardAd>
      )}
      <Toast open={toast.current !== null} position="bottom" text={toast.current ?? ""} onClose={toast.dismiss} />
    </ScreenScaffold>
  );
}

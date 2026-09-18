import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ConfirmDialog, Spacing, Toast, Top } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { AdSlot } from "@/components/AdSlot";
import { TimerDisplay } from "@/components/meeting/TimerDisplay";
import { useActiveMeeting } from "@/hooks/useActiveMeeting";
import { useNow } from "@/hooks/useNow";
import { useToastQueue } from "@/hooks/useToastQueue";
import { autoFinalizeStale } from "@/lib/autoFinalize";
import {
  AUTO_CLOSED_12H,
  AUTO_CLOSED_8H,
  NO_MEETING_CANCELLED,
  QUOTA_TOAST,
  TOO_SHORT,
} from "@/lib/messages";
import type { FinalizeResult } from "@/lib/types";

function fireHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export default function Meeting() {
  const navigate = useNavigate();
  const { active, pause, resume, finalize, refresh } = useActiveMeeting();
  const now = useNow();
  const toast = useToastQueue();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const leaving = useRef(false);

  // 만료된 active는 진입 시 한 번 자동 종료한다
  useEffect(() => {
    const r = autoFinalizeStale(Date.now());
    if (r.status === "not_stale") return;
    refresh();
    if (r.status !== "done") return;
    if (r.showQuotaToast) toast.push(QUOTA_TOAST);
    toast.push(r.staleReason === "wall_cap" ? AUTO_CLOSED_12H : AUTO_CLOSED_8H);
    if (r.result.ok) {
      leaving.current = true;
      navigate(`/wrapup/${r.result.record.id}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active && !leaving.current) navigate("/", { replace: true });
  }, [active, navigate]);

  if (!active) return null;

  const paused = active.pausedAt !== null;

  const onTogglePause = () => {
    fireHaptic("tickWeak");
    const r = paused ? resume() : pause();
    if (!r.ok && r.reason === "quota") toast.push(QUOTA_TOAST);
  };

  const onConfirmEnd = () => {
    fireHaptic("success");
    setConfirmOpen(false);
    const r: FinalizeResult = finalize();
    if (r.ok) {
      if (r.noMeetingCancelled) toast.push(NO_MEETING_CANCELLED);
      leaving.current = true;
      navigate(`/wrapup/${r.record.id}`);
      return;
    }
    if (r.reason === "too_short") {
      toast.push(TOO_SHORT);
      leaving.current = true;
      navigate("/", { replace: true });
    } else if (r.reason === "quota") {
      toast.push(QUOTA_TOAST);
    } else if (r.reason === "no_active") {
      navigate("/", { replace: true });
    } else {
      toast.push("회의를 저장하지 못했어요. 잠시 후 다시 종료해 주세요");
    }
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{active.setup.title}</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="회의 종료" onClick={() => setConfirmOpen(true)} />}
    >
      <Spacing size={16} />
      <TimerDisplay active={active} now={now} />
      <Spacing size={16} />
      <Button variant="weak" size="large" display="block" onClick={onTogglePause}>
        {paused ? "다시 시작" : "일시정지"}
      </Button>
      <Spacing size={24} />
      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />
      <div style={{ height: "calc(96px + env(safe-area-inset-bottom))" }} />
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={<ConfirmDialog.Title>회의를 종료할까요?</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>지금까지의 비용이 기록으로 저장돼요.</ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton onClick={() => setConfirmOpen(false)}>
            닫기
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton onClick={onConfirmEnd}>종료</ConfirmDialog.ConfirmButton>
        }
      />
      <Toast
        position="bottom"
        open={toast.current !== null}
        text={toast.current ?? ""}
        onClose={toast.dismiss}
      />
    </ScreenScaffold>
  );
}

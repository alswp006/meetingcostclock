import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertDialog, Toast } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SetupForm } from "@/components/setup/SetupForm";
import { useActiveMeeting } from "@/hooks/useActiveMeeting";
import { useToastQueue } from "@/hooks/useToastQueue";
import { loadLastSetup } from "@/lib/storage";
import { isMeetingSetupInput } from "@/lib/schema";
import { QUOTA_TOAST, RESTART_SAVED } from "@/lib/messages";
import type { MeetingSetupInput, RouteState } from "@/lib/types";

function pickInitial(state: RouteState["/setup"]): MeetingSetupInput | null {
  const prefill = state ? state.prefill : null;
  if (isMeetingSetupInput(prefill)) return prefill;
  const last = loadLastSetup();
  if (!last) return null;
  return {
    title: last.title,
    teamName: last.teamName,
    attendees: last.attendees,
    annualSalaryManwon: last.annualSalaryManwon,
    plannedMinutes: last.plannedMinutes,
  };
}

export default function Setup() {
  const navigate = useNavigate();
  const state = (useLocation().state as RouteState["/setup"]) ?? null;
  const [initial] = useState(() => pickInitial(state));
  const { active, start, finalize } = useActiveMeeting();
  const toast = useToastQueue();

  const handleSubmit = (input: MeetingSetupInput) => {
    const r = start(input);
    if (r.ok) {
      navigate("/meeting");
      return;
    }
    toast.push(QUOTA_TOAST);
  };

  const handleRestart = () => {
    const r = finalize();
    if (!r.ok && r.reason === "quota") {
      toast.push(QUOTA_TOAST);
      return;
    }
    toast.push(RESTART_SAVED);
  };

  return (
    <ScreenScaffold>
      <SetupForm initial={initial} onSubmit={handleSubmit} />
      <AlertDialog
        open={!!active}
        title="진행 중인 회의가 있어요"
        description="이어서 진행하거나, 지금 회의를 저장하고 새로 시작할 수 있어요"
        onClose={() => navigate("/meeting")}
        alertButton={
          <>
            <AlertDialog.AlertButton onClick={() => navigate("/meeting")}>
              이어서 진행
            </AlertDialog.AlertButton>
            <AlertDialog.AlertButton onClick={handleRestart}>
              종료하고 새로 시작
            </AlertDialog.AlertButton>
          </>
        }
      />
      <Toast
        open={toast.current !== null}
        position="bottom"
        text={toast.current ?? ""}
        onClose={toast.dismiss}
      />
    </ScreenScaffold>
  );
}

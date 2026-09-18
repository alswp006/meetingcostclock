import { useCallback, useState } from "react";
import { loadActive } from "@/lib/storage";
import {
  finalizeActive,
  pauseMeeting,
  resumeMeeting,
  startMeeting,
} from "@/lib/meetingLifecycle";
import type { StartResult } from "@/lib/meetingLifecycle";
import type {
  ActiveMeeting,
  FinalizeResult,
  MeetingSetupInput,
  SaveResult,
} from "@/lib/types";

export function useActiveMeeting(): {
  active: ActiveMeeting | null;
  start: (input: MeetingSetupInput) => StartResult;
  pause: () => SaveResult;
  resume: () => SaveResult;
  finalize: () => FinalizeResult;
  refresh: () => void;
} {
  const [active, setActive] = useState<ActiveMeeting | null>(() => loadActive());
  const refresh = useCallback(() => setActive(loadActive()), []);

  const start = useCallback(
    (input: MeetingSetupInput) => {
      const r = startMeeting(input, Date.now());
      refresh();
      return r;
    },
    [refresh],
  );
  const pause = useCallback(() => {
    const r = pauseMeeting(Date.now());
    refresh();
    return r;
  }, [refresh]);
  const resume = useCallback(() => {
    const r = resumeMeeting(Date.now());
    refresh();
    return r;
  }, [refresh]);
  const finalize = useCallback(() => {
    const r = finalizeActive(Date.now());
    refresh();
    return r;
  }, [refresh]);

  return { active, start, pause, resume, finalize, refresh };
}

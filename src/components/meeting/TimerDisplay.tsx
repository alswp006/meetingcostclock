import { Paragraph, Spacing } from "@toss/tds-mobile";
import { Card } from "@/components/Card";
import { SummaryHero } from "@/components/SummaryHero";
import { CountUp } from "@/components/CountUp";
import { calcCost, calcHourly } from "@/lib/cost";
import { formatHMS, formatMinutes, formatWon } from "@/lib/format";
import { getElapsedSec } from "@/lib/meetingTime";
import type { ActiveMeeting } from "@/lib/types";

const SECONDARY = "var(--adaptiveGrey600)";
const DANGER = "var(--adaptiveRed500)";

export function TimerDisplay({ active, now }: { active: ActiveMeeting; now: number }) {
  const { attendees, annualSalaryManwon, plannedMinutes } = active.setup;
  const elapsed = getElapsedSec(active, now);
  const cost = calcCost(attendees, annualSalaryManwon, elapsed);

  const perMinute = calcHourly(attendees, annualSalaryManwon).perMinute;
  const overSec = Math.max(0, elapsed - plannedMinutes * 60);
  const overCost = overSec > 0 ? calcCost(attendees, annualSalaryManwon, overSec) : 0;
  const paused = active.pausedAt !== null;

  return (
    <div data-testid="timer-display">
      <SummaryHero
        testId="timer-hero"
        label="지금까지 쓴 비용"
        value={<CountUp value={cost} durationMs={0} />}
        caption={`${formatHMS(elapsed)} · ${attendees}명 · 1분당 ${formatWon(perMinute)}`}
      />
      <Spacing size={16} />
      <Card testId="timer-plan-card">
        <Paragraph.Text typography="st6" color={SECONDARY}>
          {`예정 ${formatMinutes(plannedMinutes)}`}
        </Paragraph.Text>
        {overSec > 0 ? (
          <div data-testid="timer-over">
            <Spacing size={8} />
            <Paragraph.Text typography="t5" color={DANGER}>
              {`${formatMinutes(Math.floor(overSec / 60))} 초과`}
            </Paragraph.Text>
            <Paragraph.Text typography="t5" color={DANGER}>
              {formatWon(overCost)}
            </Paragraph.Text>
          </div>
        ) : null}
        {paused ? (
          <>
            <Spacing size={8} />
            <Paragraph.Text typography="st5" color={SECONDARY}>
              일시정지 중
            </Paragraph.Text>
          </>
        ) : null}
      </Card>
    </div>
  );
}

export default TimerDisplay;

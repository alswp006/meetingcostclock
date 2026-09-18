import { useState } from "react";
import { Paragraph, Spacing, TextField, Top } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { Card } from "@/components/Card";
import { SubmitFooter } from "@/components/BottomCTA";
import { calcHourly } from "@/lib/cost";
import { formatWon } from "@/lib/format";
import type { MeetingSetupInput } from "@/lib/types";

const DEFAULT_TITLE = "이름 없는 회의";
const DEFAULT_TEAM = "우리 팀";

type FieldKey = "attendees" | "salary" | "minutes";
type Errors = Partial<Record<FieldKey, string>>;

const digitsOnly = (v: string) => v.replace(/\D/g, "");

function validate(
  attendees: string,
  salary: string,
  minutes: string,
  requireFilled: boolean
): Errors {
  const e: Errors = {};
  const a = Number(attendees);
  const s = Number(salary);
  const m = Number(minutes);
  if (attendees === "") {
    if (requireFilled) e.attendees = "참석자 수를 입력해주세요";
  } else if (a < 2 || a > 100) {
    e.attendees = "참석자는 2~100명까지 입력할 수 있어요";
  }
  if (salary === "") {
    if (requireFilled) e.salary = "평균 연봉을 입력해주세요";
  } else if (s < 1000 || s > 50000) {
    e.salary = "연봉은 1,000만~5억 원 사이로 입력해주세요";
  }
  if (minutes === "") {
    if (requireFilled) e.minutes = "예정 시간을 입력해주세요";
  } else if (m < 5 || m > 480) {
    e.minutes = "예정 시간은 5~480분 사이로 입력해주세요";
  }
  return e;
}

function fireHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "success" })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export function SetupForm({
  initial,
  onSubmit,
}: {
  initial?: Partial<MeetingSetupInput> | null;
  onSubmit: (input: MeetingSetupInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [teamName, setTeamName] = useState(initial?.teamName ?? "");
  const [attendees, setAttendees] = useState(
    initial?.attendees != null ? String(initial.attendees) : ""
  );
  const [salary, setSalary] = useState(
    initial?.annualSalaryManwon != null ? String(initial.annualSalaryManwon) : ""
  );
  const [minutes, setMinutes] = useState(
    initial?.plannedMinutes != null ? String(initial.plannedMinutes) : "30"
  );
  const [submitted, setSubmitted] = useState(false);

  const errors = validate(attendees, salary, minutes, submitted);
  const hasRangeError = Object.keys(validate(attendees, salary, minutes, false)).length > 0;
  const previewOk =
    !errors.attendees && !errors.salary && attendees !== "" && salary !== "";
  const hourly = previewOk ? calcHourly(Number(attendees), Number(salary)) : null;

  const handleSubmit = () => {
    setSubmitted(true);
    if (Object.keys(validate(attendees, salary, minutes, true)).length > 0) return;
    fireHaptic();
    onSubmit({
      title: title.trim().slice(0, 30) || DEFAULT_TITLE,
      teamName: teamName.trim().slice(0, 20) || DEFAULT_TEAM,
      attendees: Number(attendees),
      annualSalaryManwon: Number(salary),
      plannedMinutes: Number(minutes),
    });
  };

  return (
    <>
      <Top title={<Top.TitleParagraph>회의 설정</Top.TitleParagraph>} />
      <Spacing size={16} />
      <TextField
        variant="box"
        labelOption="sustain"
        label="회의명"
        placeholder="예: 주간 스프린트"
        help="비워두면 '이름 없는 회의'로 저장해요"
        value={title}
        maxLength={30}
        enterKeyHint="next"
        onChange={(e) => setTitle(e.target.value)}
      />
      <Spacing size={16} />
      <TextField
        variant="box"
        labelOption="sustain"
        label="팀명"
        placeholder="예: 플랫폼팀"
        help="비워두면 '우리 팀'으로 저장해요"
        value={teamName}
        maxLength={20}
        enterKeyHint="next"
        onChange={(e) => setTeamName(e.target.value)}
      />
      <Spacing size={16} />
      <TextField
        variant="box"
        labelOption="sustain"
        label="참석자 수"
        placeholder="예: 5"
        inputMode="numeric"
        enterKeyHint="next"
        value={attendees}
        hasError={!!errors.attendees}
        help={errors.attendees}
        onChange={(e) => setAttendees(digitsOnly(e.target.value))}
      />
      <Spacing size={16} />
      <TextField
        variant="box"
        labelOption="sustain"
        label="평균 연봉(만 원)"
        placeholder="예: 5000"
        inputMode="numeric"
        enterKeyHint="next"
        value={salary}
        hasError={!!errors.salary}
        help={errors.salary}
        onChange={(e) => setSalary(digitsOnly(e.target.value))}
      />
      <Spacing size={16} />
      <TextField
        variant="box"
        labelOption="sustain"
        label="예정 시간(분)"
        placeholder="예: 30"
        inputMode="numeric"
        enterKeyHint="done"
        value={minutes}
        hasError={!!errors.minutes}
        help={errors.minutes}
        onChange={(e) => setMinutes(digitsOnly(e.target.value))}
      />
      <Spacing size={24} />
      <Card testId="hourly-preview">
        {hourly ? (
          <>
            <Paragraph.Text typography="t3">{`팀 시급 ${formatWon(hourly.team)}`}</Paragraph.Text>
            <Spacing size={8} />
            <Paragraph.Text typography="st5" color="var(--adaptiveGrey600)">
              {`1인 시급 ${formatWon(hourly.perPerson)}`}
            </Paragraph.Text>
            <Paragraph.Text typography="st5" color="var(--adaptiveGrey600)">
              {`분당 ${formatWon(hourly.perMinute)}`}
            </Paragraph.Text>
          </>
        ) : (
          <Paragraph.Text typography="st5" color="var(--adaptiveGrey500)">
            참석자 수와 연봉을 입력하면 시급이 계산돼요
          </Paragraph.Text>
        )}
      </Card>
      <Spacing size={160} />
      <SubmitFooter label="회의 시작" disabled={hasRangeError} onClick={handleSubmit} />
    </>
  );
}

export default SetupForm;

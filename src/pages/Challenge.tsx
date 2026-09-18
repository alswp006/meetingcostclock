import { useState } from "react";
import { Asset, BottomSheet, Button, ListRow, Paragraph, Spacing, Toast, Top } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SummaryHero } from "@/components/SummaryHero";
import { useToastQueue } from "@/hooks/useToastQueue";
import { canDeclareToday, declareNoMeetingDay } from "@/lib/challenge";
import { hasMeetingOn, toDateKey, trailingStreak } from "@/lib/challengeRules";
import { STORAGE_KEY_RECORDS } from "@/lib/constants";
import { QUOTA_TOAST } from "@/lib/messages";
import { normalizeRecords } from "@/lib/schema";
import { loadActive, loadBadges, loadNoMeetingDays, parseArray, readRaw } from "@/lib/storageBase";
import type { BadgeId, EarnedBadge, NoMeetingDay } from "@/lib/types";

const BADGES: { id: BadgeId; name: string; desc: string; icon: string }[] = [
  { id: "first_free_day", name: "첫 회의 없는 날", desc: "처음 회의 없는 날을 선언했어요", icon: "icon-check-circle-mono" },
  { id: "streak_3", name: "3일 연속", desc: "평일 3일 연속으로 선언했어요", icon: "icon-calendar-check-mono" },
  { id: "total_5", name: "누적 5일", desc: "회의 없는 날을 5일 선언했어요", icon: "icon-star-mono" },
  { id: "total_10", name: "누적 10일", desc: "회의 없는 날을 10일 선언했어요", icon: "icon-star-mono" },
  { id: "total_20", name: "누적 20일", desc: "회의 없는 날을 20일 선언했어요", icon: "icon-star-mono" },
];

function badgeMeta(id: BadgeId) {
  return BADGES.find((b) => b.id === id);
}

function todayHasMeeting(now: Date): boolean {
  try {
    const recs = parseArray(readRaw(STORAGE_KEY_RECORDS));
    const records = recs.ok ? normalizeRecords(recs.items) : [];
    return hasMeetingOn(records, now, loadActive() !== null);
  } catch {
    return false;
  }
}

function icon(name: string) {
  return <Asset.ContentIcon name={name} alt="" style={{ width: 32, height: 32 }} />;
}

export default function Challenge() {
  const toast = useToastQueue();
  const [days, setDays] = useState<NoMeetingDay[]>(() => loadNoMeetingDays());
  const [badges, setBadges] = useState<EarnedBadge[]>(() => loadBadges());
  const [newBadges, setNewBadges] = useState<EarnedBadge[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const now = new Date();
  const todayKey = toDateKey(now);
  const declared = days.some((d) => d.date === todayKey);
  const weekdayOk = canDeclareToday(now).ok;
  const meeting = !declared && weekdayOk && todayHasMeeting(now);
  const can = weekdayOk && !declared && !meeting;

  let reason: string | null = null;
  if (!weekdayOk) reason = "주말에는 선언할 수 없어요";
  else if (declared) reason = null;
  else if (meeting) reason = "오늘은 이미 회의가 있었어요";

  const monthPrefix = todayKey.slice(0, 7);
  const monthDays = days.filter((d) => d.date.startsWith(monthPrefix)).sort((a, b) => b.date.localeCompare(a.date));
  const streak = trailingStreak(days.map((d) => d.date));
  const earnedIds = new Set(badges.map((b) => b.badgeId));

  const declare = () => {
    if (!can) return;
    try {
      Promise.resolve(generateHapticFeedback({ type: "success" })).catch(() => {});
    } catch {
      /* WebView 밖에서는 throw — 무시 */
    }
    let res;
    try {
      res = declareNoMeetingDay(new Date());
    } catch {
      toast.push("기록하지 못했어요. 다시 시도해 주세요");
      return;
    }
    if (!res.ok) {
      if (res.reason === "quota") toast.push(QUOTA_TOAST);
      else if (res.reason === "weekend") toast.push("주말에는 선언할 수 없어요");
      else if (res.reason === "has_meeting") toast.push("오늘은 이미 회의가 있었어요");
      else if (res.reason === "already_declared") toast.push("오늘은 이미 선언했어요");
      else toast.push("기록하지 못했어요. 다시 시도해 주세요");
      setDays(loadNoMeetingDays());
      return;
    }
    setDays(loadNoMeetingDays());
    setBadges(loadBadges());
    toast.push("오늘을 회의 없는 날로 기록했어요");
    if (res.newBadges.length > 0) {
      setNewBadges(res.newBadges);
      setSheetOpen(true);
    }
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>회의 없는 날 챌린지</Top.TitleParagraph>} />}
    >
      <Spacing size={16} />
      <SummaryHero label="연속 회의 없는 날" value={<Paragraph.Text typography="t1">{`${streak}일`}</Paragraph.Text>} caption={`이번 달 ${monthDays.length}일 선언했어요`} testId="challenge-hero" />
      <Spacing size={16} />
      {/* 탭-루트: 하단은 FloatingTabBar 자리 — 1차 CTA는 히어로 아래 전체폭 버튼으로 둔다 */}
      <Button size="large" display="block" disabled={!can} onClick={declare}>
        {declared ? "오늘은 선언했어요" : "오늘은 회의 없는 날"}
      </Button>
      {reason ? (
        <>
          <Spacing size={8} />
          <Paragraph.Text typography="st6" color="secondary">
            {reason}
          </Paragraph.Text>
        </>
      ) : null}
      <Spacing size={24} />
      <Paragraph.Text typography="t5">배지</Paragraph.Text>
      <Spacing size={8} />
      {BADGES.map((b) => (
        <ListRow
          key={b.id}
          left={icon(b.icon)}
          contents={<ListRow.Texts type="2RowTypeA" top={b.name} bottom={b.desc} />}
          right={
            <Paragraph.Text typography="st6" color={earnedIds.has(b.id) ? undefined : "tertiary"}>
              {earnedIds.has(b.id) ? "획득" : "미획득"}
            </Paragraph.Text>
          }
        />
      ))}
      <Spacing size={24} />
      <Paragraph.Text typography="t5">이번 달 선언일</Paragraph.Text>
      <Spacing size={8} />
      {monthDays.length === 0 ? (
        <Paragraph.Text typography="st5" color="tertiary">
          아직 선언한 날이 없어요
        </Paragraph.Text>
      ) : (
        monthDays.map((d) => <ListRow key={d.id} contents={<ListRow.Texts type="1RowTypeA" top={d.date} />} />)
      )}
      <Spacing size={120} />
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} header={<BottomSheet.Header>새 배지를 받았어요</BottomSheet.Header>}>
        {newBadges.map((b) => {
          const m = badgeMeta(b.badgeId);
          return (
            <ListRow
              key={b.id}
              left={icon(m?.icon ?? "icon-star-mono")}
              contents={<ListRow.Texts type="2RowTypeA" top={m?.name ?? b.badgeId} bottom={m?.desc ?? ""} />}
            />
          );
        })}
        <Spacing size={16} />
        <Button display="block" onClick={() => setSheetOpen(false)}>
          확인
        </Button>
      </BottomSheet>
      <Toast open={toast.current !== null} position="bottom" text={toast.current ?? ""} onClose={toast.dismiss} />
    </ScreenScaffold>
  );
}

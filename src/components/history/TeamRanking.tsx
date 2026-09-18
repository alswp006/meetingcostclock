import { useMemo, useState } from "react";
import { Asset, Button, ListRow, Paragraph, SegmentedControl, Spacing } from "@toss/tds-mobile";
import { Card } from "@/components/Card";
import { MiniBar } from "@/components/MiniBar";
import { EmptyState } from "@/components/StateView";
import { formatWon } from "@/lib/format";
import { rankTeams } from "@/lib/ranking";
import { loadRecordsPage } from "@/lib/storage";
import type { MeetingRecord } from "@/lib/types";

const PAGE = 20;

function loadAll(): { records: MeetingRecord[]; error: boolean } {
  const all: MeetingRecord[] = [];
  let total = 0;
  do {
    const page = loadRecordsPage(all.length);
    if (page.error) return { records: [], error: true };
    if (page.items.length === 0) break;
    total = page.total;
    all.push(...page.items);
  } while (all.length < total);
  return { records: all, error: false };
}

export function TeamRanking() {
  const [period, setPeriod] = useState<"all" | "month">("all");
  const [shown, setShown] = useState(PAGE);
  const [reloadKey, setReloadKey] = useState(0);
  const loaded = useMemo(() => loadAll(), [reloadKey]);
  const ranks = useMemo(() => rankTeams(loaded.records, new Date(), period), [loaded, period]);

  const filter = (
    <>
      <SegmentedControl
        value={period}
        onChange={(v: string) => {
          setPeriod(v === "month" ? "month" : "all");
          setShown(PAGE);
        }}
      >
        <SegmentedControl.Item value="all">전체</SegmentedControl.Item>
        <SegmentedControl.Item value="month">이번 달</SegmentedControl.Item>
      </SegmentedControl>
      <Spacing size={16} />
    </>
  );

  if (loaded.error) {
    return (
      <EmptyState
        testId="ranking-error"
        icon={<Asset.ContentIcon name="icon-search-bold-mono" alt="" style={{ width: 48, height: 48 }} />}
        title="기록을 불러오지 못했어요"
        description="잠시 뒤에 다시 시도해 주세요"
        action={
          <Button variant="weak" size="medium" onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </Button>
        }
      />
    );
  }

  if (ranks.length === 0) {
    return (
      <>
        {filter}
        <EmptyState
          testId="ranking-empty"
          icon={<Asset.ContentIcon name="icon-search-bold-mono" alt="" style={{ width: 48, height: 48 }} />}
          title={period === "month" ? "이번 달 기록이 없어요" : "아직 기록이 없어요"}
          description="회의를 끝내면 팀별 순위가 나와요"
        />
      </>
    );
  }

  return (
    <>
    {filter}
    <Card testId="team-ranking">
      {ranks.slice(0, shown).map((t, i) => (
        <div key={t.teamName || `team-${i}`} data-testid="team-rank-row">
          <ListRow
            left={<Paragraph.Text typography="t5">{`${t.rank}위`}</Paragraph.Text>}
            contents={<ListRow.Texts type="1RowTypeA" top={t.teamName || "팀 없음"} />}
            right={<Paragraph.Text typography="st5">{formatWon(t.totalCost)}</Paragraph.Text>}
          />
          <MiniBar ratio={t.sharePercent / 100} />
          <Spacing size={4} />
          <Paragraph.Text typography="st13" color="secondary">
            {`회의 ${t.count}회`}
          </Paragraph.Text>
          <Spacing size={12} />
        </div>
      ))}
    </Card>
    {shown < ranks.length && (
      <>
        <Spacing size={8} />
        <Button variant="weak" size="medium" display="block" onClick={() => setShown((n) => n + PAGE)}>
          더보기
        </Button>
      </>
    )}
    </>
  );
}

export default TeamRanking;

import { useMemo } from "react";
import { Asset, ListRow, Paragraph, Spacing } from "@toss/tds-mobile";
import { Card } from "@/components/Card";
import { MiniBar } from "@/components/MiniBar";
import { EmptyState } from "@/components/StateView";
import { formatWon } from "@/lib/format";
import { rankTeams } from "@/lib/ranking";
import { loadRecordsPage } from "@/lib/storage";
import type { MeetingRecord } from "@/lib/types";

function loadAll(): MeetingRecord[] {
  const all: MeetingRecord[] = [];
  let total = 0;
  do {
    const page = loadRecordsPage(all.length);
    if (page.error || page.items.length === 0) break;
    total = page.total;
    all.push(...page.items);
  } while (all.length < total);
  return all;
}

export function TeamRanking() {
  const ranks = useMemo(() => rankTeams(loadAll(), new Date()), []);

  if (ranks.length === 0) {
    return (
      <EmptyState
        testId="ranking-empty"
        icon={<Asset.ContentIcon name="icon-search-bold-mono" alt="" style={{ width: 48, height: 48 }} />}
        title="이번 달 기록이 없어요"
        description="회의를 끝내면 팀별 순위가 나와요"
      />
    );
  }

  return (
    <Card testId="team-ranking">
      {ranks.map((t, i) => (
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
  );
}

export default TeamRanking;

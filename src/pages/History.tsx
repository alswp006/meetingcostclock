import { useState } from "react";
import { Spacing, Tab, Top } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { HistoryList } from "@/components/history/HistoryList";
import { TeamRanking } from "@/components/history/TeamRanking";

function tickWeak() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export default function History() {
  const [tab, setTab] = useState(0);
  const select = (i: number) => {
    if (i !== tab) tickWeak();
    setTab(i);
  };

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>기록</Top.TitleParagraph>} />}>
      <Tab onChange={select}>
        <Tab.Item selected={tab === 0} onClick={() => select(0)}>
          회의 기록
        </Tab.Item>
        <Tab.Item selected={tab === 1} onClick={() => select(1)}>
          팀 랭킹
        </Tab.Item>
      </Tab>
      <Spacing size={16} />
      {tab === 0 ? <HistoryList /> : <TeamRanking />}
      <Spacing size={120} />
    </ScreenScaffold>
  );
}

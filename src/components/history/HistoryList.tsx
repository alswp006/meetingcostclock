import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AlertDialog, Asset, BottomSheet, Button, ListRow, Paragraph, Spacing } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { useNavigate } from "react-router-dom";
import { AdSlot } from "@/components/AdSlot";
import { Card } from "@/components/Card";
import { Sparkline } from "@/components/Sparkline";
import { EmptyState, LoadingState } from "@/components/StateView";
import { deleteRecord, loadRecordsPage } from "@/lib/storage";
import { formatWon } from "@/lib/format";
import type { MeetingRecord } from "@/lib/types";

const AD_AFTER_ROW = 5;

function fireHaptic(type: "tickWeak" | "tickMedium") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

function subtitle(r: MeetingRecord): string {
  const d = new Date(r.endedAt);
  const minutes = Math.max(1, Math.round((Number(r.durationSec) || 0) / 60));
  return `${d.getMonth() + 1}월 ${d.getDate()}일 · ${minutes}분 · ${r.attendees}명`;
}

interface Loaded {
  items: MeetingRecord[];
  total: number;
  error?: "corrupted" | "unavailable";
}

/** 0부터 count건 이상을 페이지 단위로 읽는다(삭제·재시도 후 이미 펼친 범위를 유지). */
function readThrough(count: number): Loaded {
  const items: MeetingRecord[] = [];
  let total = 0;
  do {
    const page = loadRecordsPage(items.length);
    if (page.error) return { items: [], total: 0, error: page.error };
    total = page.total;
    if (page.items.length === 0) break;
    items.push(...page.items);
  } while (items.length < count && items.length < total);
  return { items, total };
}

export function HistoryList() {
  const navigate = useNavigate();
  const [state, setState] = useState<Loaded | null>(null);
  const [menuFor, setMenuFor] = useState<MeetingRecord | null>(null);
  const [confirmFor, setConfirmFor] = useState<MeetingRecord | null>(null);

  const reload = useCallback((count: number) => setState(readThrough(count)), []);

  useEffect(() => {
    reload(1);
  }, [reload]);

  const trend = useMemo(
    () => (state ? state.items.slice(0, 10).map((r) => Number(r.totalCost) || 0).reverse() : []),
    [state],
  );

  if (!state) return <LoadingState rows={4} testId="history-loading" />;

  if (state.error) {
    return (
      <EmptyState
        testId="history-error"
        icon={<Asset.ContentIcon name="icon-search-bold-mono" alt="" style={{ width: 48, height: 48 }} />}
        title="기록을 불러오지 못했어요"
        description="잠시 뒤에 다시 시도해 주세요"
        action={
          <Button variant="weak" size="medium" onClick={() => reload(1)}>
            다시 시도
          </Button>
        }
      />
    );
  }

  if (state.total === 0) {
    return (
      <EmptyState
        testId="history-empty"
        icon={<Asset.ContentIcon name="icon-search-bold-mono" alt="" style={{ width: 48, height: 48 }} />}
        title="아직 기록이 없어요"
        description="회의를 끝내면 여기에 비용이 쌓여요"
        action={
          <Button variant="weak" size="medium" onClick={() => navigate("/setup")}>
            새 회의 시작
          </Button>
        }
      />
    );
  }

  const confirmDelete = () => {
    const target = confirmFor;
    setConfirmFor(null);
    if (!target) return;
    fireHaptic("tickMedium");
    deleteRecord(target.id);
    reload(Math.max(state.items.length - 1, 1));
  };

  return (
    <>
      {trend.length >= 2 && (
        <>
          <Card testId="history-trend">
            <Paragraph.Text typography="st6" color="secondary">
              최근 회의 비용 추이
            </Paragraph.Text>
            <Spacing size={12} />
            <Sparkline data={trend} />
          </Card>
          <Spacing size={16} />
        </>
      )}

      {state.items.map((r, i) => (
        <Fragment key={r.id}>
          <ListRow
            contents={<ListRow.Texts type="2RowTypeA" top={r.title} bottom={subtitle(r)} />}
            right={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Paragraph.Text typography="st5">{formatWon(r.totalCost)}</Paragraph.Text>
                <Button
                  variant="weak"
                  size="small"
                  data-testid="record-more-button"
                  aria-label="기록 메뉴"
                  onClick={(e: { stopPropagation: () => void }) => {
                    e.stopPropagation();
                    fireHaptic("tickWeak");
                    setMenuFor(r);
                  }}
                >
                  ⋯
                </Button>
              </div>
            }
            onClick={() => {
              fireHaptic("tickWeak");
              navigate(r.outcome ? `/report/${r.id}` : `/wrapup/${r.id}`);
            }}
          />
          {i === AD_AFTER_ROW - 1 && (
            <>
              <Spacing size={8} />
              <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />
              <Spacing size={8} />
            </>
          )}
        </Fragment>
      ))}

      {state.items.length < state.total && (
        <>
          <Spacing size={8} />
          <Button
            variant="weak"
            size="medium"
            display="block"
            onClick={() => {
              fireHaptic("tickWeak");
              reload(state.items.length + 1);
            }}
          >
            더보기
          </Button>
        </>
      )}

      <BottomSheet open={menuFor !== null} onClose={() => setMenuFor(null)}>
        <ListRow
          contents={<ListRow.Texts type="1RowTypeA" top="기록 삭제" />}
          onClick={() => {
            setConfirmFor(menuFor);
            setMenuFor(null);
          }}
        />
      </BottomSheet>

      <AlertDialog
        open={confirmFor !== null}
        title="이 기록을 삭제할까요?"
        description="삭제한 기록은 되돌릴 수 없어요"
        onClose={() => setConfirmFor(null)}
        alertButton={<AlertDialog.AlertButton onClick={confirmDelete}>삭제</AlertDialog.AlertButton>}
      />
    </>
  );
}

export default HistoryList;

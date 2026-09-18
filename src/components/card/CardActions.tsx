import type { RefObject } from "react";
import { Button, Spacing } from "@toss/tds-mobile";
import { generateHapticFeedback, setClipboardText, share } from "@apps-in-toss/web-framework";
import { SubmitFooter } from "@/components/BottomCTA";
import { buildShareText } from "@/lib/shareCard";
import type { MeetingRecord } from "@/lib/types";

function tick() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await setClipboardText(text);
    return true;
  } catch {
    /* 아래 브라우저 클립보드로 폴백 */
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CardActions({
  record,
  canvasRef,
  onToast,
}: {
  record: MeetingRecord;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onToast: (msg: string) => void;
}) {
  const saveImage = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("no canvas");
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `meeting-cost-${record.id}.png`;
      a.click();
      onToast("이미지를 저장했어요");
    } catch {
      onToast("이미지를 저장하지 못했어요. 다시 시도해 주세요");
    }
  };

  const shareText = async () => {
    tick();
    const text = buildShareText(record);
    try {
      await (share as unknown as (a: { message: string }) => Promise<unknown>)({ message: text });
      return;
    } catch {
      /* 공유 함수가 없거나 실패 — 클립보드 폴백 */
    }
    onToast((await copyText(text)) ? "공유 문구를 복사했어요" : "복사하지 못했어요. 다시 시도해 주세요");
  };

  return (
    <>
      <Button variant="weak" size="large" display="block" onClick={shareText}>
        텍스트 공유
      </Button>
      <Spacing size={16} />
      <SubmitFooter label="이미지 저장" onClick={saveImage} />
    </>
  );
}

export default CardActions;

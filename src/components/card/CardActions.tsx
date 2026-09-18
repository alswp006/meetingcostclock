import type { RefObject } from "react";
import { Button, Spacing } from "@toss/tds-mobile";
import { generateHapticFeedback, saveBase64Data, share } from "@apps-in-toss/web-framework";
import { SubmitFooter } from "@/components/BottomCTA";
import { IMAGE_SAVED, IMAGE_SAVE_FAILED, SHARE_FAILED } from "@/lib/messages";
import { buildShareText } from "@/lib/shareCard";
import type { MeetingRecord } from "@/lib/types";

function tick() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
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
  const saveImage = async () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("no canvas");
      const data = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
      await saveBase64Data({ data, fileName: `meeting-cost-${record.id}.png`, mimeType: "image/png" });
      onToast(IMAGE_SAVED);
    } catch {
      onToast(IMAGE_SAVE_FAILED);
    }
  };

  const shareText = async () => {
    tick();
    try {
      await (share as unknown as (a: { message: string }) => Promise<unknown>)({
        message: buildShareText(record),
      });
    } catch {
      onToast(SHARE_FAILED);
    }
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

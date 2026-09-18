import { useNavigate } from "react-router-dom";
import { Asset, Button } from "@toss/tds-mobile";
import { ScreenScaffold } from "./ScreenScaffold";
import { EmptyState } from "./StateView";

export function RecordNotFound() {
  const navigate = useNavigate();
  return (
    <ScreenScaffold>
      <EmptyState
        icon={<Asset.ContentIcon name="icon-search-bold-mono" alt="" style={{ width: 48, height: 48 }} />}
        title="기록을 찾을 수 없어요"
        description="삭제됐거나 없는 기록이에요"
        action={
          <Button variant="weak" onClick={() => navigate("/")}>
            홈으로
          </Button>
        }
      />
    </ScreenScaffold>
  );
}

export default RecordNotFound;

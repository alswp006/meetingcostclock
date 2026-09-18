import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Top } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { EmptyState } from "@/components/StateView";

function ErrorFallback({ onReset }: { onReset: () => void }) {
  const navigate = useNavigate();
  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>회의비용 시계</Top.TitleParagraph>} />}>
      <EmptyState
        title="문제가 생겼어요"
        description="화면을 불러오지 못했어요. 홈에서 다시 시작해 주세요"
        action={
          <Button
            variant="weak"
            onClick={() => {
              onReset();
              navigate("/", { replace: true });
            }}
          >
            홈으로
          </Button>
        }
      />
    </ScreenScaffold>
  );
}

interface Props {
  children: ReactNode;
  /** 값이 바뀌면(예: 경로 이동) 에러 상태를 풀어 다시 렌더한다 */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  prevResetKey?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, prevResetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.prevResetKey) {
      return { hasError: false, prevResetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // 검수: console.error 금지 — 폴백 UI로만 알린다
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) return <ErrorFallback onReset={this.reset} />;
    return this.props.children;
  }
}

export default ErrorBoundary;

# MeetingCostClock

앱인토스 (Vite + React + TDS) 참석자 수와 평균 급여를 입력하면 회의가 진행되는 동안 실시간으로 누적 비용을 보여주는 직장인용 회의비용 계산기 많은 직장인이 불필요하게 길어지는 회의로 인한 시간·인건비 낭비를 체감하지 못한 채 습관적으로 회의를 반복한다. 회의 비효율을 수치로 보여줄 도구가 없다.

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/Card` | Card |
| `/Challenge` | Challenge |
| `/History` | History |
| `/Home` | Home |
| `/Meeting` | Meeting |
| `/Report` | Report |
| `/Setup` | Setup |
| `/Wrapup` | Wrapup |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-18

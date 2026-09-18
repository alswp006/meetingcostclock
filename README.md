🇺🇸 [한국어](./README.ko.md)

# MeetingCostClock — Real-Time Meeting Cost Calculator

A mini-app for the Toss app that calculates the real-time labor cost of meetings based on attendee count and average salary. Helps workplace users understand and reduce unnecessary meeting expenses.

Users input meeting details (attendees, average salary, planned duration), start a timer, and watch the accumulated labor cost in real-time. After the meeting ends, they can review the cost breakdown and estimate waste based on meeting outcomes.

## Features

- 📊 **Real-Time Cost Calculation** — Live timer showing meeting cost accumulating per second
- 📈 **Weekly Summary** — Dashboard with weekly meeting totals and recent meeting history
- ⏱️ **Meeting Management** — Start, pause, and end meetings with automatic overflow tracking
- 📋 **Cost Report** — Detailed breakdown of meeting costs with waste estimation based on outcomes
- 🏆 **Team Rankings** — Leaderboard tracking team performance across challenges
- 📱 **Meeting History** — Full record of past meetings with filtering by date range
- 🎯 **Challenge Rules** — Daily/weekly challenges with No-Meeting-Day declarations
- 📢 **Ad Integration** — Banner ads in history view and reward ads for report unlock

## Tech Stack

- **Framework**: Vite + React 18 + TypeScript
- **UI Components**: @toss/tds-mobile (Toss Design System)
- **Routing**: React Router DOM
- **State Management**: React hooks + localStorage
- **Deployment**: App-in-Toss WebView (CSR)
- **Testing**: Vitest + @testing-library/react, Playwright (visual)

## Getting Started

### Install dependencies
```bash
npm install
```

### Build for production
```bash
npx vite build
```
Creates a static bundle in `dist/` for Toss CDN hosting.

### Build and deploy to Toss
```bash
npx ait build
npx ait deploy
```
Submits the app to Toss review and deploys to production (requires Toss developer credentials).

### Run tests
```bash
npx vitest run              # Unit tests
npm run test:visual         # Visual regression tests (Playwright)
npm run typecheck           # TypeScript type checking
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_APP_NAME` | Registered app ID in Toss console (for deployment) | No (from apps-in-toss.config.ts) |

Note: This is a client-only app with no backend. All configuration is in `apps-in-toss.config.ts`.

## Project Structure

```
src/
  pages/
    Home.tsx                 # Dashboard: active meeting, week summary, recent meetings
    Setup.tsx                # Meeting input form
    Meeting.tsx              # Live timer with cost display
    Wrapup.tsx               # Meeting conclusion form
    Report.tsx               # Cost breakdown and waste analysis
    Card.tsx                 # Shareable meeting card detail
    History.tsx              # Full meeting history with filters
    Challenge.tsx            # Team rankings and challenge rules
  components/
    ScreenScaffold.tsx       # Page layout wrapper (SafeArea + Top/Bottom slots)
    SummaryHero.tsx          # Large hero card for key metrics
    CountUp.tsx              # Animated number counter
    Card.tsx                 # Reusable card container
    Amount.tsx               # Currency display with nowrap
    StateView.tsx            # Empty/Loading state components
    FloatingTabBar.tsx       # Bottom navigation (3 tabs)
    AdSlot.tsx               # Banner ad container
    TossRewardAd.tsx         # Reward ad gate component
    BottomCTA.tsx            # Fixed bottom CTA button
  lib/
    cost.ts                  # Cost calculation formulas
    storage.ts               # localStorage helpers
    types.ts                 # TypeScript domain types
    constants.ts             # Fixed values (salary, time limits)
    messages.ts              # Toast/alert copy
  hooks/
    useActiveMeeting.ts      # Meeting lifecycle state
    useToastQueue.ts         # Toast notification manager
```

## Deployment

### Prerequisites
- Toss developer account with an app registered in the console
- App name configured in `apps-in-toss.config.ts` (case-sensitive)

### Steps
1. **Build**: `npm run build` validates TypeScript and creates the production bundle
2. **Deploy**: `npx ait build && npx ait deploy` packages and submits to Toss CDN
3. **Review**: Toss team reviews for compliance (no outlinks, 19+ content only, zero console errors)
4. **Live**: Once approved, the app is hosted at `https://{appName}.web.tossmini.com`

The app runs as CSR (client-side rendering only) in the Toss WebView. No server-side code or external APIs.

## License

MIT

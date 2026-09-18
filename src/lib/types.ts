// AC-1: MANDATORY — this file contains ONLY type definitions
// Zero runtime code (const/let/function/class)
// Coder: implement all types from spec.md Data Models

export type MeetingOutcome = "decided" | "partial" | "none";

export interface MeetingSetupInput {
  title: string;
  teamName: string;
  attendees: number;
  annualSalaryManwon: number;
  plannedMinutes: number;
}

export interface MeetingSetup extends MeetingSetupInput {
  id: "lastSetup";
  createdAt: string;
  updatedAt: string;
}

// AC-2: ActiveMeeting.startedAt must be number (milliseconds)
export interface ActiveMeeting {
  id: string;
  setup: MeetingSetupInput;
  startedAt: number; // milliseconds
  pausedAt: number | null;
  totalPausedMs: number;
  createdAt: string;
  updatedAt: string;
}

// AC-2: MeetingRecord.startedAt must be string (ISO datetime), outcome must be MeetingOutcome | null
export interface MeetingRecord {
  id: string;
  title: string;
  teamName: string;
  attendees: number;
  annualSalaryManwon: number;
  plannedMinutes: number;
  startedAt: string; // ISO datetime
  endedAt: string;
  durationSec: number;
  totalCost: number;
  outcome: MeetingOutcome | null;
  wasteCost: number | null;
  reportUnlocked: boolean;
  shareUnlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoMeetingDay {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface EarnedBadge {
  id: string;
  badgeId: string;
  createdAt: string;
  updatedAt: string;
}

// AC-3: RouteState — /setup has { prefill: MeetingSetupInput } | null, others are null
export interface RouteState {
  "/setup": { prefill: MeetingSetupInput } | null;
  "/home": null;
  "/timer": null;
  "/outcome": null;
  "/report": null;
  "/history": null;
  "/badges": null;
  "/settings": null;
}

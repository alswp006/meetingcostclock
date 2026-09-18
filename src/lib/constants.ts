// AC-4: Calculate and limit constants

// Working hours per year (40h/week * 52 weeks)
export const ANNUAL_WORK_HOURS = 2080;

// Maximum meeting duration (8 hours = 28800 seconds)
export const MAX_DURATION_SEC = 28800;

// Maximum wall-clock time for one day (12 hours = 43200000 ms)
export const MAX_WALL_MS = 43200000;

// Minimum duration to save a record (10 seconds)
export const MIN_SAVE_SEC = 10;

// History pagination (20 records per page)
export const HISTORY_PAGE_SIZE = 20;

// Maximum records stored in localStorage (500)
export const RECORDS_MAX = 500;

// Waste factor by outcome type (multiplied by totalCost to get wasteCost)
export const OUTCOME_FACTOR = {
  decided: 0,    // Full decision → no waste
  partial: 0.25, // Partial decision → 25% waste
  none: 0.5,     // No decision → 50% waste
} as const;

// AC-4: Storage keys for 5 entities
export const STORAGE_KEY_LAST_SETUP = "mcc:v1:lastSetup";
export const STORAGE_KEY_ACTIVE = "mcc:v1:active";
export const STORAGE_KEY_RECORDS = "mcc:v1:records";
export const STORAGE_KEY_NO_MEETING_DAYS = "mcc:v1:noMeetingDays";
export const STORAGE_KEY_BADGES = "mcc:v1:badges";
export const STORAGE_KEY_MEETINGS = "mcc:v1:meetings";

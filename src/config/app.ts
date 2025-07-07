export const APP_CONFIG = {
  // polling interval for real-time data (ms)
  REFRESH_INTERVAL: 15_000,
  // maximum number of stops a user can monitor simultaneously
  MAX_STOPS: 15,
  // consider arrivals only within this many minutes of now
  MAX_ARRIVALS_WINDOW: 60,
  // server-side cache duration for GTFS static data (ms)
  CACHE_DURATION: 60 * 60 * 1000, // 1 hour
  // debounce delay for user text input (ms)
  DEBOUNCE_DELAY: 1_000,
} as const; 
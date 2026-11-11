/** SCORM 1.2 CMITimespan: HHHH:MM:SS.SS (2 to 4 hour digits, optional hundredths). */
const TIMESPAN = /^(\d{2,4}):(\d{2}):(\d{2})(?:\.(\d{1,2}))?$/;

export function isScormTimespan(value: string): boolean {
  return TIMESPAN.test(value);
}

/** Seconds in a CMITimespan, or null when the value is malformed. */
export function parseScormTime(value: string): number | null {
  const match = TIMESPAN.exec(value);
  if (!match) return null;
  const [, hours, minutes, seconds, fraction = ""] = match;
  return (
    Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(fraction.padEnd(2, "0")) / 100
  );
}

/** Formats seconds as a CMITimespan with four hour digits (capped at 9999:59:59.99). */
export function formatScormTime(totalSeconds: number): string {
  const hundredths = Math.min(Math.max(0, Math.round(totalSeconds * 100)), 9999 * 360000 + 59 * 6000 + 5999);
  const hours = Math.floor(hundredths / 360000);
  const minutes = Math.floor((hundredths % 360000) / 6000);
  const seconds = Math.floor((hundredths % 6000) / 100);
  const pad = (value: number, length: number) => String(value).padStart(length, "0");
  return `${pad(hours, 4)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(hundredths % 100, 2)}`;
}

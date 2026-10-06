// en-US date/time formatters for English-facing portals (student / teacher / parent / session view).
// Same contract as lib/format-datetime.ts: an explicit timeZone is always passed so the server (UTC)
// and the browser render the same string (prevents React hydration #418). Admin keeps ko-KR formatters.

import { DISPLAY_TIMEZONE } from "@/lib/format-datetime";

type DateInput = Date | string | number;

const toDate = (v: DateInput) => (v instanceof Date ? v : new Date(v));

export function fmtDateTimeEn(v: DateInput, opts?: Intl.DateTimeFormatOptions, timeZone: string = DISPLAY_TIMEZONE): string {
  return toDate(v).toLocaleString("en-US", { ...opts, timeZone });
}

export function fmtDateEn(v: DateInput, opts?: Intl.DateTimeFormatOptions, timeZone: string = DISPLAY_TIMEZONE): string {
  return toDate(v).toLocaleDateString("en-US", { ...opts, timeZone });
}

export function fmtTimeEn(v: DateInput, opts?: Intl.DateTimeFormatOptions, timeZone: string = DISPLAY_TIMEZONE): string {
  return toDate(v).toLocaleTimeString("en-US", { ...opts, timeZone });
}

// `new Intl.DateTimeFormat("en-US", opts).format(v)` replacement.
export function fmtIntlEn(v: DateInput, opts: Intl.DateTimeFormatOptions, timeZone: string = DISPLAY_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone }).format(toDate(v));
}

// en-US number formatting (thousands separators).
export function fmtNumberEn(v: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat("en-US", opts).format(v);
}

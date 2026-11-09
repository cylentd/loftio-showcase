const DAY_LENGTH = 10; // "YYYY-MM-DD" is the first 10 characters of an ISO string.

/** The UTC calendar day a daily allowance or cap counts against, as "YYYY-MM-DD". */
export const utcDay = (date: Date) => date.toISOString().slice(0, DAY_LENGTH);

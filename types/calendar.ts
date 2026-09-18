import { z } from "zod";
import {
  timesheetIntervalSchema,
  timesheetSchema,
  type Timesheet,
  type TimesheetQuery,
} from "@/types/timesheet";

const idString = z.union([z.string(), z.number()]).transform(String);
const nullableId = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => (value == null ? null : String(value)));
const hours = z.coerce.number();

/**
 * Matches Nest CalendarEventDto (agent bookings).
 * endAt / type / status / taskId may be null from the API.
 */
export const calendarEventSchema = z
  .object({
    id: idString,
    title: z.string(),
    startAt: z.string(),
    endAt: z.string().nullable(),
    source: z.string(),
    color: z.string(),
    taskId: nullableId,
    type: z.string().nullable(),
    status: z.string().nullable(),
    location: z.string().nullish(),
    notes: z.string().nullish(),
    metadata: z.unknown().nullish(),
  })
  .passthrough();

/** Presence hours + intervals (month/week availability — no login/logout). */
export const calendarAvailabilitySummarySchema = z
  .object({
    availableHours: hours,
    busyHours: hours,
    totalOnlineHours: hours,
    intervals: z.array(timesheetIntervalSchema).default([]),
  })
  .passthrough();

export const calendarMonthSchema = z
  .object({
    year: z.coerce.number(),
    month: z.coerce.number(),
    events: z.array(calendarEventSchema).default([]),
    availability: calendarAvailabilitySummarySchema,
  })
  .passthrough();

export const calendarWeekDaySchema = z
  .object({
    date: z.string(),
    events: z.array(calendarEventSchema).default([]),
    availability: calendarAvailabilitySummarySchema,
  })
  .passthrough();

export const calendarWeekSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    days: z.array(calendarWeekDaySchema).default([]),
  })
  .passthrough();

export const calendarDaySchema = z
  .object({
    date: z.string(),
    events: z.array(calendarEventSchema).default([]),
    timesheet: timesheetSchema,
  })
  .passthrough();

export const calendarUpcomingItemSchema = z
  .object({
    taskId: idString,
    title: z.string(),
    type: z.string(),
    status: z.string(),
    startAt: z.string(),
    endAt: z.string().nullable(),
    metadata: z.unknown().nullable().optional(),
  })
  .passthrough();

const upcomingItemsSchema = z.array(calendarUpcomingItemSchema);

/** Accept `{ items }` or a bare array. */
export const calendarUpcomingSchema = z.union([
  z
    .object({
      items: upcomingItemsSchema,
    })
    .passthrough(),
  upcomingItemsSchema.transform((items) => ({ items })),
]);

/** Availability calendar — same shape as Work Diary timesheet. */
export const calendarAvailabilitySchema = timesheetSchema;

export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarAvailabilitySummary = z.infer<
  typeof calendarAvailabilitySummarySchema
>;
export type CalendarMonth = z.infer<typeof calendarMonthSchema>;
export type CalendarWeekDay = z.infer<typeof calendarWeekDaySchema>;
export type CalendarWeek = z.infer<typeof calendarWeekSchema>;
export type CalendarDay = z.infer<typeof calendarDaySchema>;
export type CalendarUpcomingItem = z.infer<typeof calendarUpcomingItemSchema>;
export type CalendarUpcoming = { items: CalendarUpcomingItem[] };
export type CalendarAvailability = Timesheet;
export type CalendarAvailabilityQuery = TimesheetQuery;

export type CalendarMonthQuery = { year: number; month: number };
export type CalendarDateQuery = { date: string };
export type CalendarUpcomingQuery = { limit?: number };

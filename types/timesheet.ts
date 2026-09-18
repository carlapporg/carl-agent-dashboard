import { z } from "zod";

export const timesheetStatusSchema = z.enum([
  "ONLINE",
  "AVAILABLE",
  "BUSY",
  "OFFLINE",
]);

export const timesheetIntervalSchema = z.object({
  status: timesheetStatusSchema,
  startedAt: z.string().min(1),
  endedAt: z.string().nullable(),
  source: z.string().nullish().transform((value) => value ?? ""),
});

export const timesheetSchema = z
  .object({
    date: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    loginAt: z.string().nullable(),
    logoutAt: z.string().nullable(),
    totalOnlineHours: z.coerce.number(),
    availableHours: z.coerce.number(),
    busyHours: z.coerce.number(),
    intervals: z.array(timesheetIntervalSchema).default([]),
  })
  .passthrough();

export type TimesheetStatus = z.infer<typeof timesheetStatusSchema>;
export type TimesheetInterval = z.infer<typeof timesheetIntervalSchema>;
export type Timesheet = z.infer<typeof timesheetSchema>;

export type TimesheetQuery =
  | { date: string }
  | { from: string; to: string };

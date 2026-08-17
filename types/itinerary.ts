import { z } from "zod";

export const itineraryItemSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  label: z.string(),
  detail: z.string(),
  status: z.enum(["confirmed", "pending", "cancelled"]),
});

export const itinerarySchema = z.object({
  id: z.string(),
  parentTaskId: z.string(),
  title: z.string(),
  items: z.array(itineraryItemSchema).default([]),
  generatedAt: z.string(),
});

export type ItineraryItem = z.infer<typeof itineraryItemSchema>;
export type Itinerary = z.infer<typeof itinerarySchema>;

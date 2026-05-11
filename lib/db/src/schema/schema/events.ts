import { pgTable, text, integer, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const eventsTable = pgTable("events", {
  id:           text("id").primaryKey(),
  hostHash:     text("host_hash").notNull(),
  title:        text("title").notNull(),
  description:  text("description").notNull().default(""),
  date:         text("date").notNull(),
  location:     text("location").notNull().default(""),
  maxAttendees: integer("max_attendees").default(0),
  imageUrl:     text("image_url"),
  createdAt:    timestamp("created_at").defaultNow(),
});

export const eventAttendeesTable = pgTable("event_attendees", {
  id:        serial("id").primaryKey(),
  eventId:   text("event_id").notNull(),
  userHash:  text("user_hash").notNull(),
  joinedAt:  timestamp("joined_at").defaultNow(),
});

export type Event = typeof eventsTable.$inferSelect;
export type EventAttendee = typeof eventAttendeesTable.$inferSelect;

import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const loungeMessagesTable = pgTable("lounge_messages", {
  id:         serial("id").primaryKey(),
  roomId:     text("room_id").notNull(),
  senderHash: text("sender_hash").notNull(),
  senderName: text("sender_name").notNull(),
  type:       text("type").notNull().default("text"),
  content:    text("content"),
  audioUrl:   text("audio_url"),
  createdAt:  timestamp("created_at").defaultNow(),
});

export type LoungeMessage = typeof loungeMessagesTable.$inferSelect;

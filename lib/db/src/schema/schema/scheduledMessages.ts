import { pgTable, text, integer, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const scheduledMessagesTable = pgTable("scheduled_messages", {
  id:             text("id").primaryKey(),
  userHash:       text("user_hash").notNull(),
  conversationId: integer("conversation_id").notNull(),
  content:        text("content").notNull(),
  messageType:    text("message_type").notNull().default("text"),
  mediaUrl:       text("media_url"),
  sendAt:         timestamp("send_at").notNull(),
  createdAt:      timestamp("created_at").defaultNow(),
  sent:           boolean("sent").notNull().default(false),
});

export type ScheduledMessage = typeof scheduledMessagesTable.$inferSelect;

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const capsulesTable = pgTable("capsules", {
  id:             text("id").primaryKey(),
  authorHash:     text("author_hash").notNull(),
  content:        text("content").notNull(),
  imageUrl:       text("image_url"),
  revealAt:       timestamp("reveal_at").notNull(),
  createdAt:      timestamp("created_at").defaultNow(),
  recipientHash:  text("recipient_hash"),
});

export type Capsule = typeof capsulesTable.$inferSelect;

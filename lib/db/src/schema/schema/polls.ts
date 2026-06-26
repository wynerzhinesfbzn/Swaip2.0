import { pgTable, text, integer, serial, timestamp, boolean, unique } from "drizzle-orm/pg-core";

export const pollsTable = pgTable("swaip_polls", {
  id:            text("id").primaryKey(),
  authorHash:    text("author_hash").notNull(),
  question:      text("question").notNull(),
  allowMultiple: boolean("allow_multiple").notNull().default(false),
  expiresAt:     timestamp("expires_at"),
  createdAt:     timestamp("created_at").defaultNow(),
  contextType:   text("context_type").notNull().default("feed"),
  contextId:     text("context_id"),
});

export const pollOptionsTable = pgTable("poll_options", {
  id:       text("id").primaryKey(),
  pollId:   text("poll_id").notNull(),
  text:     text("text").notNull(),
  position: integer("position").notNull().default(0),
});

export const pollVotesTable = pgTable("poll_votes", {
  id:       serial("id").primaryKey(),
  pollId:   text("poll_id").notNull(),
  optionId: text("option_id").notNull(),
  userHash: text("user_hash").notNull(),
  votedAt:  timestamp("voted_at").defaultNow(),
}, (t) => [unique().on(t.pollId, t.userHash, t.optionId)]);

export type Poll = typeof pollsTable.$inferSelect;
export type PollOption = typeof pollOptionsTable.$inferSelect;
export type PollVote = typeof pollVotesTable.$inferSelect;

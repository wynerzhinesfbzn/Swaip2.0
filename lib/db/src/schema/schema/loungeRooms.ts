import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const loungeRoomsTable = pgTable("lounge_rooms", {
  roomId:       text("room_id").primaryKey(),
  name:         text("name").notNull(),
  theme:        text("theme").notNull().default("cozy"),
  creatorHash:  text("creator_hash").notNull(),
  creatorName:  text("creator_name").notNull(),
  inviteCode:   text("invite_code").notNull().unique(),
  maxPlayers:   integer("max_players").notNull().default(20),
  isActive:     boolean("is_active").notNull().default(true),
  createdAt:    timestamp("created_at").defaultNow(),
  lastActivity: timestamp("last_activity").defaultNow(),
});

export type LoungeRoom = typeof loungeRoomsTable.$inferSelect;

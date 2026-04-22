import { pgTable, text, integer, serial, timestamp, boolean, unique } from "drizzle-orm/pg-core";

export const followsTable = pgTable("follows", {
  id:             serial("id").primaryKey(),
  followerHash:   text("follower_hash").notNull(),
  followingHash:  text("following_hash").notNull(),
  createdAt:      timestamp("created_at").defaultNow(),
}, (t) => [unique().on(t.followerHash, t.followingHash)]);

export const conversationsTable = pgTable("conversations", {
  id:              serial("id").primaryKey(),
  participant1:    text("participant1").notNull(),
  participant2:    text("participant2").notNull(),
  name:            text("name"),
  type:            text("type").notNull().default("dm"),
  lastMessageAt:   timestamp("last_message_at").defaultNow(),
  createdAt:       timestamp("created_at").defaultNow(),
  /* ── Секретные чаты ── */
  isSecret:        boolean("is_secret").default(false),
  pubKey1:         text("pub_key1"),
  pubKey2:         text("pub_key2"),
  burnTimer:       integer("burn_timer").default(0),
}, (t) => [unique().on(t.participant1, t.participant2, t.type)]);

export const conversationParticipantsTable = pgTable("conversation_participants", {
  id:             serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  userHash:       text("user_hash").notNull(),
  joinedAt:       timestamp("joined_at").defaultNow(),
}, (t) => [unique().on(t.conversationId, t.userHash)]);

export const messagesTable = pgTable("messages", {
  id:               serial("id").primaryKey(),
  conversationId:   integer("conversation_id").notNull(),
  senderHash:       text("sender_hash").notNull(),
  content:          text("content").notNull().default(""),
  messageType:      text("message_type").notNull().default("text"),
  mediaUrl:         text("media_url"),
  mediaName:        text("media_name"),
  duration:         integer("duration"),
  isRead:           boolean("is_read").default(false),
  createdAt:        timestamp("created_at").defaultNow(),
  burnAt:           timestamp("burn_at"),
  replyToId:        integer("reply_to_id"),
  editedAt:         timestamp("edited_at"),
  deletedForAll:    boolean("deleted_for_all").default(false),
});

export const messageReactionsTable = pgTable("message_reactions", {
  id:          serial("id").primaryKey(),
  messageId:   integer("message_id").notNull(),
  userHash:    text("user_hash").notNull(),
  emoji:       text("emoji").notNull(),
  createdAt:   timestamp("created_at").defaultNow(),
}, (t) => [unique().on(t.messageId, t.userHash)]);

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id:        serial("id").primaryKey(),
  userHash:  text("user_hash").notNull(),
  endpoint:  text("endpoint").notNull(),
  p256dh:    text("p256dh").notNull(),
  auth:      text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [unique().on(t.userHash, t.endpoint)]);

export type Follow = typeof followsTable.$inferSelect;
export type Conversation = typeof conversationsTable.$inferSelect;
export type ConversationParticipant = typeof conversationParticipantsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type MessageReaction = typeof messageReactionsTable.$inferSelect;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;

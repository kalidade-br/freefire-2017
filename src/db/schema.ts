import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  publicId: text('public_id').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firebaseUid: text('firebase_uid'),
  nickname: text('nickname').notNull(),
  level: integer('level').notNull().default(1),
  gold: integer('gold').notNull().default(1200),
  gems: integer('gems').notNull().default(40),
  matchesPlayed: integer('matches_played').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  rankPoints: integer('rank_points').notNull().default(1000),
  rankedMatches: integer('ranked_matches').notNull().default(0),
  rankedWins: integer('ranked_wins').notNull().default(0),
  totalKills: integer('total_kills').notNull().default(0),
  characterJson: text('character_json').notNull().default('{}'),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  accountId: integer('account_id')
    .references(() => accounts.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const friendships = pgTable('friendships', {
  id: serial('id').primaryKey(),
  requesterId: integer('requester_id')
    .references(() => accounts.id)
    .notNull(),
  addresseeId: integer('addressee_id')
    .references(() => accounts.id)
    .notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accountsRelations = relations(accounts, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  account: one(accounts, {
    fields: [sessions.accountId],
    references: [accounts.id],
  }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  requester: one(accounts, {
    fields: [friendships.requesterId],
    references: [accounts.id],
  }),
  addressee: one(accounts, {
    fields: [friendships.addresseeId],
    references: [accounts.id],
  }),
}));

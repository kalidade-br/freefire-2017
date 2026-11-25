import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  publicId: text('public_id').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firebaseUid: text('firebase_uid').unique(),
  nickname: text('nickname').notNull(),
  level: integer('level').notNull().default(1),
  gold: integer('gold').notNull().default(1200),
  gems: integer('gems').notNull().default(40),
  matchesPlayed: integer('matches_played').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  rankPoints: integer('rank_points').notNull().default(0),
  rankedMatches: integer('ranked_matches').notNull().default(0),
  rankedWins: integer('ranked_wins').notNull().default(0),
  totalKills: integer('total_kills').notNull().default(0),
  avatarId: text('avatar_id').notNull().default('default'),
  unlockedAvatarsJson: text('unlocked_avatars_json').notNull().default('["default","adam","eva","maxim","kelly"]'),
  seasonId: text('season_id').notNull().default('S1'),
  s1PeakRankPoints: integer('s1_peak_rank_points').notNull().default(0),
  s1ClaimedRewardsJson: text('s1_claimed_rewards_json').notNull().default('[]'),
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

export const matchHistory = pgTable('match_history', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id')
    .references(() => accounts.id)
    .notNull(),
  roomId: text('room_id').notNull(),
  mode: text('mode').notNull().default('solo'),
  mapId: text('map_id').notNull().default('bermuda'),
  isRanked: boolean('is_ranked').notNull().default(false),
  placement: integer('placement').notNull().default(51),
  kills: integer('kills').notNull().default(0),
  damage: integer('damage').notNull().default(0),
  survivalSec: integer('survival_sec').notNull().default(0),
  booyah: boolean('booyah').notNull().default(false),
  rankDelta: integer('rank_delta').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accountsRelations = relations(accounts, ({ many }) => ({
  sessions: many(sessions),
  matches: many(matchHistory),
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

export const matchHistoryRelations = relations(matchHistory, ({ one }) => ({
  account: one(accounts, {
    fields: [matchHistory.accountId],
    references: [accounts.id],
  }),
}));

# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Identity Ownership**: Every document under `/users/{uid}` and `/users/{uid}/private/{docId}` MUST belong to `request.auth.uid`, and `data.uid` MUST equal `request.auth.uid` and the path `{uid}`.
2. **PII Isolation**: Email addresses are strictly isolated in `/users/{uid}/private/info` and are only readable/writable by `request.auth.uid == uid`. Public profiles under `/users/{uid}` contain zero PII.
3. **Strict Schema & Bounds**: All strings enforce `.size()` bounds; all integers enforce non-negative bounds (`>= 0`, `level >= 1`); `characterModelId` is strictly one of `adam`, `eva`, `maxim`, or `kelly`; `avatarId` is strictly one of `default`, `adam`, `eva`, `maxim`, `kelly`, `angelic`, or `eagle_eye`; `seasonId` is `'S1'`; `unlockedAvatars` and `s1ClaimedRewards` are bounded lists (`<= 10`); `publicId` matches `^[0-9]{4,16}$`.
4. **Season 1 Reward Gate**: Equipping or unlocking `angelic` or `eagle_eye` avatars requires `s1PeakRankPoints >= 3100 || rankPoints >= 3100` (Mestre in S1).
5. **Immutable & Temporal Fields**: `uid`, `publicId`, and `createdAt` are immutable after creation. `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
6. **Verified Users**: All writes require `request.auth != null && request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: `request.auth == null` reading `/users/user1/private/info` or writing `/users/user1`.
2. **Unverified Email Write**: `request.auth.token.email_verified == false` attempting to create `/users/user1`.
3. **Identity Spoofing on Create**: User `attacker` creating `/users/victim` or setting `data.uid = "victim"` under `/users/attacker`.
4. **Shadow / Ghost Field Injection**: Creating `/users/user1` with extra key `isAdmin: true` or `role: "superadmin"`.
5. **PII Cross-User Read**: Authenticated user `user2` reading `/users/user1/private/info`.
6. **Blanket Collection List Scraping**: User `user2` listing `/users` without `uid == request.auth.uid`.
7. **Timestamp Forgery on Create**: Setting `createdAt` or `updatedAt` to a client-supplied past/future timestamp instead of `request.time`.
8. **Immutable Field Mutation**: Updating `/users/user1` and changing `uid`, `publicId`, or `createdAt`.
9. **Path ID Poisoning**: Attempting to write `/users/invalid!id_with_1500_chars...` (violates `isValidId`).
10. **Negative Currency / Value Poisoning**: Updating `gold: -999` or `level: 0` or `nickname: "<300-char-string>"`.
11. **Invalid Enum Injection**: Updating `characterModelId: "hacker_skin"` or `avatarId: "hacked_avatar"`.
12. **Locked Mestre Avatar Spoofing**: Updating `avatarId: "angelic"` or `unlockedAvatars: ["default", "angelic"]` when `rankPoints < 3100` and `s1PeakRankPoints < 3100`.
13. **Private Subcollection Arbitrary Doc ID**: Writing `/users/user1/private/otherDoc` (only `info` is allowed).

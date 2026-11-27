import { auth } from '../lib/firebase';
import type {
  BrMapId,
  CharacterConfig,
  GameVariant,
  GladiadoresFormat,
  MatchMode,
  NetworkSyncPreset,
  WeaponId,
} from './types';
import type {
  ClientMatchStatePush,
  FriendEntry,
  FriendRequestEntry,
  MatchRoomAction,
  MatchRoomJoinInfo,
  MatchRoomSnapshot,
  MatchmakingSearchStatus,
  PartyInvitePayload,
  PartyState,
  PublicPlayerAccount,
  RemoteGlooWallSync,
  RemoteKillFeedEvent,
  SearchingPoolInfo,
} from '../shared/multiplayerTypes';

const RAW_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const RAW_WS_BASE = (import.meta.env.VITE_WS_URL || '').trim().replace(/\/+$/, '');
const MP_TOKEN_STORAGE_KEY = 'zonazero2017_mp_token_v1';

export function isGuestAccount(acc?: PublicPlayerAccount | null): boolean {
  return Boolean(acc?.username?.startsWith('gst_'));
}

function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return RAW_API_BASE ? `${RAW_API_BASE}${path}` : path;
}

function buildWsUrl(token: string): string {
  const encoded = encodeURIComponent(token);
  if (RAW_WS_BASE) {
    return `${RAW_WS_BASE}/ws?token=${encoded}`;
  }
  if (RAW_API_BASE) {
    const wsBase = RAW_API_BASE.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
    return `${wsBase}/ws?token=${encoded}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws?token=${encoded}`;
}

export interface PingStatus {
  pingMs: number;
  disconnected: boolean;
  label: string;
}

export type MultiplayerServerEvent =
  | { type: 'party_update'; party: PartyState }
  | { type: 'party_invite'; invite: PartyInvitePayload }
  | { type: 'match_found'; joinInfo: MatchRoomJoinInfo }
  | { type: 'room_snapshot'; snapshot: MatchRoomSnapshot }
  | {
      type: 'remote_shot';
      accountId: number;
      weaponId: WeaponId;
      originX: number;
      originY: number;
      originZ: number;
      hitX: number;
      hitY: number;
      hitZ: number;
    }
  | {
      type: 'incoming_damage';
      fromAccountId: number;
      fromNickname: string;
      fromX: number;
      fromZ: number;
      damage: number;
      isHeadshot: boolean;
      weaponId: WeaponId;
    }
  | {
      type: 'revived_by_ally';
      fromAccountId: number;
      fromNickname: string;
    }
  | {
      type: 'revive_from_shop_drop';
      fromAccountId: number;
      fromNickname: string;
      shopX: number;
      shopZ: number;
    }
  | { type: 'loot_collected'; lootId: string }
  | { type: 'gloo_spawned'; wall: RemoteGlooWallSync }
  | { type: 'kill_feed_event'; entry: RemoteKillFeedEvent }
  | {
      type: 'remote_bot_damage';
      fromAccountId: number;
      fromNickname: string;
      botId: string;
      damage: number;
      isHeadshot: boolean;
      weaponShort: string;
      attackerX: number;
      attackerZ: number;
    }
  | {
      type: 'spectate_damage_event';
      attackerAccountId: number;
      targetAccountId?: number;
      botId?: string;
      damage: number;
      isHeadshot: boolean;
    }
  | { type: 'friends_refresh' }
  | { type: 'match_kicked'; roomId: string; reason: string }
  | { type: 'webrtc_signal'; fromAccountId: number; signal: unknown }
  | {
      type: 'ws_ready';
      serverTimeMs: number;
      capabilities: { cloudSql: boolean; supabase: boolean; websocket: boolean };
    }
  | { type: 'leaderboard_update' }
  | { type: 'matchmaking_status'; status: MatchmakingSearchStatus }
  | { type: 'matchmaking_queue_update'; pools: SearchingPoolInfo[] }
  | {
      type: 'glad_ready';
      accountId: number;
      round: number;
    }
  | {
      type: 'chat_message';
      scope: 'party' | 'match';
      fromAccountId: number;
      nickname: string;
      text: string;
      sentAtMs: number;
    };

type EventListener = (ev: MultiplayerServerEvent) => void;

class MultiplayerClient {
  private token: string | null = null;
  private ws: WebSocket | null = null;
  private wsToken: string | null = null;
  private wsConnecting = false;
  private wsEverOpened = false;
  private wsFailedWithoutOpenCount = 0;
  private wsUnsupported = false;
  private reconnectTimer: number | null = null;
  private authEpoch = 0;
  private listeners = new Set<EventListener>();
  private lastRoomSnapshot: MatchRoomSnapshot | null = null;
  private lastParty: PartyState | null = null;
  private pendingWebrtcSignals: Array<{
    targetAccountId: number;
    signal: unknown;
    queuedAtMs: number;
  }> = [];

  // Real-time RTT / Ping tracking (ms + 999+ disconnect detection)
  private lastMeasuredPingMs = 24;
  private pendingStartAtMs: number | null = null;
  private lastPingProbeSentAtMs = 0;
  private consecutiveFailures = 0;
  private connectionLost = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  private pingProbeTimer: number | null = null;
  private probeInFlight = false;
  private syncPreset: NetworkSyncPreset = 'fast';
  private lowLatencyMode = true;
  private highPingSmoothing = true;
  private activeSyncAbort: AbortController | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedToken = window.localStorage.getItem(MP_TOKEN_STORAGE_KEY);
        if (savedToken && savedToken.trim().length > 0) {
          this.token = savedToken.trim();
        }
      } catch {
        // Ignore storage read failures
      }
      window.addEventListener('offline', () => {
        this.connectionLost = true;
      });
      window.addEventListener('online', () => {
        this.connectionLost = false;
        this.consecutiveFailures = 0;
        this.pendingStartAtMs = null;
        void this.probePing();
      });

      this.startPingLoop();
      if (this.token) {
        this.connectWs();
      }
    }
  }

  public configureNetwork(opts: {
    syncPreset?: NetworkSyncPreset;
    lowLatencyMode?: boolean;
    highPingSmoothing?: boolean;
  }): void {
    if (opts.syncPreset) this.syncPreset = opts.syncPreset;
    if (typeof opts.lowLatencyMode === 'boolean') this.lowLatencyMode = opts.lowLatencyMode;
    if (typeof opts.highPingSmoothing === 'boolean') this.highPingSmoothing = opts.highPingSmoothing;
    if (typeof window !== 'undefined') {
      if (this.pingProbeTimer !== null) {
        window.clearInterval(this.pingProbeTimer);
        this.pingProbeTimer = null;
      }
      this.startPingLoop();
    }
  }

  public getNetworkConfig(): {
    syncPreset: NetworkSyncPreset;
    lowLatencyMode: boolean;
    highPingSmoothing: boolean;
    wsConnected: boolean;
  } {
    return {
      syncPreset: this.syncPreset,
      lowLatencyMode: this.lowLatencyMode,
      highPingSmoothing: this.highPingSmoothing,
      wsConnected: Boolean(this.ws && this.ws.readyState === WebSocket.OPEN),
    };
  }

  private getPingProbeIntervalMs(): number {
    if (this.lowLatencyMode || this.syncPreset === 'ultra') return 800;
    if (this.syncPreset === 'economy') return 1800;
    return 1100;
  }

  private startPingLoop(): void {
    if (typeof window === 'undefined' || this.pingProbeTimer !== null) return;
    void this.probePing();
    this.pingProbeTimer = window.setInterval(() => {
      void this.probePing();
    }, this.getPingProbeIntervalMs());
  }

  private markRequestStarted(): number {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.pendingStartAtMs === null) {
      this.pendingStartAtMs = now;
    }
    return now;
  }

  private markRequestSucceeded(startedAtMs: number): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const rtt = Math.max(1, Math.round(now - startedAtMs));
    this.lastMeasuredPingMs =
      this.lastMeasuredPingMs > 0
        ? Math.round(this.lastMeasuredPingMs * 0.45 + rtt * 0.55)
        : rtt;
    this.pendingStartAtMs = null;
    this.consecutiveFailures = 0;
    this.connectionLost = false;
  }

  private markConnectionFailed(): void {
    this.consecutiveFailures += 1;
    this.pendingStartAtMs = null;
    if (
      this.consecutiveFailures >= 3 ||
      (typeof navigator !== 'undefined' && navigator.onLine === false)
    ) {
      this.connectionLost = true;
    }
  }

  public async probePing(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.connectionLost = true;
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - this.lastPingProbeSentAtMs < 450) return;
      this.lastPingProbeSentAtMs = now;
      const sentAt = this.markRequestStarted();
      try {
        this.ws.send(JSON.stringify({ type: 'ping', clientTs: sentAt }));
        return;
      } catch {
        this.markConnectionFailed();
      }
    }

    if (this.probeInFlight) return;
    this.probeInFlight = true;
    const t0 = this.markRequestStarted();
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = window.setTimeout(() => ctrl?.abort(), 2800);
    try {
      const res = await fetch(buildApiUrl('/api/ping'), {
        method: 'GET',
        cache: 'no-store',
        signal: ctrl?.signal,
      });
      if (!res.ok) {
        this.markConnectionFailed();
      } else {
        this.markRequestSucceeded(t0);
      }
    } catch {
      this.markConnectionFailed();
    } finally {
      window.clearTimeout(timeoutId);
      this.probeInFlight = false;
    }
  }

  public getPingInfo(): PingStatus {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { pingMs: 999, disconnected: true, label: '999+' };
    }
    if (this.connectionLost) {
      return { pingMs: 999, disconnected: true, label: '999+' };
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const pendingElapsed =
      this.pendingStartAtMs !== null ? Math.max(0, Math.round(now - this.pendingStartAtMs)) : 0;

    if (pendingElapsed >= 2500) {
      return { pingMs: 999, disconnected: true, label: '999+' };
    }

    const effective =
      pendingElapsed > this.lastMeasuredPingMs
        ? Math.min(998, Math.round(this.lastMeasuredPingMs * 0.5 + pendingElapsed * 0.5))
        : this.lastMeasuredPingMs;

    if (effective >= 999) {
      return { pingMs: 999, disconnected: true, label: '999+' };
    }
    return {
      pingMs: Math.max(1, effective),
      disconnected: false,
      label: `${Math.max(1, effective)}ms`,
    };
  }

  public getToken(): string | null {
    return this.token;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.token);
  }

  public setToken(token: string | null): void {
    const changed = this.token !== token;
    this.token = token;
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          window.localStorage.setItem(MP_TOKEN_STORAGE_KEY, token);
        } else {
          window.localStorage.removeItem(MP_TOKEN_STORAGE_KEY);
        }
      } catch {
        // Ignore storage write failures
      }
    }
    if (token) {
      if (changed) {
        this.disconnectWs();
      }
      this.connectWs();
    } else {
      this.disconnectWs();
    }
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(ev: MultiplayerServerEvent): void {
    if (ev.type === 'party_update') {
      this.lastParty = ev.party;
    } else if (ev.type === 'room_snapshot') {
      this.lastRoomSnapshot = ev.snapshot;
      this.consecutiveFailures = 0;
      this.connectionLost = false;
    }
    this.listeners.forEach((cb) => {
      try {
        cb(ev);
      } catch (err) {
        console.error('Multiplayer event listener error:', err);
      }
    });
  }

  public getLatestSnapshot(): MatchRoomSnapshot | null {
    return this.lastRoomSnapshot;
  }

  public getLatestParty(): PartyState | null {
    return this.lastParty;
  }

  public connectWs(): void {
    if (typeof window === 'undefined' || !this.token) return;
    if (this.wsUnsupported) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      if (this.wsToken === this.token) {
        return;
      }
      this.disconnectWs();
    }
    if (this.wsConnecting && this.wsToken === this.token) return;

    this.wsConnecting = true;
    const activeToken = this.token;
    this.wsToken = activeToken;
    const url = buildWsUrl(activeToken);

    try {
      const socket = new WebSocket(url);
      this.ws = socket;
      let openedThisSocket = false;

      socket.onopen = () => {
        openedThisSocket = true;
        this.wsEverOpened = true;
        this.wsFailedWithoutOpenCount = 0;
        this.wsConnecting = false;
        this.connectionLost = false;
        const cutoff = Date.now() - 12_000;
        const toFlush = this.pendingWebrtcSignals.filter((item) => item.queuedAtMs >= cutoff);
        this.pendingWebrtcSignals = [];
        for (const item of toFlush) {
          try {
            socket.send(
              JSON.stringify({
                type: 'webrtc_signal',
                targetAccountId: item.targetAccountId,
                signal: item.signal,
              }),
            );
          } catch {
            // ignore
          }
        }
        void this.probePing();
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as Record<string, unknown>;
          if (parsed && parsed.type === 'pong') {
            const clientTs = Number(parsed.clientTs);
            if (Number.isFinite(clientTs) && clientTs > 0) {
              this.markRequestSucceeded(clientTs);
            } else {
              this.connectionLost = false;
              this.pendingStartAtMs = null;
            }
            return;
          }
          const typed = parsed as unknown as MultiplayerServerEvent;
          if (typed && typeof typed.type === 'string') {
            this.emit(typed);
          }
        } catch {
          // Ignore malformed WS payloads
        }
      };

      socket.onerror = () => {
        if (this.ws === socket) {
          this.wsConnecting = false;
        }
      };

      socket.onclose = (ev) => {
        const isCurrentSocket = this.ws === socket;
        if (isCurrentSocket) {
          this.wsConnecting = false;
          this.ws = null;
          this.wsToken = null;
        } else {
          return;
        }
        // Code 4001 means invalid/expired token
        if (ev.code === 4001) {
          if (this.token === activeToken) {
            this.setToken(null);
          }
          return;
        }
        if (!openedThisSocket && !this.wsEverOpened) {
          this.wsFailedWithoutOpenCount += 1;
          if (this.wsFailedWithoutOpenCount >= 2 && !RAW_WS_BASE && !RAW_API_BASE) {
            // Serverless hosts (e.g. Vercel) do not support WebSocket upgrades; fall back cleanly to HTTP polling
            this.wsUnsupported = true;
            return;
          }
        } else if (this.token) {
          this.pendingStartAtMs = null;
        }
        if (this.token && !this.wsUnsupported && this.reconnectTimer === null) {
          const delay = this.lowLatencyMode ? 550 : 1800;
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connectWs();
          }, delay);
        }
      };
    } catch {
      this.wsConnecting = false;
    }
  }

  public disconnectWs(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      this.wsToken = null;
      try {
        old.close();
      } catch {
        // ignore
      }
    }
    this.wsToken = null;
    this.wsConnecting = false;
  }

  private async request<T>(
    url: string,
    options: RequestInit = {},
    allowFirebaseRetry = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const t0 = this.markRequestStarted();
    let res: Response;
    try {
      res = await fetch(buildApiUrl(url), {
        ...options,
        headers,
      });
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        this.markConnectionFailed();
      }
      throw err;
    }

    this.markRequestSucceeded(t0);

    if (
      res.status === 401 &&
      allowFirebaseRetry &&
      auth.currentUser &&
      !url.startsWith('/api/auth/login') &&
      !url.startsWith('/api/auth/register') &&
      !url.startsWith('/api/auth/firebase')
    ) {
      try {
        const fbIdToken = await auth.currentUser.getIdToken();
        const refreshed = await this.loginWithFirebase({
          idToken: fbIdToken,
          nickname: auth.currentUser.displayName || undefined,
        });
        this.token = refreshed.token;
        return this.request<T>(
          url,
          {
            ...options,
            headers: {
              ...(options.headers as Record<string, string> | undefined),
              'X-Firebase-Id-Token': fbIdToken,
            },
          },
          false,
        );
      } catch {
        // Fall through to normal 401 error handling
      }
    }

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      if (res.status === 401 && this.token && !url.startsWith('/api/auth/login')) {
        this.setToken(null);
      }
      const errMsg =
        typeof data.error === 'string' && data.error.length > 0
          ? data.error
          : `Erro na requisição (${res.status})`;
      throw Object.assign(new Error(errMsg), { status: res.status });
    }

    return data as T;
  }

  // --- AUTH ---
  public async register(params: {
    username: string;
    password: string;
    nickname?: string;
    character?: Partial<CharacterConfig>;
  }): Promise<{
    token: string;
    account: PublicPlayerAccount;
    party: PartyState;
    invites: PartyInvitePayload[];
  }> {
    const res = await this.request<{
      token: string;
      account: PublicPlayerAccount;
      party: PartyState;
      invites: PartyInvitePayload[];
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    this.authEpoch += 1;
    this.setToken(res.token);
    this.emit({ type: 'party_update', party: res.party });
    return res;
  }

  public async login(params: {
    username: string;
    password: string;
  }): Promise<{
    token: string;
    account: PublicPlayerAccount;
    party: PartyState;
    invites: PartyInvitePayload[];
  }> {
    const res = await this.request<{
      token: string;
      account: PublicPlayerAccount;
      party: PartyState;
      invites: PartyInvitePayload[];
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    this.authEpoch += 1;
    this.setToken(res.token);
    this.emit({ type: 'party_update', party: res.party });
    return res;
  }

  private inFlightFirebaseLogin: Promise<{
    token: string;
    account: PublicPlayerAccount;
    party: PartyState;
    invites: PartyInvitePayload[];
  }> | null = null;

  public async loginWithFirebase(params: {
    idToken: string;
    nickname?: string;
    character?: Partial<CharacterConfig>;
  }): Promise<{
    token: string;
    account: PublicPlayerAccount;
    party: PartyState;
    invites: PartyInvitePayload[];
  }> {
    if (this.inFlightFirebaseLogin) {
      return this.inFlightFirebaseLogin;
    }
    const startEpoch = this.authEpoch;
    this.inFlightFirebaseLogin = (async () => {
      try {
        const res = await this.request<{
          token: string;
          account: PublicPlayerAccount;
          party: PartyState;
          invites: PartyInvitePayload[];
        }>('/api/auth/firebase', {
          method: 'POST',
          body: JSON.stringify(params),
        });
        if (this.authEpoch === startEpoch) {
          this.authEpoch += 1;
          this.setToken(res.token);
          this.emit({ type: 'party_update', party: res.party });
        }
        return res;
      } finally {
        this.inFlightFirebaseLogin = null;
      }
    })();
    return this.inFlightFirebaseLogin;
  }

  private inFlightGuestLogin: Promise<{
    token: string;
    account: PublicPlayerAccount;
    party: PartyState;
    invites: PartyInvitePayload[];
  }> | null = null;

  public async loginGuest(params: {
    nickname?: string;
    character?: Partial<CharacterConfig>;
  } = {}): Promise<{
    token: string;
    account: PublicPlayerAccount;
    party: PartyState;
    invites: PartyInvitePayload[];
  }> {
    if (this.inFlightGuestLogin) {
      return this.inFlightGuestLogin;
    }
    const startEpoch = this.authEpoch;
    this.inFlightGuestLogin = (async () => {
      try {
        const res = await this.request<{
          token: string;
          account: PublicPlayerAccount;
          party: PartyState;
          invites: PartyInvitePayload[];
        }>('/api/auth/guest', {
          method: 'POST',
          body: JSON.stringify(params),
        });
        if (this.authEpoch === startEpoch) {
          this.authEpoch += 1;
          this.setToken(res.token);
          this.emit({ type: 'party_update', party: res.party });
        }
        return res;
      } finally {
        this.inFlightGuestLogin = null;
      }
    })();
    return this.inFlightGuestLogin;
  }

  public async loginWithSupabase(params: {
    accessToken: string;
    nickname?: string;
    character?: Partial<CharacterConfig>;
  }): Promise<{
    token: string;
    account: PublicPlayerAccount;
    party: PartyState;
    invites: PartyInvitePayload[];
  }> {
    const res = await this.request<{
      token: string;
      account: PublicPlayerAccount;
      party: PartyState;
      invites: PartyInvitePayload[];
    }>('/api/auth/supabase', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    this.authEpoch += 1;
    this.setToken(res.token);
    this.emit({ type: 'party_update', party: res.party });
    return res;
  }

  public async logout(): Promise<void> {
    this.authEpoch += 1;
    const tokenToRevoke = this.token;
    this.lastParty = null;
    this.lastRoomSnapshot = null;
    this.pendingWebrtcSignals = [];
    this.setToken(null);
    if (tokenToRevoke && typeof fetch !== 'undefined') {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer =
        typeof window !== 'undefined' ? window.setTimeout(() => ctrl?.abort(), 2500) : null;
      try {
        await fetch(buildApiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenToRevoke}`,
          },
          signal: ctrl?.signal,
        });
      } catch {
        // Ignore network/abort error during logout
      } finally {
        if (timer !== null && typeof window !== 'undefined') {
          window.clearTimeout(timer);
        }
      }
    }
  }

  public async getMe(): Promise<{
    account: PublicPlayerAccount;
    party: PartyState;
    invites: PartyInvitePayload[];
  }> {
    const res = await this.request<{
      account: PublicPlayerAccount;
      party: PartyState;
      invites: PartyInvitePayload[];
    }>('/api/auth/me');
    this.emit({ type: 'party_update', party: res.party });
    this.connectWs();
    return res;
  }

  public async updateProfile(patch: Partial<{
    nickname: string;
    avatarId: string;
    level: number;
    gold: number;
    gems: number;
    matchesPlayed: number;
    wins: number;
    rankPoints: number;
    rankedMatches: number;
    rankedWins: number;
    totalKills: number;
    character: Partial<CharacterConfig>;
  }>): Promise<{ account: PublicPlayerAccount }> {
    return this.request<{ account: PublicPlayerAccount }>('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  }

  public async claimSeason1Reward(rewardId: string): Promise<{
    account: PublicPlayerAccount;
    grantedGold: number;
    grantedGems: number;
    grantedAvatars: string[];
  }> {
    return this.request('/api/season/s1/claim', {
      method: 'POST',
      body: JSON.stringify({ rewardId }),
    });
  }

  // --- PLAYERS & FRIENDS ---
  public async searchPlayer(query: string): Promise<{ player: PublicPlayerAccount }> {
    return this.request<{ player: PublicPlayerAccount }>(
      `/api/players/search?q=${encodeURIComponent(query)}`,
    );
  }

  public async getPlayerProfile(accountId: number): Promise<{ player: PublicPlayerAccount }> {
    return this.request<{ player: PublicPlayerAccount }>(
      `/api/players/${encodeURIComponent(String(accountId))}/profile`,
    );
  }

  public async getFriends(): Promise<{
    friends: FriendEntry[];
    incoming: FriendRequestEntry[];
    outgoing: FriendRequestEntry[];
  }> {
    return this.request('/api/friends');
  }

  public async sendFriendRequest(target: string): Promise<{ status: string; target: PublicPlayerAccount }> {
    return this.request('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ target }),
    });
  }

  public async respondFriendRequest(
    friendshipId: number,
    accept: boolean,
  ): Promise<{
    friends: FriendEntry[];
    incoming: FriendRequestEntry[];
    outgoing: FriendRequestEntry[];
  }> {
    return this.request('/api/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ friendshipId, accept }),
    });
  }

  public async removeFriend(friendId: number): Promise<void> {
    await this.request(`/api/friends/${encodeURIComponent(String(friendId))}`, {
      method: 'DELETE',
    });
  }

  // --- PARTY / SQUAD ---
  public async getParty(): Promise<{
    party: PartyState;
    invites: PartyInvitePayload[];
    roomJoinInfo: MatchRoomJoinInfo | null;
  }> {
    const res = await this.request<{
      party: PartyState;
      invites: PartyInvitePayload[];
      roomJoinInfo: MatchRoomJoinInfo | null;
    }>('/api/party');
    this.emit({ type: 'party_update', party: res.party });
    return res;
  }

  public async setPartyConfig(cfg: Partial<{
    gameVariant: GameVariant;
    gladiadoresFormat: GladiadoresFormat;
    mode: MatchMode;
    mapId: BrMapId;
    isRanked: boolean;
    autoFillBots: boolean;
  }>): Promise<{ party: PartyState }> {
    const res = await this.request<{ party: PartyState }>('/api/party/config', {
      method: 'POST',
      body: JSON.stringify(cfg),
    });
    this.emit({ type: 'party_update', party: res.party });
    return res;
  }

  public async inviteToParty(targetAccountId: number): Promise<{ ok: boolean; party: PartyState }> {
    const res = await this.request<{ ok: boolean; party: PartyState }>('/api/party/invite', {
      method: 'POST',
      body: JSON.stringify({ targetAccountId }),
    });
    this.emit({ type: 'party_update', party: res.party });
    return res;
  }

  public async respondPartyInvite(
    inviteId: string,
    accept: boolean,
  ): Promise<{ ok: boolean; party: PartyState }> {
    const res = await this.request<{ ok: boolean; party: PartyState }>('/api/party/invite/respond', {
      method: 'POST',
      body: JSON.stringify({ inviteId, accept }),
    });
    this.emit({ type: 'party_update', party: res.party });
    return res;
  }

  public async leaveParty(): Promise<{ party: PartyState }> {
    const res = await this.request<{ party: PartyState }>('/api/party/leave', { method: 'POST' });
    this.emit({ type: 'party_update', party: res.party });
    return res;
  }

  public async kickPartyMember(targetAccountId: number): Promise<{ party: PartyState }> {
    const res = await this.request<{ party: PartyState }>('/api/party/kick', {
      method: 'POST',
      body: JSON.stringify({ targetAccountId }),
    });
    this.emit({ type: 'party_update', party: res.party });
    return res;
  }

  // --- MATCHMAKING QUEUE (INITIAL LOBBY) & 50MS SYNC ---
  public async startMatchmaking(config?: Partial<{
    gameVariant: GameVariant;
    gladiadoresFormat: GladiadoresFormat;
    mode: MatchMode;
    mapId: BrMapId;
    isRanked: boolean;
    autoFillBots: boolean;
  }>): Promise<{ search: MatchmakingSearchStatus; party?: PartyState; joinInfo?: MatchRoomJoinInfo }> {
    this.lastRoomSnapshot = null;
    const res = await this.request<{
      search: MatchmakingSearchStatus;
      party?: PartyState;
      joinInfo?: MatchRoomJoinInfo;
    }>('/api/matchmaking/start', {
      method: 'POST',
      body: config ? JSON.stringify(config) : undefined,
    });
    if (res.party) {
      this.emit({ type: 'party_update', party: res.party });
    }
    return res;
  }

  public async joinMatchmakingQueue(
    poolKey: string,
  ): Promise<{ search: MatchmakingSearchStatus; party: PartyState }> {
    this.lastRoomSnapshot = null;
    const res = await this.request<{ search: MatchmakingSearchStatus; party: PartyState }>(
      '/api/matchmaking/join-queue',
      {
        method: 'POST',
        body: JSON.stringify({ poolKey }),
      },
    );
    this.emit({ type: 'party_update', party: res.party });
    return res;
  }

  public async cancelMatchmaking(): Promise<{ ok: boolean; party?: PartyState }> {
    if (!this.token) return { ok: true };
    const res = await this.request<{ ok: boolean; party?: PartyState }>(
      '/api/matchmaking/cancel',
      { method: 'POST' },
    );
    if (res.party) {
      this.emit({ type: 'party_update', party: res.party });
    }
    return res;
  }

  public async getMatchmakingStatus(): Promise<{
    search: MatchmakingSearchStatus;
    joinInfo?: MatchRoomJoinInfo;
  }> {
    return this.request('/api/matchmaking/status');
  }

  public async getSearchingPlayers(): Promise<{ pools: SearchingPoolInfo[] }> {
    return this.request('/api/matchmaking/searching');
  }

  public async leaveMatch(): Promise<void> {
    this.lastRoomSnapshot = null;
    if (!this.token) return;
    await this.request('/api/match/leave', { method: 'POST' }).catch(() => undefined);
  }

  public async syncRoomHttp(
    roomId: string,
    state?: ClientMatchStatePush,
    actions?: MatchRoomAction[],
  ): Promise<MatchRoomSnapshot> {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (ctrl) this.activeSyncAbort = ctrl;
    const timeoutMs = 2800;
    const timer =
      typeof window !== 'undefined' && ctrl
        ? window.setTimeout(() => ctrl.abort(), timeoutMs)
        : null;
    try {
      const res = await this.request<{ snapshot: MatchRoomSnapshot }>(
        `/api/match/${encodeURIComponent(roomId)}/sync`,
        {
          method: 'POST',
          cache: 'no-store',
          signal: ctrl?.signal,
          body: JSON.stringify({ state, actions }),
        },
      );
      this.emit({ type: 'room_snapshot', snapshot: res.snapshot });
      return res.snapshot;
    } finally {
      if (timer !== null) window.clearTimeout(timer);
      if (this.activeSyncAbort === ctrl) this.activeSyncAbort = null;
    }
  }

  public sendWsState(state: ClientMatchStatePush): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'sync_state', state }));
      return true;
    }
    return false;
  }

  public sendWsAction(action: MatchRoomAction): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'room_action', action }));
      return true;
    }
    return false;
  }

  public sendWebrtcSignal(targetAccountId: number, signal: unknown): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'webrtc_signal', targetAccountId, signal }));
      return true;
    }
    if (this.token) {
      if (this.pendingWebrtcSignals.length > 64) {
        this.pendingWebrtcSignals.shift();
      }
      this.pendingWebrtcSignals.push({
        targetAccountId,
        signal,
        queuedAtMs: Date.now(),
      });
      this.connectWs();
    }
    return false;
  }

  public sendChatMessage(text: string): boolean {
    const clean = text.trim().slice(0, 160);
    if (!clean) return false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'lobby_chat', text: clean }));
      return true;
    }
    return false;
  }

  public async getLeaderboard(limit = 50): Promise<{
    source: string;
    leaderboard: Array<{
      publicId: string;
      nickname: string;
      level: number;
      rankPoints: number;
      wins: number;
      totalKills: number;
      matchesPlayed: number;
    }>;
  }> {
    return this.request(`/api/leaderboard?limit=${encodeURIComponent(String(limit))}`);
  }

  public async getMyMatchHistory(limit = 20): Promise<{
    matches: Array<{
      id: number;
      roomId: string;
      mode: string;
      mapId: string;
      isRanked: boolean;
      placement: number;
      kills: number;
      damage: number;
      survivalSec: number;
      booyah: boolean;
      rankDelta: number;
      createdAt: string;
    }>;
  }> {
    return this.request(`/api/matches/me?limit=${encodeURIComponent(String(limit))}`);
  }

  public async recordMatchResult(entry: {
    roomId: string;
    mode: string;
    mapId: string;
    isRanked: boolean;
    placement: number;
    kills: number;
    damage: number;
    survivalSec: number;
    booyah: boolean;
    rankDelta: number;
  }): Promise<void> {
    if (!this.token) return;
    await this.request('/api/matches/record', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }
}

export const multiplayerClient = new MultiplayerClient();

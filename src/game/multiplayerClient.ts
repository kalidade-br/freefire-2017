import { auth } from '../lib/firebase';
import type {
  CharacterConfig,
  MatchMode,
  WeaponId,
} from './types';
import type {
  ClientMatchStatePush,
  FriendEntry,
  FriendRequestEntry,
  MatchRoomAction,
  MatchRoomJoinInfo,
  MatchRoomSnapshot,
  PartyInvitePayload,
  PartyState,
  PublicPlayerAccount,
  RemoteGlooWallSync,
  RemoteKillFeedEvent,
} from '../shared/multiplayerTypes';

const RAW_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const RAW_WS_BASE = (import.meta.env.VITE_WS_URL || '').trim().replace(/\/+$/, '');

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
  | { type: 'friends_refresh' }
  | { type: 'match_kicked'; roomId: string; reason: string }
  | { type: 'webrtc_signal'; fromAccountId: number; signal: unknown };

type EventListener = (ev: MultiplayerServerEvent) => void;

class MultiplayerClient {
  private token: string | null = null;
  private ws: WebSocket | null = null;
  private wsConnecting = false;
  private wsEverOpened = false;
  private wsFailedWithoutOpenCount = 0;
  private wsUnsupported = false;
  private reconnectTimer: number | null = null;
  private listeners = new Set<EventListener>();
  private lastRoomSnapshot: MatchRoomSnapshot | null = null;

  // Real-time RTT / Ping tracking (ms + 999+ disconnect detection)
  private lastMeasuredPingMs = 24;
  private pendingStartAtMs: number | null = null;
  private lastWsSyncSentAtMs: number | null = null;
  private connectionLost = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  private pingProbeTimer: number | null = null;
  private probeInFlight = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', () => {
        this.connectionLost = true;
      });
      window.addEventListener('online', () => {
        this.connectionLost = false;
        this.pendingStartAtMs = null;
        void this.probePing();
      });

      this.startPingLoop();
    }
  }

  private startPingLoop(): void {
    if (typeof window === 'undefined' || this.pingProbeTimer !== null) return;
    void this.probePing();
    this.pingProbeTimer = window.setInterval(() => {
      void this.probePing();
    }, 1000);
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
    this.lastMeasuredPingMs = rtt;
    this.pendingStartAtMs = null;
    this.connectionLost = false;
  }

  private markConnectionFailed(): void {
    this.connectionLost = true;
    this.pendingStartAtMs = null;
  }

  public async probePing(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.connectionLost = true;
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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
    const timeoutId = window.setTimeout(() => ctrl?.abort(), 2200);
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

    if (pendingElapsed >= 999) {
      return { pingMs: 999, disconnected: true, label: '999+' };
    }

    const effective =
      pendingElapsed > this.lastMeasuredPingMs ? pendingElapsed : this.lastMeasuredPingMs;

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
    this.token = token;
    if (token) {
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
    if (ev.type === 'room_snapshot') {
      this.lastRoomSnapshot = ev.snapshot;
      if (this.lastWsSyncSentAtMs !== null) {
        this.markRequestSucceeded(this.lastWsSyncSentAtMs);
        this.lastWsSyncSentAtMs = null;
      }
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

  public connectWs(): void {
    if (typeof window === 'undefined' || !this.token) return;
    if (this.wsUnsupported) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.wsConnecting) return;

    this.wsConnecting = true;
    const url = buildWsUrl(this.token);

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
        this.wsConnecting = false;
        if (this.token && this.wsEverOpened) {
          this.markConnectionFailed();
        }
      };

      socket.onclose = (ev) => {
        this.wsConnecting = false;
        if (this.ws === socket) {
          this.ws = null;
        }
        // Code 4001 means invalid/expired token
        if (ev.code === 4001) {
          this.setToken(null);
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
          this.markConnectionFailed();
        }
        if (this.token && !this.wsUnsupported && this.reconnectTimer === null) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connectWs();
          }, 1800);
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
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
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
      this.markConnectionFailed();
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
    this.setToken(res.token);
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
    this.setToken(res.token);
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
        this.setToken(res.token);
        return res;
      } finally {
        this.inFlightFirebaseLogin = null;
      }
    })();
    return this.inFlightFirebaseLogin;
  }

  public async logout(): Promise<void> {
    if (this.token) {
      await this.request('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    }
    this.setToken(null);
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
    this.connectWs();
    return res;
  }

  public async updateProfile(patch: Partial<{
    nickname: string;
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
    return this.request('/api/party');
  }

  public async setPartyConfig(cfg: Partial<{
    mode: MatchMode;
    isRanked: boolean;
    autoFillBots: boolean;
  }>): Promise<{ party: PartyState }> {
    return this.request('/api/party/config', {
      method: 'POST',
      body: JSON.stringify(cfg),
    });
  }

  public async inviteToParty(targetAccountId: number): Promise<{ ok: boolean; party: PartyState }> {
    return this.request('/api/party/invite', {
      method: 'POST',
      body: JSON.stringify({ targetAccountId }),
    });
  }

  public async respondPartyInvite(
    inviteId: string,
    accept: boolean,
  ): Promise<{ ok: boolean; party: PartyState }> {
    return this.request('/api/party/invite/respond', {
      method: 'POST',
      body: JSON.stringify({ inviteId, accept }),
    });
  }

  public async leaveParty(): Promise<{ party: PartyState }> {
    return this.request('/api/party/leave', { method: 'POST' });
  }

  public async kickPartyMember(targetAccountId: number): Promise<{ party: PartyState }> {
    return this.request('/api/party/kick', {
      method: 'POST',
      body: JSON.stringify({ targetAccountId }),
    });
  }

  // --- MATCHMAKING & 50MS SYNC ---
  public async startMatchmaking(): Promise<{ joinInfo: MatchRoomJoinInfo }> {
    this.lastRoomSnapshot = null;
    return this.request('/api/matchmaking/start', { method: 'POST' });
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
    const res = await this.request<{ snapshot: MatchRoomSnapshot }>(
      `/api/match/${encodeURIComponent(roomId)}/sync`,
      {
        method: 'POST',
        body: JSON.stringify({ state, actions }),
      },
    );
    this.emit({ type: 'room_snapshot', snapshot: res.snapshot });
    return res.snapshot;
  }

  public sendWsState(state: ClientMatchStatePush): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.lastWsSyncSentAtMs === null) {
        this.lastWsSyncSentAtMs = this.markRequestStarted();
      }
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
    return false;
  }
}

export const multiplayerClient = new MultiplayerClient();

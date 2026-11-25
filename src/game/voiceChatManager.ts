import { multiplayerClient } from './multiplayerClient';
import type { PartyMemberInfo, RemotePlayerSync } from '../shared/multiplayerTypes';

export interface VoiceParticipant {
  accountId: number;
  nickname: string;
  isSpeaking: boolean;
  isMuted: boolean;
  inCall: boolean;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
      ],
    },
  ],
};

class VoiceChatManager {
  private localStream: MediaStream | null = null;
  private peerConnections = new Map<number, RTCPeerConnection>();
  private makingOffer = new Map<number, boolean>();
  private ignoreOffer = new Map<number, boolean>();
  private pendingIceCandidates = new Map<number, RTCIceCandidateInit[]>();
  private remoteAudioElements = new Map<number, HTMLAudioElement>();
  private teammates = new Map<number, string>(); // accountId -> nickname (same team/party ONLY)
  private remoteInCall = new Set<number>();
  private mutedAccountIds = new Set<number>();
  private speakersMuted = false;
  private micMuted = false;
  private inCall = false;
  private localAccountId: number | null = null;
  private currentContextKey: string | null = null;

  // Audio Analysis for VAD (Voice Activity Detection)
  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private vadInterval: number | null = null;
  private remoteAnalysers = new Map<number, AnalyserNode>();

  private listeners = new Set<(participants: VoiceParticipant[]) => void>();
  private lastMicError: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockHandler = () => {
        this.resumeAudioPlayback();
      };
      window.addEventListener('pointerdown', unlockHandler, { passive: true });
      window.addEventListener('keydown', unlockHandler, { passive: true });
    }

    multiplayerClient.subscribe((ev) => {
      if (ev.type === 'party_update' && ev.party) {
        if (ev.party.status !== 'in_match') {
          this.syncPartyTeammates(ev.party.partyId, ev.party.members);
        }
      } else if (ev.type === 'match_found' && ev.joinInfo) {
        this.localAccountId = ev.joinInfo.yourAccountId;
        const myTeamId = ev.joinInfo.yourTeamId;
        const teamHumans = ev.joinInfo.humans.filter((h) => h.teamId === myTeamId);
        this.syncTeamMembers(`room:${ev.joinInfo.roomId}`, teamHumans);
      } else if (ev.type === 'room_snapshot' && ev.snapshot?.roomId) {
        this.syncSnapshotTeam(ev.snapshot.roomId, ev.snapshot.humans);
      } else if (ev.type === 'ws_ready') {
        if (this.inCall && this.localStream) {
          this.connectToCurrentTeammates();
        }
      } else if (ev.type === 'webrtc_signal') {
        void this.handleSignaling(ev.fromAccountId, ev.signal);
      } else if (ev.type === 'match_kicked') {
        this.handleReturnToLobby();
      }
    });
  }

  private isPolitePeer(targetAccountId: number): boolean {
    if (this.localAccountId === null) return true;
    return this.localAccountId > targetAccountId;
  }

  public setLocalAccountId(accountId: number | null): void {
    this.localAccountId = accountId;
    if (accountId === null) {
      this.teammates.clear();
      this.currentContextKey = null;
      this.stopCall();
      return;
    }

    const latestSnap = multiplayerClient.getLatestSnapshot();
    if (latestSnap?.roomId && latestSnap.humans.some((h) => h.accountId === accountId)) {
      this.syncSnapshotTeam(latestSnap.roomId, latestSnap.humans);
    } else {
      const latestParty = multiplayerClient.getLatestParty();
      if (latestParty && latestParty.members.some((m) => m.accountId === accountId)) {
        this.syncPartyTeammates(latestParty.partyId, latestParty.members);
      } else {
        this.emitState();
      }
    }
  }

  public handleReturnToLobby(): void {
    const latestParty = multiplayerClient.getLatestParty();
    if (latestParty && this.localAccountId !== null) {
      this.syncPartyTeammates(latestParty.partyId, latestParty.members);
      return;
    }
    this.clearPeersOnly();
    this.emitState();
  }

  public subscribe(cb: (participants: VoiceParticipant[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.getParticipants());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emitState(): void {
    const list = this.getParticipants();
    this.listeners.forEach((cb) => cb(list));
  }

  public getParticipants(): VoiceParticipant[] {
    const result: VoiceParticipant[] = [];
    for (const [accId, nick] of this.teammates.entries()) {
      if (accId === this.localAccountId) continue;
      const analyser = this.remoteAnalysers.get(accId);
      let isSpeaking = false;
      if (analyser && !this.speakersMuted && !this.mutedAccountIds.has(accId)) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        isSpeaking = avg > 12;
      }
      result.push({
        accountId: accId,
        nickname: nick,
        isSpeaking,
        isMuted: this.mutedAccountIds.has(accId),
        inCall: this.remoteInCall.has(accId) || this.peerConnections.has(accId),
      });
    }
    return result;
  }

  public isCallActive(): boolean {
    return this.inCall && this.localStream !== null && !this.micMuted;
  }

  public getLastMicError(): string | null {
    return this.lastMicError;
  }

  public resumeAudioPlayback(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => undefined);
    }
    for (const [accId, audioEl] of this.remoteAudioElements.entries()) {
      audioEl.muted = this.speakersMuted || this.mutedAccountIds.has(accId);
      if (audioEl.paused && audioEl.srcObject) {
        void audioEl.play().catch(() => undefined);
      }
    }
  }

  public async startCall(): Promise<boolean> {
    this.lastMicError = null;
    this.resumeAudioPlayback();

    if (this.localStream) {
      const liveTracks = this.localStream.getAudioTracks().filter((t) => t.readyState === 'live');
      if (liveTracks.length > 0) {
        this.inCall = true;
        this.setMicMuted(false);
        this.connectToCurrentTeammates();
        this.emitState();
        return true;
      }
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.lastMicError = 'Microfone indisponível neste navegador ou contexto.';
      console.warn('Microphone API unavailable in this browser context.');
      this.inCall = false;
      this.emitState();
      return false;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      try {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx.state === 'suspended') {
          void this.audioCtx.resume();
        }
        const source = this.audioCtx.createMediaStreamSource(this.localStream);
        this.localAnalyser = this.audioCtx.createAnalyser();
        this.localAnalyser.fftSize = 512;
        source.connect(this.localAnalyser);
      } catch (err) {
        console.warn('VAD audio context init warning:', err);
      }

      this.inCall = true;
      this.micMuted = false;
      this.startVadLoop();
      this.connectToCurrentTeammates();
      this.emitState();
      return true;
    } catch (err) {
      const errName =
        err && typeof err === 'object' && 'name' in err
          ? String((err as { name?: unknown }).name)
          : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        this.lastMicError =
          'Permissão de microfone bloqueada. Libere o microfone nas permissões do site/navegador.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        this.lastMicError = 'Nenhum microfone encontrado neste dispositivo.';
      } else {
        this.lastMicError = 'Não foi possível ativar o microfone neste dispositivo.';
      }
      console.warn('Microphone permission denied or unavailable:', err);
      this.inCall = false;
      this.emitState();
      return false;
    }
  }

  public stopCall(): void {
    for (const accId of this.teammates.keys()) {
      if (accId !== this.localAccountId) {
        multiplayerClient.sendWebrtcSignal(accId, { type: 'voice_leave' });
      }
    }

    this.inCall = false;
    this.micMuted = true;

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.localAnalyser = null;

    // Remove local senders from any existing PCs or close peers if no remote call is active
    for (const [accId, pc] of this.peerConnections.entries()) {
      if (!this.remoteInCall.has(accId)) {
        this.closePeer(accId, pc);
      } else {
        try {
          for (const sender of pc.getSenders()) {
            if (sender.track && sender.track.kind === 'audio') {
              pc.removeTrack(sender);
            }
          }
          void this.sendOffer(accId, pc);
        } catch {
          this.closePeer(accId, pc);
        }
      }
    }

    if (this.remoteAudioElements.size === 0 && this.vadInterval !== null) {
      window.clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    this.emitState();
  }

  public async toggleCall(): Promise<boolean> {
    if (this.isCallActive()) {
      this.stopCall();
      return false;
    }
    return this.startCall();
  }

  public async initializeMicrophone(): Promise<boolean> {
    return this.startCall();
  }

  private closePeer(accId: number, pc?: RTCPeerConnection): void {
    const targetPc = pc ?? this.peerConnections.get(accId);
    if (targetPc) {
      try {
        targetPc.onicecandidate = null;
        targetPc.ontrack = null;
        targetPc.onconnectionstatechange = null;
        targetPc.oniceconnectionstatechange = null;
        targetPc.close();
      } catch {
        // ignore
      }
      this.peerConnections.delete(accId);
    }
    this.makingOffer.delete(accId);
    this.ignoreOffer.delete(accId);
    this.pendingIceCandidates.delete(accId);

    const audioEl = this.remoteAudioElements.get(accId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
      this.remoteAudioElements.delete(accId);
    }
    this.remoteAnalysers.delete(accId);
    this.remoteInCall.delete(accId);
  }

  private clearPeersOnly(): void {
    for (const [accId, pc] of Array.from(this.peerConnections.entries())) {
      this.closePeer(accId, pc);
    }
    this.peerConnections.clear();
    this.makingOffer.clear();
    this.ignoreOffer.clear();
    this.pendingIceCandidates.clear();
    this.remoteAudioElements.clear();
    this.remoteAnalysers.clear();
    this.remoteInCall.clear();
  }

  private startVadLoop(): void {
    if (typeof window === 'undefined' || this.vadInterval !== null) return;
    this.vadInterval = window.setInterval(() => {
      this.emitState();
    }, 220);
  }

  public isLocalSpeaking(): boolean {
    if (!this.inCall || !this.localAnalyser || this.micMuted || !this.localStream) return false;
    const data = new Uint8Array(this.localAnalyser.frequencyBinCount);
    this.localAnalyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return avg > 14;
  }

  public setMicMuted(muted: boolean): void {
    this.micMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    this.emitState();
  }

  public isMicMuted(): boolean {
    return this.micMuted;
  }

  public setSpeakerMuted(muted: boolean): void {
    this.speakersMuted = muted;
    for (const [accId, audioEl] of this.remoteAudioElements.entries()) {
      audioEl.muted = muted || this.mutedAccountIds.has(accId);
      if (!audioEl.muted && audioEl.paused && audioEl.srcObject) {
        void audioEl.play().catch(() => undefined);
      }
    }
    this.emitState();
  }

  public isSpeakerMuted(): boolean {
    return this.speakersMuted;
  }

  public toggleSpeakerMuted(): boolean {
    this.resumeAudioPlayback();
    const next = !this.speakersMuted;
    this.setSpeakerMuted(next);
    return next;
  }

  public toggleMutePlayer(accountId: number): void {
    this.resumeAudioPlayback();
    if (this.mutedAccountIds.has(accountId)) {
      this.mutedAccountIds.delete(accountId);
      const el = this.remoteAudioElements.get(accountId);
      if (el) {
        el.muted = this.speakersMuted;
        if (!el.muted && el.paused && el.srcObject) {
          void el.play().catch(() => undefined);
        }
      }
    } else {
      this.mutedAccountIds.add(accountId);
      const el = this.remoteAudioElements.get(accountId);
      if (el) el.muted = true;
    }
    this.emitState();
  }

  public isPlayerMuted(accountId: number): boolean {
    return this.mutedAccountIds.has(accountId);
  }

  private syncPartyTeammates(partyId: string, members: PartyMemberInfo[]): void {
    this.syncTeamMembers(`party:${partyId}`, members);
  }

  private syncSnapshotTeam(roomId: string, humans: RemotePlayerSync[]): void {
    if (this.localAccountId === null) return;
    const self = humans.find((h) => h.accountId === this.localAccountId);
    if (!self) return;
    const teamHumans = humans.filter((h) => h.teamId === self.teamId);
    this.syncTeamMembers(`room:${roomId}`, teamHumans);
  }

  private syncTeamMembers(
    contextKey: string,
    members: Array<{ accountId: number; nickname: string }>,
  ): void {
    this.currentContextKey = contextKey;

    const activeIds = new Set<number>();
    this.teammates.clear();

    for (const m of members) {
      if (m.accountId === this.localAccountId) continue;
      activeIds.add(m.accountId);
      this.teammates.set(m.accountId, m.nickname);
    }

    // Close connections only for players who left the squad/team; preserve existing active teammate calls
    for (const [accId, pc] of Array.from(this.peerConnections.entries())) {
      if (!activeIds.has(accId)) {
        this.closePeer(accId, pc);
      }
    }

    if (this.inCall && this.localStream) {
      this.connectToCurrentTeammates();
    }

    this.emitState();
  }

  private connectToCurrentTeammates(): void {
    if (!this.inCall || !this.localStream || this.localAccountId === null) return;
    for (const peerId of this.teammates.keys()) {
      if (peerId === this.localAccountId) continue;
      multiplayerClient.sendWebrtcSignal(peerId, { type: 'voice_join' });
      const existingPc = this.peerConnections.get(peerId);
      if (!existingPc) {
        // Always initiate so listen-only teammates (not in mic call yet) still hear us immediately
        void this.createPeerConnection(peerId, true);
      } else {
        this.attachLocalTracksAndNegotiate(peerId, existingPc);
      }
    }
  }

  private attachLocalTracksAndNegotiate(targetAccountId: number, pc: RTCPeerConnection): void {
    if (!this.localStream) return;
    const senders = pc.getSenders();
    let added = false;
    this.localStream.getTracks().forEach((track) => {
      const matchingSender = senders.find((s) => s.track?.kind === track.kind);
      if (!matchingSender) {
        pc.addTrack(track, this.localStream!);
        added = true;
      } else if (matchingSender.track !== track) {
        void matchingSender.replaceTrack(track).catch(() => undefined);
      }
    });
    if (added) {
      void this.sendOffer(targetAccountId, pc);
    }
  }

  private async sendOffer(targetAccountId: number, pc: RTCPeerConnection): Promise<void> {
    if (this.makingOffer.get(targetAccountId)) return;
    try {
      this.makingOffer.set(targetAccountId, true);
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);
      multiplayerClient.sendWebrtcSignal(targetAccountId, {
        type: 'offer',
        sdp: pc.localDescription,
      });
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
    } finally {
      this.makingOffer.set(targetAccountId, false);
    }
  }

  private async flushPendingIce(targetAccountId: number, pc: RTCPeerConnection): Promise<void> {
    const queue = this.pendingIceCandidates.get(targetAccountId);
    if (!queue || queue.length === 0 || !pc.remoteDescription) return;
    this.pendingIceCandidates.delete(targetAccountId);
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // Ignore stale ICE candidate
      }
    }
  }

  private lookupTeammateNickname(accountId: number): string {
    const existing = this.teammates.get(accountId);
    if (existing) return existing;
    const snap = multiplayerClient.getLatestSnapshot();
    const snapMember = snap?.humans.find((h) => h.accountId === accountId);
    if (snapMember) return snapMember.nickname;
    const party = multiplayerClient.getLatestParty();
    const partyMember = party?.members.find((m) => m.accountId === accountId);
    if (partyMember) return partyMember.nickname;
    return `Aliado #${accountId}`;
  }

  private async createPeerConnection(
    targetAccountId: number,
    isInitiator: boolean,
  ): Promise<RTCPeerConnection> {
    const existing = this.peerConnections.get(targetAccountId);
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      if (isInitiator && this.inCall && this.localStream) {
        this.attachLocalTracksAndNegotiate(targetAccountId, existing);
      }
      return existing;
    }
    if (existing) {
      this.closePeer(targetAccountId, existing);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(targetAccountId, pc);
    this.makingOffer.set(targetAccountId, false);
    this.ignoreOffer.set(targetAccountId, false);

    pc.onicecandidate = (event) => {
      if (event.candidate && this.localAccountId !== null) {
        multiplayerClient.sendWebrtcSignal(targetAccountId, {
          type: 'ice',
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {
          // ignore
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (this.peerConnections.get(targetAccountId) === pc) {
          this.closePeer(targetAccountId, pc);
          this.emitState();
        }
      }
    };

    pc.ontrack = (event) => {
      const remoteStream =
        event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      this.remoteInCall.add(targetAccountId);

      let audioEl = this.remoteAudioElements.get(targetAccountId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.volume = 1.0;
        audioEl.muted = this.speakersMuted || this.mutedAccountIds.has(targetAccountId);
        document.body.appendChild(audioEl);
        this.remoteAudioElements.set(targetAccountId, audioEl);
      }
      audioEl.srcObject = remoteStream;
      void audioEl.play().catch(() => {
        // Will automatically resume on next user pointer/key gesture via resumeAudioPlayback()
      });

      try {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx.state === 'suspended') {
          void this.audioCtx.resume().catch(() => undefined);
        }
        const source = this.audioCtx.createMediaStreamSource(remoteStream);
        const analyser = this.audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        this.remoteAnalysers.set(targetAccountId, analyser);
        this.startVadLoop();
      } catch (err) {
        console.warn('Remote analyser setup warning:', err);
      }
      this.emitState();
    };

    if (this.inCall && this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream) {
          pc.addTrack(track, this.localStream);
        }
      });
    }

    if (isInitiator) {
      await this.sendOffer(targetAccountId, pc);
    }

    return pc;
  }

  private async handleSignaling(fromAccountId: number, signalRaw: unknown): Promise<void> {
    if (fromAccountId === this.localAccountId) return;
    // Server already validates sameMatchTeam || sameParty; ensure teammate entry exists even if snapshot arrived slightly later
    if (!this.teammates.has(fromAccountId)) {
      this.teammates.set(fromAccountId, this.lookupTeammateNickname(fromAccountId));
    }

    const signal = signalRaw as {
      type: string;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    };
    if (!signal || typeof signal.type !== 'string') return;

    if (signal.type === 'voice_join') {
      this.remoteInCall.add(fromAccountId);
      if (this.inCall && this.localStream) {
        multiplayerClient.sendWebrtcSignal(fromAccountId, { type: 'voice_ack' });
        const pc = await this.createPeerConnection(fromAccountId, false);
        this.attachLocalTracksAndNegotiate(fromAccountId, pc);
      }
      this.emitState();
      return;
    }

    if (signal.type === 'voice_ack') {
      this.remoteInCall.add(fromAccountId);
      this.emitState();
      return;
    }

    if (signal.type === 'voice_leave') {
      this.closePeer(fromAccountId);
      this.emitState();
      return;
    }

    let pc = this.peerConnections.get(fromAccountId);
    if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      pc = await this.createPeerConnection(fromAccountId, false);
    }

    try {
      if (signal.type === 'offer' && signal.sdp) {
        const polite = this.isPolitePeer(fromAccountId);
        const offerCollision =
          Boolean(this.makingOffer.get(fromAccountId)) || pc.signalingState !== 'stable';
        const ignore = !polite && offerCollision;
        this.ignoreOffer.set(fromAccountId, ignore);
        if (ignore) {
          return;
        }

        if (offerCollision && polite) {
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch {
            // Browser may accept remote offer directly
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await this.flushPendingIce(fromAccountId, pc);

        if (this.inCall && this.localStream) {
          const senders = pc.getSenders();
          this.localStream.getTracks().forEach((track) => {
            if (!senders.some((s) => s.track === track)) {
              pc!.addTrack(track, this.localStream!);
            }
          });
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        multiplayerClient.sendWebrtcSignal(fromAccountId, {
          type: 'answer',
          sdp: pc.localDescription,
        });
      } else if (signal.type === 'answer' && signal.sdp) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await this.flushPendingIce(fromAccountId, pc);
        }
      } else if (signal.type === 'ice' && signal.candidate) {
        if (this.ignoreOffer.get(fromAccountId)) return;
        if (!pc.remoteDescription) {
          const q = this.pendingIceCandidates.get(fromAccountId) ?? [];
          q.push(signal.candidate);
          this.pendingIceCandidates.set(fromAccountId, q);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.error('Error handling WebRTC signaling:', err);
    }
  }

  public disconnect(): void {
    this.stopCall();
  }
}

export const voiceChatManager = new VoiceChatManager();

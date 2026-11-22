import { multiplayerClient } from './multiplayerClient';
import type { PartyMemberInfo, RemotePlayerSync } from '../shared/multiplayerTypes';

export interface VoiceParticipant {
  accountId: number;
  nickname: string;
  isSpeaking: boolean;
  isMuted: boolean;
  inCall: boolean;
}

class VoiceChatManager {
  private localStream: MediaStream | null = null;
  private peerConnections = new Map<number, RTCPeerConnection>();
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

  constructor() {
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
      } else if (ev.type === 'webrtc_signal') {
        void this.handleSignaling(ev.fromAccountId, ev.signal);
      } else if (ev.type === 'match_kicked') {
        this.clearPeersOnly();
      }
    });
  }

  public setLocalAccountId(accountId: number | null): void {
    this.localAccountId = accountId;
    if (accountId === null) {
      this.teammates.clear();
      this.stopCall();
    } else {
      this.emitState();
    }
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
        isSpeaking = avg > 14;
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

  private lastMicError: string | null = null;

  public getLastMicError(): string | null {
    return this.lastMicError;
  }

  public async startCall(): Promise<boolean> {
    this.lastMicError = null;
    if (this.localStream) {
      this.inCall = true;
      this.setMicMuted(false);
      this.connectToCurrentTeammates();
      this.emitState();
      return true;
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
    this.clearPeersOnly();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.localAnalyser = null;

    if (this.vadInterval !== null) {
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

  private clearPeersOnly(): void {
    for (const pc of this.peerConnections.values()) {
      try {
        pc.close();
      } catch {
        // ignore
      }
    }
    this.peerConnections.clear();

    for (const audioEl of this.remoteAudioElements.values()) {
      audioEl.remove();
    }
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
    return avg > 15;
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
    }
    this.emitState();
  }

  public isSpeakerMuted(): boolean {
    return this.speakersMuted;
  }

  public toggleSpeakerMuted(): boolean {
    const next = !this.speakersMuted;
    this.setSpeakerMuted(next);
    return next;
  }

  public toggleMutePlayer(accountId: number): void {
    if (this.mutedAccountIds.has(accountId)) {
      this.mutedAccountIds.delete(accountId);
      const el = this.remoteAudioElements.get(accountId);
      if (el) el.muted = this.speakersMuted;
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
    const contextChanged = this.currentContextKey !== contextKey;
    this.currentContextKey = contextKey;

    if (contextChanged) {
      this.clearPeersOnly();
    }

    const activeIds = new Set<number>();
    this.teammates.clear();

    for (const m of members) {
      if (m.accountId === this.localAccountId) continue;
      activeIds.add(m.accountId);
      this.teammates.set(m.accountId, m.nickname);
    }

    for (const [accId, pc] of this.peerConnections.entries()) {
      if (!activeIds.has(accId)) {
        try {
          pc.close();
        } catch {
          // ignore
        }
        this.peerConnections.delete(accId);
        const audioEl = this.remoteAudioElements.get(accId);
        if (audioEl) {
          audioEl.remove();
          this.remoteAudioElements.delete(accId);
        }
        this.remoteAnalysers.delete(accId);
        this.remoteInCall.delete(accId);
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
        if (this.localAccountId < peerId) {
          void this.createPeerConnection(peerId, true);
        }
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
      if (!senders.some((s) => s.track === track)) {
        pc.addTrack(track, this.localStream!);
        added = true;
      }
    });
    if (added) {
      void (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          multiplayerClient.sendWebrtcSignal(targetAccountId, {
            type: 'offer',
            sdp: pc.localDescription,
          });
        } catch (err) {
          console.error('Error renegotiating WebRTC call:', err);
        }
      })();
    }
  }

  private async createPeerConnection(
    targetAccountId: number,
    isInitiator: boolean,
  ): Promise<RTCPeerConnection> {
    const existing = this.peerConnections.get(targetAccountId);
    if (existing) {
      return existing;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      ],
    });

    this.peerConnections.set(targetAccountId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate && this.localAccountId !== null) {
        multiplayerClient.sendWebrtcSignal(targetAccountId, {
          type: 'ice',
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream) return;
      this.remoteInCall.add(targetAccountId);

      let audioEl = this.remoteAudioElements.get(targetAccountId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.muted = this.speakersMuted || this.mutedAccountIds.has(targetAccountId);
        document.body.appendChild(audioEl);
        this.remoteAudioElements.set(targetAccountId, audioEl);
      }
      audioEl.srcObject = remoteStream;

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

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream) {
          pc.addTrack(track, this.localStream);
        }
      });
    }

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        multiplayerClient.sendWebrtcSignal(targetAccountId, {
          type: 'offer',
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.error('Error creating WebRTC offer:', err);
      }
    }

    return pc;
  }

  private async handleSignaling(fromAccountId: number, signalRaw: unknown): Promise<void> {
    if (!this.teammates.has(fromAccountId)) return;
    const signal = signalRaw as {
      type: string;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    };
    if (!signal) return;

    if (signal.type === 'voice_join') {
      this.remoteInCall.add(fromAccountId);
      if (this.inCall && this.localStream && !this.peerConnections.has(fromAccountId)) {
        await this.createPeerConnection(fromAccountId, true);
      }
      this.emitState();
      return;
    }

    if (signal.type === 'voice_leave') {
      this.remoteInCall.delete(fromAccountId);
      const pc = this.peerConnections.get(fromAccountId);
      if (pc) {
        try {
          pc.close();
        } catch {
          // ignore
        }
        this.peerConnections.delete(fromAccountId);
      }
      const audioEl = this.remoteAudioElements.get(fromAccountId);
      if (audioEl) {
        audioEl.remove();
        this.remoteAudioElements.delete(fromAccountId);
      }
      this.remoteAnalysers.delete(fromAccountId);
      this.emitState();
      return;
    }

    let pc = this.peerConnections.get(fromAccountId);
    if (!pc) {
      pc = await this.createPeerConnection(fromAccountId, false);
    }

    try {
      if (signal.type === 'offer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
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
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'ice' && signal.candidate) {
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

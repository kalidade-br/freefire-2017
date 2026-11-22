import { multiplayerClient } from './multiplayerClient';

export interface VoiceParticipant {
  accountId: number;
  nickname: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

class VoiceChatManager {
  private localStream: MediaStream | null = null;
  private peerConnections = new Map<number, RTCPeerConnection>();
  private remoteAudioElements = new Map<number, HTMLAudioElement>();
  private participantNicknames = new Map<number, string>();
  private mutedAccountIds = new Set<number>();
  private speakersMuted = false;
  private micMuted = false;
  private isConnected = false;
  private localAccountId: number | null = null;
  private currentRoomId: string | null = null;
  
  // Audio Analysis for VAD (Voice Activity Detection)
  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private vadInterval: number | null = null;
  private remoteAnalysers = new Map<number, AnalyserNode>();
  
  private unsubscribeWs: (() => void) | null = null;
  private listeners = new Set<(participants: VoiceParticipant[]) => void>();

  constructor() {
    // Listen to multiplayer server events for WebRTC signaling
    this.unsubscribeWs = multiplayerClient.subscribe((ev) => {
      if (ev.type === 'webrtc_signal') {
        void this.handleSignaling(ev.fromAccountId, ev.signal);
      } else if (ev.type === 'room_snapshot') {
        if (ev.snapshot && ev.snapshot.roomId) {
          this.syncRoomParticipants(ev.snapshot.roomId, ev.snapshot.myAccountId, ev.snapshot.players);
        }
      }
    });
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
    for (const [accId, nick] of this.participantNicknames.entries()) {
      if (accId === this.localAccountId) continue;
      const analyser = this.remoteAnalysers.get(accId);
      let isSpeaking = false;
      if (analyser && !this.speakersMuted) {
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
      });
    }
    return result;
  }

  public async initializeMicrophone(): Promise<boolean> {
    if (this.localStream) return true;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Setup local audio context & analyser for VAD
      try {
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioCtxClass();
        const source = this.audioCtx.createMediaStreamSource(this.localStream);
        this.localAnalyser = this.audioCtx.createAnalyser();
        this.localAnalyser.fftSize = 512;
        source.connect(this.localAnalyser);
      } catch (err) {
        console.warn('VAD audio context init warning:', err);
      }

      this.startVadLoop();
      this.isConnected = true;
      return true;
    } catch (err) {
      console.error('Microphone permission denied or error:', err);
      this.isConnected = false;
      return false;
    }
  }

  private startVadLoop(): void {
    if (typeof window === 'undefined' || this.vadInterval !== null) return;
    this.vadInterval = window.setInterval(() => {
      this.emitState();
    }, 250);
  }

  public isLocalSpeaking(): boolean {
    if (!this.localAnalyser || this.micMuted || !this.localStream) return false;
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
    for (const audioEl of this.remoteAudioElements.values()) {
      audioEl.muted = muted;
    }
    this.emitState();
  }

  public isSpeakerMuted(): boolean {
    return this.speakersMuted;
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

  private syncRoomParticipants(roomId: string, myAccountId: number, players: Array<{ accountId: number; nickname: string }>): void {
    this.currentRoomId = roomId;
    this.localAccountId = myAccountId;
    
    const activeIds = new Set<number>();
    for (const p of players) {
      if (p.accountId === myAccountId) continue;
      activeIds.add(p.accountId);
      this.participantNicknames.set(p.accountId, p.nickname);
      
      // If we have mic initialized and haven't connected to this peer yet, initiate offer (if our ID is lower or as initiator)
      if (this.localStream && !this.peerConnections.has(p.accountId)) {
        if (myAccountId < p.accountId) {
          void this.createPeerConnection(p.accountId, true);
        }
      }
    }

    // Cleanup disconnected peers
    for (const [accId, pc] of this.peerConnections.entries()) {
      if (!activeIds.has(accId)) {
        pc.close();
        this.peerConnections.delete(accId);
        const audioEl = this.remoteAudioElements.get(accId);
        if (audioEl) {
          audioEl.remove();
          this.remoteAudioElements.delete(accId);
        }
        this.remoteAnalysers.delete(accId);
        this.participantNicknames.delete(accId);
      }
    }

    this.emitState();
  }

  private async createPeerConnection(targetAccountId: number, isInitiator: boolean): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(targetAccountId)) {
      return this.peerConnections.get(targetAccountId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      ],
    });

    this.peerConnections.set(targetAccountId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate && this.localAccountId) {
        multiplayerClient.sendWebrtcSignal(targetAccountId, { type: 'ice', candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream) return;

      let audioEl = this.remoteAudioElements.get(targetAccountId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.muted = this.speakersMuted || this.mutedAccountIds.has(targetAccountId);
        document.body.appendChild(audioEl);
        this.remoteAudioElements.set(targetAccountId, audioEl);
      }
      audioEl.srcObject = remoteStream;

      // Setup analyser for remote stream VAD
      try {
        if (this.audioCtx) {
          const source = this.audioCtx.createMediaStreamSource(remoteStream);
          const analyser = this.audioCtx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          this.remoteAnalysers.set(targetAccountId, analyser);
        }
      } catch (err) {
        console.warn('Remote analyser setup warning:', err);
      }
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
        multiplayerClient.sendWebrtcSignal(targetAccountId, { type: 'offer', sdp: pc.localDescription });
      } catch (err) {
        console.error('Error creating WebRTC offer:', err);
      }
    }

    return pc;
  }

  private async handleSignaling(fromAccountId: number, signalRaw: unknown): Promise<void> {
    const signal = signalRaw as { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
    if (!signal) return;

    let pc = this.peerConnections.get(fromAccountId);
    if (!pc) {
      pc = await this.createPeerConnection(fromAccountId, false);
    }

    try {
      if (signal.type === 'offer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        multiplayerClient.sendWebrtcSignal(fromAccountId, { type: 'answer', sdp: pc.localDescription });
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
    if (this.vadInterval !== null) {
      window.clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.unsubscribeWs) {
      this.unsubscribeWs();
      this.unsubscribeWs = null;
    }

    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();

    for (const audioEl of this.remoteAudioElements.values()) {
      audioEl.remove();
    }
    this.remoteAudioElements.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }

    this.remoteAnalysers.clear();
    this.participantNicknames.clear();
    this.mutedAccountIds.clear();
    this.isConnected = false;
    this.emitState();
  }
}

export const voiceChatManager = new VoiceChatManager();

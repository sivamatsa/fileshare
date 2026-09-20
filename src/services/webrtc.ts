import {
  ConnectionState,
  FileQueueItem,
  IceMode,
  IncomingTransfer,
  ChatMessage,
  WebRTCStats,
  TransferSettings,
  DeviceInfo,
} from '../types';
import { crc32ToHex, crc32Update, formatBytes } from '../utils/formatters';
import { resolveMimeType } from '../utils/mime';
import { createDiskStreamWriter, DiskStreamTarget, triggerFileDownload } from './fileStorage';
import { detectLocalDevice } from '../utils/device';
import { saveTransferHistoryItem } from '../utils/history';

export class P2PManager {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private controlDc: RTCDataChannel | null = null;
  private fileDc: RTCDataChannel | null = null;

  public roomCode: string = '';
  public peerId: string = Math.random().toString(36).substring(2, 9);
  public connectionState: ConnectionState = 'idle';
  public isInitiator: boolean = false;
  public settings: TransferSettings = {
    chunkSize: 256 * 1024, // 256KB High-Speed Turbo Default
    iceMode: 'stun',
    customStunUrl: '',
    autoAcceptTransfers: true, // Auto-accept enabled by default
    enableSoundAlerts: true,
    enableWakeLock: true,
    enableVibration: true,
    autoDownload: true,
    enableLocalDiscovery: true,
  };

  // State
  public fileQueue: FileQueueItem[] = [];
  public incomingTransfers: Map<string, IncomingTransfer> = new Map();
  private incomingChunks: Map<string, ArrayBuffer[]> = new Map();
  private incomingWriters: Map<string, DiskStreamTarget> = new Map();
  private incomingCrc: Map<string, number> = new Map();
  private incomingOffsets: Map<string, number> = new Map();
  public messages: ChatMessage[] = [];
  public currentStats: WebRTCStats = { bytesSent: 0, bytesReceived: 0 };
  public nearbyDevices: any[] = [];
  private wakeLockSentinel: any = null;

  // Speed Telemetry state
  private speedHistory: number[] = new Array(30).fill(0);
  private peakSpeed: number = 0;
  private speedSamples: number[] = [];
  private lastStatsBytesTotal: number = 0;
  private lastStatsTime: number = Date.now();

  // Control flags for active send
  private activeSendId: string | null = null;
  private isPaused: boolean = false;
  private isCancelled: boolean = false;

  // Timers & Keepalives
  private pingInterval: any = null;
  private statsInterval: any = null;
  private wsHeartbeatInterval: any = null;
  private wsReconnectTimer: any = null;
  private isExplicitDisconnect: boolean = false;
  private iceRecoveryTimer: any = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  // Callbacks
  public onStateChange?: (state: ConnectionState) => void;
  public onQueueChange?: (queue: FileQueueItem[]) => void;
  public onIncomingChange?: (incoming: IncomingTransfer[]) => void;
  public onMessage?: (message: ChatMessage) => void;
  public onStats?: (stats: WebRTCStats) => void;
  public onError?: (msg: string) => void;
  public onNotificationTone?: (type: 'success' | 'alert' | 'complete') => void;
  public onRemoteDeviceChange?: (info: DeviceInfo) => void;
  public onNearbyDevicesChange?: (devices: any[]) => void;
  public onIncomingInvite?: (invite: { fromPeerId: string; fromDevice: DeviceInfo; roomCode: string }) => void;

  public localDeviceInfo: DeviceInfo = detectLocalDevice();
  public remoteDeviceInfo?: DeviceInfo;

  constructor(settings?: Partial<TransferSettings>) {
    if (settings) {
      this.settings = { ...this.settings, ...settings };
    }
  }

  public updateSettings(newSettings: Partial<TransferSettings>) {
    const oldIceMode = this.settings.iceMode;
    const oldStun = this.settings.customStunUrl;
    this.settings = { ...this.settings, ...newSettings };

    // If ICE config changed while connected, user might reconnect
    if (
      this.pc &&
      (oldIceMode !== this.settings.iceMode || oldStun !== this.settings.customStunUrl)
    ) {
      this.addSystemMessage('ICE configuration updated. Reconnect to apply changes.');
    }
  }

  private setState(state: ConnectionState) {
    this.connectionState = state;
    this.onStateChange?.(state);
  }

  private addSystemMessage(text: string) {
    const msg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'system',
      text,
      timestamp: Date.now(),
    };
    this.messages.push(msg);
    this.onMessage?.(msg);
  }

  private startWsHeartbeat() {
    this.stopWsHeartbeat();
    this.wsHeartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 12000);
  }

  private stopWsHeartbeat() {
    if (this.wsHeartbeatInterval) {
      clearInterval(this.wsHeartbeatInterval);
      this.wsHeartbeatInterval = null;
    }
  }

  private scheduleWsReconnect() {
    if (this.isExplicitDisconnect || this.wsReconnectTimer || !this.roomCode) return;
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      if (this.isExplicitDisconnect || !this.roomCode) return;
      this.reconnectSignaling();
    }, 2500);
  }

  private reconnectSignaling() {
    if (this.isExplicitDisconnect || !this.roomCode) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.attachWebSocketHandlers();
    } catch {
      this.scheduleWsReconnect();
    }
  }

  // Screen Wake Lock support during active file transfers
  private async requestWakeLock() {
    if (!this.settings.enableWakeLock || this.wakeLockSentinel || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });
    } catch {
      // Browser may reject if tab is backgrounded
    }
  }

  private releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch {}
      this.wakeLockSentinel = null;
    }
  }

  // Connect to signaling only for local network device discovery before room selection
  public connectSignalingOnly(myCode: string) {
    this.isExplicitDisconnect = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.announcePresence(myCode);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.attachWebSocketHandlers(myCode);
    } catch (err: any) {
      console.warn('Signaling discovery connection error', err);
    }
  }

  public announcePresence(code: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.settings.enableLocalDiscovery) {
      this.ws.send(
        JSON.stringify({
          type: 'presence',
          peerId: this.peerId,
          device: this.localDeviceInfo,
          code,
        })
      );
    }
  }

  public inviteDevice(targetPeerId: string, roomCode: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'direct-connect-invite',
          targetPeerId,
          fromDevice: this.localDeviceInfo,
          roomCode,
        })
      );
    }
  }

  // Connect to room via WebSocket signaling
  public connect(roomCode: string) {
    this.isExplicitDisconnect = false;
    this.roomCode = roomCode.toUpperCase().trim();
    this.setState('connecting-signal');
    this.addSystemMessage(`Connecting to signaling for room ${this.roomCode}...`);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'join',
          room: this.roomCode,
          peerId: this.peerId,
        })
      );
      this.setState('waiting-peer');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.attachWebSocketHandlers();
    } catch (err: any) {
      this.setState('failed');
      this.onError?.(`WebSocket failed: ${err.message}`);
    }
  }

  private attachWebSocketHandlers(initialCode?: string) {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.startWsHeartbeat();
      if (this.roomCode) {
        this.ws?.send(
          JSON.stringify({
            type: 'join',
            room: this.roomCode,
            peerId: this.peerId,
          })
        );
        if (this.connectionState !== 'connected') {
          this.setState('waiting-peer');
        }
        this.addSystemMessage(`Joined room ${this.roomCode}. Waiting for second peer...`);
      } else if (initialCode) {
        this.announcePresence(initialCode);
      }
    };

    this.ws.onmessage = async (event) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'nearby-devices':
          this.nearbyDevices = (msg.devices || []).filter((d: any) => d.peerId !== this.peerId);
          this.onNearbyDevicesChange?.(this.nearbyDevices);
          break;

        case 'incoming-connect-request':
          this.onIncomingInvite?.({
            fromPeerId: msg.fromPeerId,
            fromDevice: msg.fromDevice,
            roomCode: msg.roomCode,
          });
          break;

        case 'pong':
          // Heartbeat acknowledged by server
          break;

        case 'joined':
          this.isInitiator = msg.isInitiator;
          if (msg.peerCount === 2) {
            this.addSystemMessage('Peer present. Initializing WebRTC handshake...');
            if (this.isInitiator) {
              await this.initiateWebRTC();
            }
          }
          break;

        case 'peer-joined':
          this.addSystemMessage('New peer arrived. Initializing WebRTC connection...');
          if (!this.pc) {
            this.isInitiator = true;
            await this.initiateWebRTC();
          }
          break;

        case 'peer-left':
          // Check if direct P2P DataChannel is still actively open before cleaning up
          if (this.controlDc && this.controlDc.readyState === 'open') {
            this.addSystemMessage('Signaling heartbeat fluctuation. Direct P2P connection is holding steady.');
            return;
          }
          this.addSystemMessage('Peer disconnected.');
          this.cleanupPeerConnection();
          this.setState('waiting-peer');
          break;

        case 'offer':
          await this.handleOffer(msg.sdp);
          break;

        case 'answer':
          await this.handleAnswer(msg.sdp);
          break;

        case 'ice':
          await this.handleIceCandidate(msg.candidate);
          break;

        case 'error':
          this.onError?.(msg.message || 'Signaling error');
          this.setState('failed');
          break;
      }
    };

    this.ws.onclose = () => {
      this.stopWsHeartbeat();
      if (!this.isExplicitDisconnect) {
        if (this.controlDc && this.controlDc.readyState === 'open') {
          this.addSystemMessage('Signaling server re-negotiating in background (P2P stream active).');
        } else if (this.connectionState !== 'disconnected') {
          this.addSystemMessage('Signaling disconnected. Attempting auto-reconnect...');
        }
        this.scheduleWsReconnect();
      }
    };

    this.ws.onerror = () => {
      if (!this.isExplicitDisconnect && this.connectionState !== 'connected') {
        this.onError?.('Signaling server connection error');
      }
    };
  }

  public disconnect() {
    this.isExplicitDisconnect = true;
    this.stopWsHeartbeat();
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.iceRecoveryTimer) {
      clearTimeout(this.iceRecoveryTimer);
      this.iceRecoveryTimer = null;
    }
    this.cleanupPeerConnection();
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'leave' }));
      }
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
    this.activeSendId = null;
  }

  // Get ICE Configuration based on settings
  private getIceServers(): RTCIceServer[] {
    if (this.settings.iceMode === 'lan-only') {
      return []; // Pure Direct / Host only
    }

    const servers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    if (this.settings.customStunUrl && this.settings.customStunUrl.trim()) {
      servers.unshift({ urls: this.settings.customStunUrl.trim() });
    }

    return servers;
  }

  // Create Peer Connection
  private createPeerConnection(): RTCPeerConnection {
    const config: RTCConfiguration = {
      iceServers: this.getIceServers(),
    };

    const pc = new RTCPeerConnection(config);
    this.pc = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'ice',
            candidate: e.candidate,
          })
        );
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (this.iceRecoveryTimer) {
          clearTimeout(this.iceRecoveryTimer);
          this.iceRecoveryTimer = null;
        }
        this.setState('connected');
        this.startStats();
      } else if (pc.iceConnectionState === 'disconnected') {
        // Transient network fluctuation: do not abort immediately; allow graceful recovery
        this.addSystemMessage('Network path fluctuating. Attempting automatic recovery...');
        if (!this.iceRecoveryTimer) {
          this.iceRecoveryTimer = setTimeout(() => {
            if (
              this.pc &&
              (this.pc.iceConnectionState === 'disconnected' || this.pc.iceConnectionState === 'failed')
            ) {
              if (this.connectionState === 'connected') {
                this.setState('disconnected');
                this.stopStats();
              }
            }
          }, 7000);
        }
        if (
          typeof (pc as any).restartIce === 'function' &&
          this.isInitiator &&
          this.ws?.readyState === WebSocket.OPEN
        ) {
          try {
            (pc as any).restartIce();
            pc.createOffer().then((offer) => {
              pc.setLocalDescription(offer);
              this.ws?.send(JSON.stringify({ type: 'offer', sdp: offer }));
            }).catch(() => {});
          } catch {}
        }
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        if (this.connectionState === 'connected') {
          this.setState('disconnected');
          this.stopStats();
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.setState('connected');
        this.onNotificationTone?.('success');
      } else if (pc.connectionState === 'failed') {
        this.setState('failed');
      }
    };

    return pc;
  }

  // Setup DataChannels on peer connection
  private setupDataChannels() {
    if (!this.pc) return;

    // 1. Control DataChannel for JSON coordination & chat
    this.controlDc = this.pc.createDataChannel('control', { ordered: true });
    this.bindControlChannel(this.controlDc);

    // 2. Binary DataChannel for high-speed file chunks
    this.fileDc = this.pc.createDataChannel('fileData', {
      ordered: true,
      maxRetransmits: 10,
    });
    this.bindFileChannel(this.fileDc);
  }

  private bindControlChannel(channel: RTCDataChannel) {
    this.controlDc = channel;

    channel.onopen = () => {
      this.setState('connected');
      this.addSystemMessage('Secure P2P DataChannel established (DTLS encrypted).');
      this.startPing();
      // Announce friendly device information to connected peer
      this.sendControl({ type: 'device-info', info: this.localDeviceInfo });
      this.checkAndResumePendingTransfers();
    };

    channel.onclose = () => {
      this.stopPing();
      this.addSystemMessage('Control channel closed.');
    };

    channel.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        await this.handleControlMessage(msg);
      } catch (err) {
        console.error('Error handling control message', err);
      }
    };
  }

  private bindFileChannel(channel: RTCDataChannel) {
    this.fileDc = channel;
    channel.binaryType = 'arraybuffer';
    // High-performance backpressure threshold: wake sender when buffer drops to 512 KB
    channel.bufferedAmountLowThreshold = 512 * 1024;

    channel.onmessage = (e) => {
      this.handleIncomingChunk(e.data as ArrayBuffer);
    };
  }

  // Initiator flow
  private async initiateWebRTC() {
    this.setState('connecting-webrtc');
    const pc = this.createPeerConnection();
    this.setupDataChannels();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.ws?.send(
      JSON.stringify({
        type: 'offer',
        sdp: pc.localDescription,
      })
    );
  }

  // Responder flow
  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    this.setState('connecting-webrtc');
    const pc = this.createPeerConnection();

    // Listen for incoming DataChannels created by initiator
    pc.ondatachannel = (e) => {
      if (e.channel.label === 'control') {
        this.bindControlChannel(e.channel);
      } else if (e.channel.label === 'fileData') {
        this.bindFileChannel(e.channel);
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Process queued candidates if any
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.ws?.send(
      JSON.stringify({
        type: 'answer',
        sdp: pc.localDescription,
      })
    );
  }

  private async handleAnswer(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));

    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('ICE candidate addition failed', err);
    }
  }

  private cleanupPeerConnection() {
    this.stopPing();
    this.stopStats();
    if (this.controlDc) {
      this.controlDc.close();
      this.controlDc = null;
    }
    if (this.fileDc) {
      this.fileDc.close();
      this.fileDc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.pendingCandidates = [];

    // Pause active items rather than dropping them so they can resume
    this.fileQueue.forEach((item) => {
      if (item.status === 'transferring' || item.status === 'requesting') {
        item.status = 'paused';
        item.error = `Connection paused at ${formatBytes(item.bytesTransferred)}. Ready to resume upon reconnect.`;
      }
    });
    this.activeSendId = null;
    this.onQueueChange?.([...this.fileQueue]);

    this.incomingTransfers.forEach((incoming) => {
      if (incoming.status === 'transferring') {
        incoming.status = 'paused';
        incoming.error = `Connection paused at ${formatBytes(incoming.bytesReceived)}. Ready to resume upon reconnect.`;
      }
    });
    this.onIncomingChange?.(Array.from(this.incomingTransfers.values()));
  }

  // --- Control Message Protocol ---
  private async handleControlMessage(msg: any) {
    switch (msg.type) {
      case 'ping':
        this.sendControl({ type: 'pong', timestamp: msg.timestamp });
        break;

      case 'pong':
        const rtt = Date.now() - msg.timestamp;
        this.currentStats.currentRttMs = rtt;
        this.onStats?.({ ...this.currentStats });
        break;

      case 'chat':
        const chatMsg: ChatMessage = {
          id: msg.id,
          sender: 'peer',
          text: msg.text,
          timestamp: msg.timestamp || Date.now(),
        };
        this.messages.push(chatMsg);
        this.onMessage?.(chatMsg);
        this.onNotificationTone?.('alert');
        break;

      case 'device-info':
        this.remoteDeviceInfo = msg.info;
        this.onRemoteDeviceChange?.(msg.info);
        if (msg.info?.name) {
          this.addSystemMessage(`Connected to peer device: ${msg.info.name}`);
        }
        break;

      case 'file-proposal':
        this.handleFileProposal(msg);
        break;

      case 'file-accept':
        this.handleFileAccepted(msg.id);
        break;

      case 'file-reject':
        this.handleFileRejected(msg.id, msg.reason);
        break;

      case 'file-pause':
        this.handlePeerPause(msg.id);
        break;

      case 'file-resume':
        this.handlePeerResume(msg.id);
        break;

      case 'file-cancel':
        this.handlePeerCancel(msg.id);
        break;

      case 'file-complete':
        this.handleFileCompletedBySender(msg.id, msg.checksum);
        break;

      case 'file-resume-query':
        this.handleFileResumeQuery(msg);
        break;

      case 'file-resume-response':
        this.handleFileResumeResponse(msg);
        break;
    }
  }

  public checkAndResumePendingTransfers() {
    const pendingItem = this.fileQueue.find(
      (item) => item.status === 'paused' || (item.status === 'error' && item.bytesTransferred > 0)
    );
    if (pendingItem && !this.activeSendId) {
      this.addSystemMessage(`Found interrupted file "${pendingItem.name}". Negotiating transfer resume...`);
      this.sendControl({
        type: 'file-resume-query',
        id: pendingItem.id,
        name: pendingItem.name,
        size: pendingItem.size,
        bytesTransferred: pendingItem.bytesTransferred,
      });
    }
  }

  private handleFileResumeQuery(msg: any) {
    const incoming = this.incomingTransfers.get(msg.id);
    if (incoming && incoming.status !== 'completed') {
      this.addSystemMessage(`Resuming file "${incoming.name}" from ${formatBytes(incoming.bytesReceived)}.`);
      incoming.status = 'transferring';
      incoming.error = undefined;
      this.onIncomingChange?.(Array.from(this.incomingTransfers.values()));
      this.sendControl({
        type: 'file-resume-response',
        id: msg.id,
        canResume: true,
        bytesReceived: incoming.bytesReceived,
      });
    } else {
      this.sendControl({
        type: 'file-resume-response',
        id: msg.id,
        canResume: false,
        bytesReceived: 0,
      });
    }
  }

  private async handleFileResumeResponse(msg: any) {
    const item = this.fileQueue.find((f) => f.id === msg.id);
    if (!item) return;

    if (msg.canResume) {
      this.addSystemMessage(`Resuming upload for "${item.name}" from ${formatBytes(msg.bytesReceived)}.`);
      item.bytesTransferred = msg.bytesReceived;
      item.progress = Math.min(100, Math.round((msg.bytesReceived / item.size) * 1000) / 10);
      item.status = 'transferring';
      item.error = undefined;
      this.activeSendId = item.id;
      this.isPaused = false;
      this.isCancelled = false;
      this.onQueueChange?.([...this.fileQueue]);
      await this.streamFileChunks(item);
    } else {
      this.addSystemMessage(`Peer does not have previous state for "${item.name}". Restarting upload.`);
      item.bytesTransferred = 0;
      item.progress = 0;
      item.status = 'queued';
      item.error = undefined;
      this.onQueueChange?.([...this.fileQueue]);
      await this.proposeFile(item.id);
    }
  }

  public sendControl(msg: any) {
    if (this.controlDc && this.controlDc.readyState === 'open') {
      this.controlDc.send(JSON.stringify(msg));
    }
  }

  public sendChatMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const msg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'me',
      text: trimmed,
      timestamp: Date.now(),
    };
    this.messages.push(msg);
    this.onMessage?.(msg);
    this.sendControl({
      type: 'chat',
      id: msg.id,
      text: msg.text,
      timestamp: msg.timestamp,
    });
  }

  // --- Ping RTT & Stats Gathering ---
  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.sendControl({ type: 'ping', timestamp: Date.now() });
    }, 3000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private startStats() {
    this.stopStats();
    this.lastStatsBytesTotal = (this.currentStats.bytesSent || 0) + (this.currentStats.bytesReceived || 0);
    this.lastStatsTime = Date.now();

    this.statsInterval = setInterval(async () => {
      if (!this.pc) return;
      try {
        const stats = await this.pc.getStats();
        let bytesSent = 0;
        let bytesReceived = 0;
        let candidatePair: any = undefined;

        stats.forEach((report) => {
          if (report.type === 'data-channel') {
            bytesSent += report.bytesSent || 0;
            bytesReceived += report.bytesReceived || 0;
          }
          if (
            report.type === 'candidate-pair' &&
            (report.state === 'succeeded' || report.nominated)
          ) {
            const localCandidate = stats.get(report.localCandidateId);
            const remoteCandidate = stats.get(report.remoteCandidateId);
            candidatePair = {
              localType: localCandidate?.candidateType,
              remoteType: remoteCandidate?.candidateType,
              localAddress: localCandidate?.ip || localCandidate?.address,
              remoteAddress: remoteCandidate?.ip || remoteCandidate?.address,
              protocol: report.protocol || localCandidate?.protocol,
            };
          }
        });

        const now = Date.now();
        const deltaSec = Math.max(0.1, (now - this.lastStatsTime) / 1000);
        const totalBytes = bytesSent + bytesReceived;
        const deltaBytes = Math.max(0, totalBytes - this.lastStatsBytesTotal);
        const instantSpeed = deltaBytes / deltaSec;

        this.lastStatsBytesTotal = totalBytes;
        this.lastStatsTime = now;

        // Peak speed tracking
        if (instantSpeed > this.peakSpeed) {
          this.peakSpeed = instantSpeed;
        }

        // Keep 30-sample rolling history for sparkline
        this.speedHistory.push(instantSpeed);
        if (this.speedHistory.length > 30) {
          this.speedHistory.shift();
        }

        // Average speed over non-zero samples
        if (instantSpeed > 0) {
          this.speedSamples.push(instantSpeed);
          if (this.speedSamples.length > 60) this.speedSamples.shift();
        }
        const averageSpeed =
          this.speedSamples.length > 0
            ? this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length
            : 0;

        // Detect direction and active transfer info
        const activeSend = this.fileQueue.find((f) => f.status === 'transferring');
        const activeIncoming = Array.from(this.incomingTransfers.values()).find(
          (t) => t.status === 'transferring'
        );

        let activeDirection: 'idle' | 'uploading' | 'downloading' = 'idle';
        let activeFileName: string | undefined = undefined;
        let activeProgress: number | undefined = undefined;
        let activeEtaSeconds: number | undefined = undefined;

        if (activeSend) {
          activeDirection = 'uploading';
          activeFileName = activeSend.name;
          activeProgress = activeSend.progress;
          activeEtaSeconds = activeSend.etaSeconds;
        } else if (activeIncoming) {
          activeDirection = 'downloading';
          activeFileName = activeIncoming.name;
          activeProgress = activeIncoming.progress;
          activeEtaSeconds = activeIncoming.etaSeconds;
        }

        this.currentStats = {
          bytesSent,
          bytesReceived,
          currentRttMs: this.currentStats.currentRttMs,
          candidatePair: candidatePair || this.currentStats.candidatePair,
          telemetry: {
            currentSpeed: instantSpeed,
            averageSpeed,
            peakSpeed: this.peakSpeed,
            history: [...this.speedHistory],
            bufferedAmount: this.fileDc ? this.fileDc.bufferedAmount : 0,
            activeDirection,
            activeFileName,
            activeProgress,
            activeEtaSeconds,
          },
        };
        this.onStats?.({ ...this.currentStats });
      } catch (err) {
        // Stats can fail on teardown
      }
    }, 600);
  }

  private stopStats() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  // --- File Sending Logic (Streaming, Slicing & Backpressure) ---
  public addFilesToQueue(files: Array<{ file: File; relativePath?: string }> | FileList | File[]) {
    const rawList: Array<{ file: File; relativePath?: string } | File> = Array.isArray(files)
      ? files
      : Array.from(files);
    const newItems: FileQueueItem[] = rawList.map((entry) => {
      let file: File;
      let relativePath: string | undefined;

      if ('file' in entry && (entry as any).file instanceof File) {
        file = (entry as any).file;
        relativePath = (entry as any).relativePath;
      } else {
        file = entry as File;
        relativePath = (file as any).webkitRelativePath || file.name;
      }

      return {
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        size: file.size,
        type: resolveMimeType(file.name, file.type),
        lastModified: file.lastModified,
        relativePath,
        status: 'queued',
        progress: 0,
        bytesTransferred: 0,
        speed: 0,
        etaSeconds: 0,
      };
    });

    this.fileQueue.push(...newItems);
    this.onQueueChange?.([...this.fileQueue]);
  }

  public removeQueueItem(id: string) {
    if (this.activeSendId === id) {
      this.cancelTransfer(id);
    }
    this.fileQueue = this.fileQueue.filter((item) => item.id !== id);
    this.onQueueChange?.([...this.fileQueue]);
  }

  public clearQueue() {
    this.fileQueue = this.fileQueue.filter((item) => item.status === 'transferring');
    this.onQueueChange?.([...this.fileQueue]);
  }

  public async startNextTransfer() {
    if (this.activeSendId) return;
    const nextItem = this.fileQueue.find((item) => item.status === 'queued');
    if (!nextItem) return;
    await this.proposeFile(nextItem.id);
  }

  public async proposeFile(id: string) {
    const item = this.fileQueue.find((f) => f.id === id);
    if (!item) return;

    item.status = 'requesting';
    this.onQueueChange?.([...this.fileQueue]);

    const chunkSize = this.settings.chunkSize;
    const totalChunks = Math.ceil(item.size / chunkSize);

    this.sendControl({
      type: 'file-proposal',
      id: item.id,
      name: item.name,
      size: item.size,
      mimeType: item.type,
      chunkSize,
      totalChunks,
      relativePath: item.relativePath,
    });
  }

  private async handleFileAccepted(id: string) {
    const item = this.fileQueue.find((f) => f.id === id);
    if (!item) return;

    this.activeSendId = id;
    this.isPaused = false;
    this.isCancelled = false;

    item.status = 'transferring';
    item.startTime = Date.now();
    this.onQueueChange?.([...this.fileQueue]);

    await this.streamFileChunks(item);
  }

  private handleFileRejected(id: string, reason?: string) {
    const item = this.fileQueue.find((f) => f.id === id);
    if (!item) return;
    item.status = 'error';
    item.error = reason || 'Peer rejected transfer';
    this.onQueueChange?.([...this.fileQueue]);
    this.onNotificationTone?.('alert');
  }

  private async streamFileChunks(item: FileQueueItem) {
    const chunkSize = this.settings.chunkSize;
    const totalChunks = Math.ceil(item.size / chunkSize);
    let offset = item.bytesTransferred; // Supports resuming
    let chunkIndex = Math.floor(offset / chunkSize);
    let crc = 0;

    // If resuming from an offset, reseed CRC from previously sent bytes
    if (offset > 0) {
      try {
        const transferredSlice = await item.file.slice(0, offset).arrayBuffer();
        crc = crc32Update(0, transferredSlice);
      } catch {
        crc = 0;
      }
    }

    let lastTime = Date.now();
    let bytesSinceLastSpeedCalc = 0;

    while (offset < item.size) {
      if (this.isCancelled) {
        item.status = 'cancelled';
        this.activeSendId = null;
        this.onQueueChange?.([...this.fileQueue]);
        return;
      }

      if (this.isPaused) {
        item.status = 'paused';
        this.onQueueChange?.([...this.fileQueue]);
        return;
      }

      if (!this.fileDc || this.fileDc.readyState !== 'open') {
        item.status = 'paused';
        item.error = `Connection paused at ${formatBytes(offset)}. Ready to resume upon reconnect.`;
        item.bytesTransferred = offset;
        this.activeSendId = null;
        this.onQueueChange?.([...this.fileQueue]);
        return;
      }

      // HIGH-PERFORMANCE ZERO-COPY BACKPRESSURE:
      // Allow up to 4MB in flight for high-throughput LAN/Wi-Fi pipes.
      // Only wait when SCTP buffer exceeds 4MB, resuming as soon as low watermark (512KB) is reached.
      if (this.fileDc.bufferedAmount > 4 * 1024 * 1024) {
        await new Promise<void>((resolve) => {
          if (!this.fileDc) return resolve();
          this.fileDc.onbufferedamountlow = () => {
            if (this.fileDc) this.fileDc.onbufferedamountlow = null;
            resolve();
          };
        });
      }

      // Slice next chunk directly from file (0-copy disk stream, no RAM explosion!)
      const nextSlice = item.file.slice(offset, offset + chunkSize);
      const arrayBuffer = await nextSlice.arrayBuffer();

      // Update CRC32
      crc = crc32Update(crc, arrayBuffer);

      // Send chunk over raw binary DataChannel
      try {
        this.fileDc.send(arrayBuffer);
      } catch (err: any) {
        item.status = 'paused';
        item.error = `Interrupted: ${err.message}. Ready to resume.`;
        item.bytesTransferred = offset;
        this.activeSendId = null;
        this.onQueueChange?.([...this.fileQueue]);
        return;
      }

      offset += arrayBuffer.byteLength;
      chunkIndex++;
      bytesSinceLastSpeedCalc += arrayBuffer.byteLength;

      // Calculate speed & ETA every 200ms
      const now = Date.now();
      const deltaMs = now - lastTime;
      if (deltaMs >= 200 || offset >= item.size) {
        const currentSpeed = (bytesSinceLastSpeedCalc / deltaMs) * 1000;
        item.speed = currentSpeed;
        const remainingBytes = item.size - offset;
        item.etaSeconds = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;
        item.progress = Math.min(100, Math.round((offset / item.size) * 1000) / 10);
        item.bytesTransferred = offset;
        this.onQueueChange?.([...this.fileQueue]);

        lastTime = now;
        bytesSinceLastSpeedCalc = 0;
      }

      // Micro-yield via queueMicrotask or every 64 chunks to prevent browser freezing without clamping throughput
      if (chunkIndex % 64 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // Finished transmission
    const checksum = crc32ToHex(crc);
    item.checksum = checksum;
    item.status = 'completed';
    item.progress = 100;
    item.bytesTransferred = item.size;
    item.endTime = Date.now();
    this.activeSendId = null;
    this.onQueueChange?.([...this.fileQueue]);

    // Save to transfer history
    saveTransferHistoryItem({
      id: item.id,
      name: item.name,
      size: item.size,
      type: item.type,
      direction: 'sent',
      timestamp: item.endTime,
      durationSeconds: Math.round(((item.endTime || Date.now()) - (item.startTime || Date.now())) / 1000),
      averageSpeed: item.startTime
        ? item.size / Math.max(0.1, ((item.endTime || Date.now()) - item.startTime) / 1000)
        : 0,
      checksum,
      relativePath: item.relativePath,
    });

    // Send complete control notification to receiver with checksum
    this.sendControl({
      type: 'file-complete',
      id: item.id,
      checksum,
    });

    this.onNotificationTone?.('complete');

    // Auto-continue to next queued file
    setTimeout(() => {
      this.startNextTransfer();
    }, 400);
  }

  // --- Transfer Control: Pause, Resume, Cancel ---
  public pauseTransfer(id: string) {
    if (this.activeSendId === id) {
      this.isPaused = true;
      const item = this.fileQueue.find((f) => f.id === id);
      if (item) {
        item.status = 'paused';
        this.onQueueChange?.([...this.fileQueue]);
      }
      this.sendControl({ type: 'file-pause', id });
    }
  }

  public async resumeTransfer(id: string) {
    const item = this.fileQueue.find((f) => f.id === id);
    if (!item) return;

    if (this.controlDc && this.controlDc.readyState === 'open') {
      this.addSystemMessage(`Negotiating resume for "${item.name}"...`);
      this.sendControl({
        type: 'file-resume-query',
        id: item.id,
        name: item.name,
        size: item.size,
        bytesTransferred: item.bytesTransferred,
      });
    } else {
      this.addSystemMessage('Waiting for P2P connection to re-establish before resuming transfer...');
    }
  }

  public cancelTransfer(id: string) {
    if (this.activeSendId === id) {
      this.isCancelled = true;
      this.isPaused = false;
      this.activeSendId = null;
    }
    const item = this.fileQueue.find((f) => f.id === id);
    if (item) {
      item.status = 'cancelled';
      this.onQueueChange?.([...this.fileQueue]);
    }
    this.sendControl({ type: 'file-cancel', id });
  }

  // --- Receiving Logic ---
  private async handleFileProposal(msg: any) {
    const resolvedType = resolveMimeType(msg.name, msg.mimeType);
    const incoming: IncomingTransfer = {
      id: msg.id,
      name: msg.name,
      size: msg.size,
      type: resolvedType,
      relativePath: msg.relativePath,
      chunksExpected: msg.totalChunks,
      chunksReceived: 0,
      bytesReceived: 0,
      progress: 0,
      speed: 0,
      etaSeconds: 0,
      status: this.settings.autoAcceptTransfers ? 'transferring' : 'pending-approval',
      startTime: Date.now(),
    };

    this.incomingTransfers.set(msg.id, incoming);
    this.incomingCrc.set(msg.id, 0);
    this.incomingOffsets.set(msg.id, 0);

    // Initialize disk streaming writer (OPFS or progressive sub-blobs)
    try {
      const writer = await createDiskStreamWriter(msg.id, msg.name, msg.size, resolvedType);
      this.incomingWriters.set(msg.id, writer);
      incoming.isDiskStreamed = writer.isOPFS;
    } catch (e) {
      console.warn('Failed to initialize disk stream writer, fallback to memory', e);
      this.incomingChunks.set(msg.id, []);
    }

    this.onIncomingChange?.(Array.from(this.incomingTransfers.values()));
    this.onNotificationTone?.('alert');

    if (this.settings.autoAcceptTransfers) {
      this.acceptIncomingTransfer(msg.id);
    }
  }

  public acceptIncomingTransfer(id: string) {
    const incoming = this.incomingTransfers.get(id);
    if (!incoming) return;

    incoming.status = 'transferring';
    incoming.startTime = Date.now();
    this.onIncomingChange?.(Array.from(this.incomingTransfers.values()));

    this.sendControl({ type: 'file-accept', id });
  }

  public async rejectIncomingTransfer(id: string, reason = 'Declined by recipient') {
    const incoming = this.incomingTransfers.get(id);
    if (!incoming) return;

    incoming.status = 'cancelled';
    incoming.error = reason;
    this.onIncomingChange?.(Array.from(this.incomingTransfers.values()));

    this.sendControl({ type: 'file-reject', id, reason });
    this.incomingChunks.delete(id);
    this.incomingCrc.delete(id);
    this.incomingOffsets.delete(id);

    const writer = this.incomingWriters.get(id);
    if (writer) {
      await writer.cleanup();
      this.incomingWriters.delete(id);
    }
  }

  private handleIncomingChunk(data: ArrayBuffer) {
    // Find active transferring or resumed incoming file
    const activeIncoming = Array.from(this.incomingTransfers.values()).find(
      (t) => t.status === 'transferring' || t.status === 'paused'
    );
    if (!activeIncoming) return;
    if (activeIncoming.status === 'paused') {
      activeIncoming.status = 'transferring';
    }

    const currentOffset = this.incomingOffsets.get(activeIncoming.id) || 0;
    const chunkBytes = new Uint8Array(data);

    // Stream chunk to disk writer with strict offset to prevent byte shift or duplication
    const writer = this.incomingWriters.get(activeIncoming.id);
    if (writer) {
      writer.writeChunkAt(currentOffset, chunkBytes).catch((err) => {
        console.error('Error writing chunk to disk stream:', err);
      });
    } else {
      let chunks = this.incomingChunks.get(activeIncoming.id);
      if (!chunks) {
        chunks = [];
        this.incomingChunks.set(activeIncoming.id, chunks);
      }
      chunks.push(data);
    }

    this.incomingOffsets.set(activeIncoming.id, currentOffset + data.byteLength);

    activeIncoming.chunksReceived++;
    activeIncoming.bytesReceived += data.byteLength;

    // Update CRC
    const prevCrc = this.incomingCrc.get(activeIncoming.id) || 0;
    const newCrc = crc32Update(prevCrc, data);
    this.incomingCrc.set(activeIncoming.id, newCrc);

    // Speed calculation
    const elapsedSecs = (Date.now() - (activeIncoming.startTime || Date.now())) / 1000;
    if (elapsedSecs > 0) {
      activeIncoming.speed = activeIncoming.bytesReceived / elapsedSecs;
      const remainingBytes = activeIncoming.size - activeIncoming.bytesReceived;
      activeIncoming.etaSeconds =
        activeIncoming.speed > 0 ? remainingBytes / activeIncoming.speed : 0;
    }

    activeIncoming.progress = Math.min(
      100,
      Math.round((activeIncoming.bytesReceived / activeIncoming.size) * 1000) / 10
    );

    // Throttle progress updates to UI every 15 chunks or when complete
    if (
      activeIncoming.chunksReceived % 15 === 0 ||
      activeIncoming.bytesReceived >= activeIncoming.size
    ) {
      this.onIncomingChange?.(Array.from(this.incomingTransfers.values()));
    }
  }

  private async handleFileCompletedBySender(id: string, senderChecksum?: string) {
    const incoming = this.incomingTransfers.get(id);
    if (!incoming) return;

    const finalCrc = this.incomingCrc.get(id) || 0;
    const computedChecksum = crc32ToHex(finalCrc);

    incoming.status = 'completed';
    incoming.progress = 100;
    incoming.bytesReceived = incoming.size;
    incoming.endTime = Date.now();
    incoming.checksum = computedChecksum;

    // Checksum verification warning if mismatch
    if (senderChecksum && senderChecksum !== computedChecksum) {
      incoming.error = `Checksum mismatch (Sent: ${senderChecksum}, Received: ${computedChecksum})`;
      console.warn('CRC-32 checksum mismatch', incoming.error);
    }

    // Finalize file and trigger download safely
    try {
      let finalFileOrBlob: Blob | File;
      const writer = this.incomingWriters.get(id);

      if (writer) {
        finalFileOrBlob = await writer.finish();
      } else {
        const chunks = this.incomingChunks.get(id) || [];
        finalFileOrBlob = new Blob(chunks, { type: incoming.type });
      }

      let downloadUrl = '';
      if (this.settings.autoDownload) {
        downloadUrl = triggerFileDownload(finalFileOrBlob, incoming.name);
      } else {
        downloadUrl = URL.createObjectURL(finalFileOrBlob);
      }
      incoming.blobUrl = downloadUrl;

      // Save to transfer history
      saveTransferHistoryItem({
        id: incoming.id,
        name: incoming.name,
        size: incoming.size,
        type: incoming.type,
        direction: 'received',
        timestamp: incoming.endTime || Date.now(),
        durationSeconds: Math.round(((incoming.endTime || Date.now()) - (incoming.startTime || Date.now())) / 1000),
        averageSpeed: incoming.startTime
          ? incoming.size / Math.max(0.1, ((incoming.endTime || Date.now()) - incoming.startTime) / 1000)
          : 0,
        checksum: incoming.checksum,
        relativePath: incoming.relativePath,
        blobUrl: downloadUrl,
      });

      this.onNotificationTone?.('complete');

      // Gentle haptic feedback on completion
      if (this.settings.enableVibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([80, 50, 80]);
        } catch {}
      }

      // Check if all transfers completed to release wake lock
      const hasActiveSending = this.fileQueue.some((f) => f.status === 'transferring');
      const hasActiveReceiving = Array.from(this.incomingTransfers.values()).some((f) => f.status === 'transferring');
      if (!hasActiveSending && !hasActiveReceiving) {
        this.releaseWakeLock();
      }
    } catch (err: any) {
      console.error('Error completing file download:', err);
      incoming.error = `Error creating file download: ${err.message}`;
    }

    this.onIncomingChange?.(Array.from(this.incomingTransfers.values()));
    // Free chunk buffers and writer from memory
    this.incomingChunks.delete(id);
    this.incomingCrc.delete(id);
    this.incomingOffsets.delete(id);
    this.incomingWriters.delete(id);
  }

  private handlePeerPause(id: string) {
    const incoming = this.incomingTransfers.get(id);
    if (incoming) {
      incoming.status = 'paused';
      this.onIncomingChange?.(Array.from(this.incomingTransfers.values()));
    }
  }

  private handlePeerResume(id: string) {
    const incoming = this.incomingTransfers.get(id);
    if (incoming) {
      incoming.status = 'transferring';
      this.onIncomingChange?.(Array.from(this.incomingTransfers.values()));
    }
  }

  private async handlePeerCancel(id: string) {
    const incoming = this.incomingTransfers.get(id);
    if (incoming) {
      incoming.status = 'cancelled';
      incoming.error = 'Sender cancelled transfer';
      this.onIncomingChange?.(Array.from(this.incomingTransfers.values()));
      this.incomingChunks.delete(id);
      this.incomingCrc.delete(id);
      this.incomingOffsets.delete(id);
      const writer = this.incomingWriters.get(id);
      if (writer) {
        await writer.cleanup();
        this.incomingWriters.delete(id);
      }
    }
  }
}

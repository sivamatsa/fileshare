export type ConnectionState =
  | 'idle'
  | 'connecting-signal'
  | 'waiting-peer'
  | 'connecting-webrtc'
  | 'connected'
  | 'disconnected'
  | 'failed';

export type IceMode = 'stun' | 'lan-only';

export interface IceCandidateInfo {
  localType?: string;
  remoteType?: string;
  localAddress?: string;
  remoteAddress?: string;
  protocol?: string;
}

export interface SpeedTelemetry {
  currentSpeed: number; // bytes/sec
  averageSpeed: number; // bytes/sec
  peakSpeed: number; // bytes/sec
  history: number[]; // last 30 data points in bytes/sec
  bufferedAmount: number; // SCTP buffer bytes
  activeDirection: 'idle' | 'uploading' | 'downloading';
  activeFileName?: string;
  activeProgress?: number;
  activeEtaSeconds?: number;
}

export interface WebRTCStats {
  bytesSent: number;
  bytesReceived: number;
  currentRttMs?: number;
  candidatePair?: IceCandidateInfo;
  telemetry?: SpeedTelemetry;
}

export interface DeviceInfo {
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  os: string;
  browser: string;
}

export interface TransferHistoryItem {
  id: string;
  name: string;
  size: number;
  type: string;
  direction: 'sent' | 'received';
  timestamp: number;
  durationSeconds: number;
  averageSpeed: number;
  checksum?: string;
  relativePath?: string;
  blobUrl?: string;
}

export interface FileQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  relativePath?: string;
  status: 'queued' | 'requesting' | 'transferring' | 'paused' | 'completed' | 'cancelled' | 'error';
  progress: number; // 0 to 100
  bytesTransferred: number;
  speed: number; // bytes per second
  etaSeconds: number;
  checksum?: string;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface IncomingTransfer {
  id: string;
  name: string;
  size: number;
  type: string;
  relativePath?: string;
  chunksExpected: number;
  chunksReceived: number;
  bytesReceived: number;
  progress: number;
  speed: number;
  etaSeconds: number;
  status: 'pending-approval' | 'transferring' | 'paused' | 'completed' | 'cancelled' | 'error';
  blobUrl?: string;
  isDiskStreamed?: boolean;
  checksum?: string;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'me' | 'peer' | 'system';
  text: string;
  timestamp: number;
}

export interface NearbyDevice {
  peerId: string;
  code: string;
  device: DeviceInfo;
  networkGroup?: string;
  isSelf?: boolean;
}

export interface TransferSettings {
  chunkSize: number; // bytes, default 262144 (256KB)
  iceMode: IceMode;
  customStunUrl: string;
  customSignalingUrl?: string; // WebSocket signaling URL (e.g. for GitHub Pages / static deployment)
  autoAcceptTransfers: boolean;
  enableSoundAlerts: boolean;
  enableWakeLock: boolean;
  enableVibration: boolean;
  autoDownload: boolean;
  enableLocalDiscovery: boolean;
}

// Protocol signaling messages over DataChannel
export type DataChannelMessage =
  | { type: 'chat'; id: string; text: string; timestamp: number }
  | { type: 'ping'; timestamp: number }
  | { type: 'pong'; timestamp: number }
  | { type: 'device-info'; info: DeviceInfo }
  | {
      type: 'file-proposal';
      id: string;
      name: string;
      size: number;
      mimeType: string;
      chunkSize: number;
      totalChunks: number;
      relativePath?: string;
    }
  | { type: 'file-accept'; id: string }
  | { type: 'file-reject'; id: string; reason?: string }
  | { type: 'file-chunk-meta'; id: string; chunkIndex: number; totalChunks: number; bytes: number }
  | { type: 'file-pause'; id: string }
  | { type: 'file-resume'; id: string }
  | { type: 'file-cancel'; id: string }
  | { type: 'file-complete'; id: string; checksum?: string };

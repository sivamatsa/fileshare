import React, { useEffect, useRef, useState } from 'react';
import { P2PManager } from './services/webrtc';
import { Header } from './components/Header';
import { RoomJoiner } from './components/RoomJoiner';
import { FileSender } from './components/FileSender';
import { IncomingTransfers } from './components/IncomingTransferCard';
import { PeerChat } from './components/PeerChat';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { SettingsModal } from './components/SettingsModal';
import { QrCodeModal } from './components/QrCodeModal';
import { SpeedMonitor } from './components/SpeedMonitor';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { TransferHistoryModal } from './components/TransferHistoryModal';
import { FullscreenDropOverlay } from './components/FullscreenDropOverlay';
import {
  ConnectionState,
  FileQueueItem,
  IncomingTransfer,
  ChatMessage,
  WebRTCStats,
  TransferSettings,
  DeviceInfo,
  NearbyDevice,
} from './types';
import { playNotificationTone, generateRoomCode } from './utils/formatters';
import { autoPruneHistory } from './utils/history';
import {
  ShieldCheck,
  Radio,
  Share2,
  Copy,
  Check,
  Users,
  QrCode,
  Sparkles,
} from 'lucide-react';

export default function App() {
  const p2pRef = useRef<P2PManager | null>(null);

  // States
  const [roomCode, setRoomCode] = useState<string>('');
  const [localDeviceCode, setLocalDeviceCode] = useState<string>(() => generateRoomCode());
  const [nearbyDevices, setNearbyDevices] = useState<NearbyDevice[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [incomingTransfers, setIncomingTransfers] = useState<IncomingTransfer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stats, setStats] = useState<WebRTCStats>({ bytesSent: 0, bytesReceived: 0 });
  const [peerDevice, setPeerDevice] = useState<DeviceInfo | undefined>(undefined);
  const [settings, setSettings] = useState<TransferSettings>(() => {
    const defaults: TransferSettings = {
      chunkSize: 256 * 1024, // 256KB High-Performance Turbo
      iceMode: 'stun',
      customStunUrl: '',
      customSignalingUrl: '',
      autoAcceptTransfers: true, // Enabled by default as requested
      enableSoundAlerts: true,
      enableWakeLock: true,
      enableVibration: true,
      autoDownload: true,
      enableLocalDiscovery: true,
    };
    try {
      const saved = localStorage.getItem('p2p_settings');
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
    } catch {}
    return defaults;
  });

  // Modal toggles & Preview Target
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{
    name: string;
    type: string;
    size: number;
    blobUrl: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize P2P manager once
  useEffect(() => {
    const manager = new P2PManager(settings);
    p2pRef.current = manager;

    manager.onStateChange = (state) => {
      setConnectionState(state);
    };

    manager.onQueueChange = (queue) => {
      setFileQueue([...queue]);
    };

    manager.onIncomingChange = (incoming) => {
      setIncomingTransfers([...incoming]);
    };

    manager.onMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    manager.onStats = (newStats) => {
      setStats({ ...newStats });
    };

    manager.onError = (err) => {
      setErrorMessage(err);
      setTimeout(() => setErrorMessage(null), 5000);
    };

    manager.onNotificationTone = (type) => {
      if (manager.settings.enableSoundAlerts) {
        playNotificationTone(type);
      }
    };

    manager.onRemoteDeviceChange = (info) => {
      setPeerDevice(info);
    };

    manager.onNearbyDevicesChange = (devices) => {
      setNearbyDevices([...devices]);
    };

    manager.onIncomingInvite = (invite) => {
      handleJoin(invite.roomCode);
    };

    // Auto-prune transfer history for 30-minute auto-expiry
    autoPruneHistory();
    const pruneInterval = setInterval(() => {
      autoPruneHistory();
    }, 30000);

    // Check URL parameters for room code first, then fall back to saved session
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const savedRoom = sessionStorage.getItem('p2p_active_room');
    const targetRoom = (roomParam || savedRoom || '').trim().toUpperCase();

    if (targetRoom) {
      setRoomCode(targetRoom);
      sessionStorage.setItem('p2p_active_room', targetRoom);
      const newUrl = `${window.location.pathname}?room=${encodeURIComponent(targetRoom)}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);
      manager.connect(targetRoom);
    } else {
      // Connect signaling to broadcast presence and listen for local network devices
      manager.connectSignalingOnly(localDeviceCode);
    }

    return () => {
      clearInterval(pruneInterval);
      manager.disconnect();
    };
  }, []);

  const handleJoin = (code: string) => {
    if (!p2pRef.current) return;
    setRoomCode(code);
    sessionStorage.setItem('p2p_active_room', code);
    // Update URL without reload for easy sharing
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(code)}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    p2pRef.current.connect(code);
  };

  const handleConnectNearby = (device: NearbyDevice) => {
    if (!p2pRef.current) return;
    p2pRef.current.inviteDevice(device.peerId, device.code);
    handleJoin(device.code);
  };

  const handleRegenerateLocalCode = () => {
    const fresh = generateRoomCode();
    setLocalDeviceCode(fresh);
    p2pRef.current?.announcePresence(fresh);
  };

  const handleDisconnect = () => {
    if (!p2pRef.current) return;
    p2pRef.current.disconnect();
    setRoomCode('');
    setPeerDevice(undefined);
    sessionStorage.removeItem('p2p_active_room');
    setFileQueue([]);
    setIncomingTransfers([]);
    setMessages([]);
    window.history.pushState({}, '', window.location.pathname);
    p2pRef.current.connectSignalingOnly(localDeviceCode);
  };

  const handleUpdateSettings = (newSettings: Partial<TransferSettings>, newDeviceName?: string) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('p2p_settings', JSON.stringify(updated));
      } catch {}
      p2pRef.current?.updateSettings(updated);
      return updated;
    });
    if (newDeviceName && p2pRef.current) {
      p2pRef.current.localDeviceInfo.name = newDeviceName;
    }
  };

  const handleCopyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
      roomCode
    )}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const el = document.createElement('textarea');
        el.value = inviteUrl;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const isConnected = connectionState === 'connected';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans relative">
      {/* Full-screen Drag & Drop Target Overlay */}
      <FullscreenDropOverlay
        onFilesScanned={(scanned) => p2pRef.current?.addFilesToQueue(scanned)}
      />

      <Header
        roomCode={roomCode}
        connectionState={connectionState}
        stats={stats}
        peerDevice={peerDevice}
        onOpenInvite={() => setIsInviteOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onDisconnect={handleDisconnect}
      />

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="bg-rose-950/90 border-b border-rose-800 text-rose-200 px-4 py-2.5 text-center text-xs font-medium sticky top-16 z-20 flex items-center justify-center gap-2">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-100 text-sm font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {!roomCode ? (
          /* Landing / Room Joiner view */
          <div className="flex-1 flex items-center justify-center">
            <RoomJoiner
              initialCode={roomCode}
              localCode={localDeviceCode}
              onRegenerateLocalCode={handleRegenerateLocalCode}
              onJoin={handleJoin}
              isConnecting={connectionState === 'connecting-signal'}
              nearbyDevices={nearbyDevices}
              onConnectNearby={handleConnectNearby}
            />
          </div>
        ) : (
          /* Active Room View */
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Waiting for Peer Banner */}
            {connectionState === 'waiting-peer' && (
              <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                      <span>Waiting for second device to connect</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      Open this page on your other computer or smartphone and enter room code{' '}
                      <strong className="font-mono text-cyan-300 font-bold">{roomCode}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="btn-waiting-copy-link"
                    onClick={handleCopyInviteLink}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Link Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    id="btn-waiting-qr"
                    onClick={() => setIsInviteOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Show QR</span>
                  </button>
                </div>
              </div>
            )}

            {/* Real-time High-Throughput Speed Monitor & Telemetry */}
            <SpeedMonitor
              telemetry={stats.telemetry}
              isConnected={isConnected}
              chunkSize={settings.chunkSize}
              onUpdateChunkSize={(size) => handleUpdateSettings({ chunkSize: size })}
            />

            {/* Main Transfer Workspace Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
              {/* Left Column: File Sender */}
              <div className="h-full">
                <FileSender
                  queue={fileQueue}
                  isPeerConnected={isConnected}
                  onAddFiles={(files) => p2pRef.current?.addFilesToQueue(files)}
                  onSendItem={(id) => p2pRef.current?.proposeFile(id)}
                  onSendAll={() => p2pRef.current?.startNextTransfer()}
                  onPauseItem={(id) => p2pRef.current?.pauseTransfer(id)}
                  onResumeItem={(id) => p2pRef.current?.resumeTransfer(id)}
                  onPauseAll={() => p2pRef.current?.pauseAllTransfers()}
                  onResumeAll={() => p2pRef.current?.resumeAllTransfers()}
                  onCancelItem={(id) => p2pRef.current?.cancelTransfer(id)}
                  onRemoveItem={(id) => p2pRef.current?.removeQueueItem(id)}
                  onClearQueue={() => p2pRef.current?.clearQueue()}
                />
              </div>

              {/* Right Column: Incoming Transfers & Direct Chat */}
              <div className="space-y-6 flex flex-col h-full">
                <div className="flex-1">
                  <IncomingTransfers
                    transfers={incomingTransfers}
                    onAccept={(id) => p2pRef.current?.acceptIncomingTransfer(id)}
                    onReject={(id) => p2pRef.current?.rejectIncomingTransfer(id)}
                    onClearFinished={() => p2pRef.current?.clearCompletedIncoming()}
                    onPreview={(transfer) => {
                      if (transfer.blobUrl) {
                        setPreviewTarget({
                          name: transfer.name,
                          type: transfer.type,
                          size: transfer.size,
                          blobUrl: transfer.blobUrl,
                        });
                      }
                    }}
                  />
                </div>

                <div>
                  <PeerChat
                    messages={messages}
                    isPeerConnected={isConnected}
                    onSendMessage={(text) => p2pRef.current?.sendChatMessage(text)}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Security & Privacy Bar */}
            <div className="bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-3 text-xs text-neutral-400 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  <strong className="text-neutral-200">Zero Server Storage:</strong> Files travel directly
                  from device A memory/disk to device B via DTLS 1.2 encrypted WebRTC DataChannel.
                </span>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-500">
                <span>Chunk: {settings.chunkSize / 1024} KB</span>
                <span>Mode: {settings.iceMode === 'stun' ? 'STUN Traversal' : 'LAN Air-gap'}</span>
                <span>Peer ID: {p2pRef.current?.peerId}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <QrCodeModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roomCode={roomCode}
      />

      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        connectionState={connectionState}
        stats={stats}
        roomCode={roomCode}
        peerId={p2pRef.current?.peerId || ''}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleUpdateSettings}
      />

      {/* Media Preview Modal */}
      {previewTarget && (
        <MediaPreviewModal
          isOpen={!!previewTarget}
          onClose={() => setPreviewTarget(null)}
          name={previewTarget.name}
          type={previewTarget.type}
          size={previewTarget.size}
          blobUrl={previewTarget.blobUrl}
        />
      )}

      {/* Transfer History Modal */}
      <TransferHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
    </div>
  );
}

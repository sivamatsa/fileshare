import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  KeyRound,
  ShieldCheck,
  Zap,
  ClipboardPaste,
  Copy,
  Check,
  QrCode,
  Share2,
  Laptop,
  Smartphone,
  Tablet,
  RefreshCw,
  Radio,
  Wifi,
  X,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import { NearbyDevice } from '../types';
import { detectLocalDevice, getDeviceNickname } from '../utils/device';

interface RoomJoinerProps {
  initialCode?: string;
  localCode: string;
  onRegenerateLocalCode: () => void;
  onJoin: (code: string) => void;
  isConnecting: boolean;
  nearbyDevices: NearbyDevice[];
  onConnectNearby: (device: NearbyDevice) => void;
}

export const RoomJoiner: React.FC<RoomJoinerProps> = ({
  initialCode = '',
  localCode,
  onRegenerateLocalCode,
  onJoin,
  isConnecting,
  nearbyDevices,
  onConnectNearby,
}) => {
  // Remote code entered by the user
  const [remoteCode, setRemoteCode] = useState(initialCode);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [localDevice] = useState(() => detectLocalDevice());
  const [nickname] = useState(() => getDeviceNickname());

  // Generate invite URL for this device's code
  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(localCode)}`
    : '';

  // Generate QR Code when QR modal opens or localCode changes
  useEffect(() => {
    if (inviteUrl) {
      QRCode.toDataURL(inviteUrl, {
        width: 260,
        margin: 2,
        color: {
          dark: '#09090b',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code generation error:', err));
    }
  }, [inviteUrl]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(localCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Direct File Transfer Link',
          text: `Connect to ${nickname || localDevice.name} using room code ${localCode}`,
          url: inviteUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  const handlePasteRemoteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Check if user pasted a full URL
        try {
          const url = new URL(text);
          const roomParam = url.searchParams.get('room');
          if (roomParam) {
            setRemoteCode(roomParam.trim().toUpperCase());
            return;
          }
        } catch {
          // Not a URL, treat as raw code
        }
        setRemoteCode(text.trim().toUpperCase().slice(0, 24));
      }
    } catch {
      // Clipboard permission denied
    }
  };

  const handleRemoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = remoteCode.trim().toUpperCase();
    if (clean) {
      onJoin(clean);
    }
  };

  const getDeviceIcon = (type: string) => {
    if (type === 'mobile') return <Smartphone className="w-5 h-5 text-cyan-400" />;
    if (type === 'tablet') return <Tablet className="w-5 h-5 text-purple-400" />;
    return <Laptop className="w-5 h-5 text-emerald-400" />;
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-6 sm:my-10 px-4">
      {/* Title & Core Philosophy */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 text-xs font-semibold tracking-wide mb-3">
          <Zap className="w-3.5 h-3.5 text-cyan-400" /> Direct SCTP WebRTC Stream • Zero Server Storage
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-100 tracking-tight">
          Pair Your Devices
        </h1>
        <p className="mt-2 text-neutral-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          Connect your phone, laptop, or tablet in one click on the same Wi-Fi, or share a 5-digit PIN to transfer files directly.
        </p>
      </div>

      {/* 1. LAN / Same Wi-Fi Auto-Discovery Radar Card */}
      <div className="mb-6 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800/90 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800/70">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
              <Wifi className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-neutral-100">
                  Devices on Same Local Wi-Fi
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                  Auto-Discovery
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Connect instantly without typing a code when devices are on the same network
              </p>
            </div>
          </div>
          <div className="text-xs text-neutral-500 font-mono flex items-center gap-1.5 self-start sm:self-center">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Radar active</span>
          </div>
        </div>

        {/* Nearby Devices List */}
        <div className="mt-4">
          {nearbyDevices.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {nearbyDevices.map((d) => (
                <div
                  key={d.peerId}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 hover:border-cyan-500/50 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 shrink-0">
                      {getDeviceIcon(d.device.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-100 truncate">
                        {d.device.name || `${d.device.os} Device`}
                      </div>
                      <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-cyan-400 font-semibold">PIN {d.code}</span>
                        <span>•</span>
                        <span>{d.device.browser}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onConnectNearby(d)}
                    disabled={isConnecting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-neutral-950 font-bold text-xs transition shadow-md shadow-cyan-950/40 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Connect</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 px-3 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400 bg-neutral-950/40 rounded-xl border border-dashed border-neutral-800/80">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span>
                  No other devices detected on this network yet. Open this website on your second device to connect in 1 click!
                </span>
              </div>
              <span className="text-[11px] text-neutral-500 shrink-0">
                (Or use the 5-digit PIN below)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Distinct Two-Column Code Section: "This Device Code" vs "Enter Remote Code" */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: THIS DEVICE CODE (SHARE / COPY) */}
        <div className="bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700/90 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200">
                  This Device's Code
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800/60 text-cyan-300 text-[10px] font-bold">
                Share with Peer
              </span>
            </div>

            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              Enter this 5-digit PIN on your other phone or laptop to connect directly to this device.
            </p>

            {/* Big 5-digit PIN Display */}
            <div className="bg-neutral-950 border border-cyan-500/40 rounded-xl p-4 mb-4 text-center relative group">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-1">
                Your 5-Digit PIN
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-cyan-300 tracking-[0.25em] select-all">
                {localCode}
              </div>
              <div className="mt-1 text-[11px] text-neutral-400 font-mono">
                {nickname || localDevice.name} ({localDevice.os})
              </div>
            </div>

            {/* Action Buttons: Copy Code, Copy Link, Show QR, Share */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                type="button"
                id="btn-copy-device-code"
                onClick={handleCopyCode}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 text-neutral-200 text-xs font-semibold transition cursor-pointer"
                title="Copy 5-digit PIN"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Copy PIN</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-copy-invite-link"
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 text-neutral-200 text-xs font-semibold transition cursor-pointer"
                title="Copy direct invite link"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-show-qr"
                onClick={() => setShowQrModal(true)}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 text-neutral-200 text-xs font-semibold transition cursor-pointer"
                title="Scan QR Code with camera"
              >
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>QR Code</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onRegenerateLocalCode}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
              title="Generate a fresh code"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>New Code</span>
            </button>

            <button
              type="button"
              onClick={() => onJoin(localCode)}
              disabled={isConnecting}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-medium text-cyan-300 transition cursor-pointer"
            >
              Wait in this Room
            </button>
          </div>
        </div>

        {/* CARD 2: ENTER REMOTE DEVICE'S CODE (INPUT / CONNECT) */}
        <div className="bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700/90 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <form onSubmit={handleRemoteSubmit} className="flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-400">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200">
                    Connect to Other Device
                  </h2>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800/60 text-emerald-300 text-[10px] font-bold">
                  Enter Peer Code
                </span>
              </div>

              <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                Type or paste the 5-digit PIN displayed on your other device to start transfer.
              </p>

              {/* Input field with Paste button */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="remote-code-input"
                      type="text"
                      value={remoteCode}
                      onChange={(e) => setRemoteCode(e.target.value.toUpperCase())}
                      placeholder="e.g. 58291"
                      maxLength={24}
                      className="w-full px-4 py-3.5 bg-neutral-950 border border-neutral-700/80 rounded-xl text-neutral-100 placeholder-neutral-600 font-mono text-xl sm:text-2xl font-bold tracking-[0.2em] focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition text-center"
                      required
                    />
                  </div>

                  <button
                    type="button"
                    id="btn-paste-remote-code"
                    onClick={handlePasteRemoteCode}
                    className="px-4 py-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-neutral-100 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste className="w-4 h-4 text-cyan-400" />
                    <span className="hidden sm:inline">Paste</span>
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-neutral-500">
                  Tip: Pasting a full invite link automatically extracts the 5-digit code.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800/80">
              <button
                type="submit"
                id="btn-connect-remote"
                disabled={isConnecting || !remoteCode.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-neutral-950 font-bold text-sm sm:text-base transition shadow-lg shadow-cyan-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting Signaling...</span>
                  </>
                ) : (
                  <>
                    <span>Connect to Device</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Feature Badges */}
      <div className="mt-8 pt-6 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        <div className="flex gap-3 items-start">
          <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-cyan-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-neutral-200">Zero Server Storage</h4>
            <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
              Files stream chunk-by-chunk directly between browsers without touching disk or cloud.
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-emerald-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-neutral-200">1-Click Wi-Fi Discovery</h4>
            <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
              Devices on the same network broadcast presence for immediate connection without typing codes.
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-purple-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-neutral-200">Gigabyte Scale Speed</h4>
            <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
              Turbo 256KB WebRTC chunk slicing transfers 4K videos and large files at LAN wire speed.
            </p>
          </div>
        </div>
      </div>

      {/* QR Code Modal for Phone Camera Scanning */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-cyan-950/70 border border-cyan-800/60 text-cyan-400">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-neutral-100">Scan to Connect</h3>
            </div>

            <p className="text-xs text-neutral-400 mb-4">
              Point your smartphone camera at this QR code to open the app and pair automatically.
            </p>

            <div className="bg-white p-4 rounded-xl shadow-inner inline-block mx-auto mb-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Connect QR Code" className="w-52 h-52 mx-auto" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-neutral-400 text-xs">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 mb-4">
              <div className="text-[10px] uppercase text-neutral-500 font-semibold tracking-wider">
                Room PIN
              </div>
              <div className="text-2xl font-mono font-bold text-cyan-300 tracking-widest">
                {localCode}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleNativeShare}
                className="py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

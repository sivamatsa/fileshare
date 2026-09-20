import React, { useState, useEffect, useRef } from 'react';
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

export function extractRoomCode(raw: string): string {
  if (!raw) return '';
  const str = raw.trim();

  // 1. Try URL parsing (e.g. https://.../?room=58291 or #room=58291)
  try {
    const urlStr = str.startsWith('http://') || str.startsWith('https://')
      ? str
      : `https://dummy.app/${str.startsWith('?') ? str : '?' + str}`;
    const url = new URL(urlStr);
    const roomParam = url.searchParams.get('room');
    if (roomParam) return roomParam.trim().toUpperCase().slice(0, 24);
    if (url.hash) {
      const hashParams = new URLSearchParams(url.hash.replace(/^#\/?/, ''));
      const hashRoom = hashParams.get('room');
      if (hashRoom) return hashRoom.trim().toUpperCase().slice(0, 24);
    }
  } catch {
    // Ignore URL parse failure
  }

  // 2. Match keywords like "room=58291", "PIN: 58291", "code: 58291"
  const matchKeyword = str.match(/(?:room|pin|code)[\s:=]+([a-zA-Z0-9_-]{3,24})/i);
  if (matchKeyword && matchKeyword[1]) {
    return matchKeyword[1].toUpperCase();
  }

  // 3. Match 5 consecutive alphanumeric characters / digits
  const matchFive = str.match(/\b([A-Z0-9]{5})\b/i);
  if (matchFive && matchFive[1]) {
    return matchFive[1].toUpperCase();
  }

  // 4. Strip whitespace and non-alphanumeric characters
  const sanitized = str.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  return sanitized.slice(0, 24);
}

function copyFallback(text: string): boolean {
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(el);
    return successful;
  } catch {
    return false;
  }
}

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
  const remoteInputRef = useRef<HTMLInputElement>(null);
  const [pasteStatus, setPasteStatus] = useState<'idle' | 'pasted' | 'manual'>('idle');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'both' | 'my-code' | 'enter-code'>('both');
  const [isScanning, setIsScanning] = useState(false);
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
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(localCode);
      } else {
        copyFallback(localCode);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      copyFallback(localCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        copyFallback(inviteUrl);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      copyFallback(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleManualScan = () => {
    setIsScanning(true);
    onRegenerateLocalCode();
    setTimeout(() => setIsScanning(false), 1200);
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
    // 1. Attempt reading directly via Clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const parsed = extractRoomCode(text);
          if (parsed) {
            setRemoteCode(parsed);
            setPasteStatus('pasted');
            setTimeout(() => setPasteStatus('idle'), 2200);
            return;
          }
        }
      } catch (err) {
        // Browser or iframe permissions policy blocked clipboard read
        console.debug('Clipboard readText restricted:', err);
      }
    }

    // 2. Fallback: Prompt user if prompt API is available in browser
    try {
      if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
        const manual = window.prompt('Paste your 5-digit PIN or invite link here:');
        if (manual) {
          const parsed = extractRoomCode(manual);
          if (parsed) {
            setRemoteCode(parsed);
            setPasteStatus('pasted');
            setTimeout(() => setPasteStatus('idle'), 2200);
            return;
          }
        }
      }
    } catch {
      // prompt blocked
    }

    // 3. Fallback: Focus & select the input field for immediate Ctrl+V / Cmd+V
    if (remoteInputRef.current) {
      remoteInputRef.current.focus();
      remoteInputRef.current.select();
    }
    setPasteStatus('manual');
    setTimeout(() => setPasteStatus('idle'), 4000);
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
          Connect your phone, laptop, or tablet in 1 click on the same Wi-Fi, or share a 5-digit PIN to transfer files directly.
        </p>

        {/* View Mode Switcher to eliminate confusion between Input Code vs Device Code */}
        <div className="inline-flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-xl mt-5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'both'
                ? 'bg-neutral-800 text-neutral-100 font-bold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            All Pairing Options
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-code')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'my-code'
                ? 'bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 font-bold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
            <span>Copy My Code</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enter-code')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'enter-code'
                ? 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-bold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
            <span>Enter Other Code</span>
          </button>
        </div>
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
                  No Code Needed
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Connect instantly without typing a code when devices are on the same local network
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            <button
              type="button"
              onClick={handleManualScan}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-medium transition cursor-pointer"
              title="Rescan local network for peers"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-emerald-400' : 'text-neutral-400'}`} />
              <span>{isScanning ? 'Scanning...' : 'Rescan'}</span>
            </button>
            <div className="text-xs text-neutral-500 font-mono flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Radar active</span>
            </div>
          </div>
        </div>

        {/* Nearby Devices List */}
        <div className="mt-4">
          {nearbyDevices.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {nearbyDevices.map((d) => (
                <div
                  key={d.peerId}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-950/70 border border-emerald-600/40 hover:border-emerald-500 transition group"
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
                        <span className="text-emerald-400 font-medium">Ready on Wi-Fi</span>
                        <span>•</span>
                        <span>{d.device.browser}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onConnectNearby(d)}
                    disabled={isConnecting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-neutral-950 font-bold text-xs transition shadow-md shadow-emerald-950/40 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>1-Click Connect</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 px-4 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400 bg-neutral-950/40 rounded-xl border border-dashed border-neutral-800/80">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>
                  No second device detected on this Wi-Fi network yet. Open this URL on your phone or laptop to connect with 1 click!
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition cursor-pointer"
                >
                  {copiedLink ? 'Link Copied!' : 'Copy Site URL'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition cursor-pointer flex items-center gap-1"
                >
                  <QrCode className="w-3 h-3 text-cyan-400" />
                  <span>Show QR</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Distinct Separation: "This Device Code (Share)" vs "Enter Other Device Code (Connect)" */}
      <div
        className={`grid gap-6 ${
          activeTab === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-lg mx-auto'
        }`}
      >
        {/* CARD 1: THIS DEVICE CODE (SHARE / COPY) */}
        {(activeTab === 'both' || activeTab === 'my-code') && (
          <div className="bg-neutral-900/95 border-2 border-cyan-500/30 hover:border-cyan-500/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
            {/* Header Tag */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-950/70 border border-cyan-700/60 text-cyan-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-cyan-300">
                      This Device's Code
                    </h2>
                    <span className="text-[10px] text-neutral-400 font-medium">To share with peer</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-800/80 text-cyan-300 text-[10px] font-bold">
                  COPY THIS
                </span>
              </div>

              <p className="text-xs text-neutral-300 mb-4 leading-relaxed">
                Copy or share this 5-digit PIN to type it into your other device:
              </p>

              {/* Big 5-digit PIN Display */}
              <div className="bg-neutral-950 border border-cyan-500/50 rounded-xl p-4 mb-4 text-center relative group shadow-inner">
                <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-1">
                  Your Current Device PIN
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-cyan-300 tracking-[0.25em] select-all">
                  {localCode}
                </div>
                <div className="mt-1 text-[11px] text-neutral-400 font-mono">
                  {nickname || localDevice.name} ({localDevice.os})
                </div>
              </div>

              {/* Action Buttons: Copy Code, Copy Link, Show QR */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  type="button"
                  id="btn-copy-device-code"
                  onClick={handleCopyCode}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-700/70 text-cyan-200 text-xs font-bold transition cursor-pointer"
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
                <span>New PIN</span>
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
        )}

        {/* CARD 2: ENTER REMOTE DEVICE'S CODE (INPUT / CONNECT) */}
        {(activeTab === 'both' || activeTab === 'enter-code') && (
          <div className="bg-neutral-900/95 border-2 border-emerald-500/30 hover:border-emerald-500/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <form onSubmit={handleRemoteSubmit} className="flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-400">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-300">
                        Enter Other Device's Code
                      </h2>
                      <span className="text-[10px] text-neutral-400 font-medium">Type peer's PIN to connect</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800/80 text-emerald-300 text-[10px] font-bold">
                    ENTER HERE
                  </span>
                </div>

                <p className="text-xs text-neutral-300 mb-4 leading-relaxed">
                  Enter the 5-digit PIN shown on the other device screen:
                </p>

                {/* Input field with Paste button */}
                <div className="mb-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        ref={remoteInputRef}
                        id="remote-code-input"
                        type="text"
                        value={remoteCode}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.includes('http') || val.includes('?') || val.includes('room=')) {
                            setRemoteCode(extractRoomCode(val));
                          } else {
                            setRemoteCode(val.toUpperCase().slice(0, 24));
                          }
                        }}
                        onPaste={(e) => {
                          const pastedData = e.clipboardData?.getData('text');
                          if (pastedData) {
                            e.preventDefault();
                            const parsed = extractRoomCode(pastedData);
                            if (parsed) {
                              setRemoteCode(parsed);
                              setPasteStatus('pasted');
                              setTimeout(() => setPasteStatus('idle'), 2200);
                            }
                          }
                        }}
                        placeholder="e.g. 58291"
                        maxLength={256}
                        className="w-full px-4 py-3.5 bg-neutral-950 border border-emerald-600/40 rounded-xl text-neutral-100 placeholder-neutral-600 font-mono text-xl sm:text-2xl font-bold tracking-[0.2em] focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition text-center shadow-inner"
                        required
                      />
                    </div>

                    <button
                      type="button"
                      id="btn-paste-remote-code"
                      onClick={handlePasteRemoteCode}
                      className={`px-4 py-3.5 rounded-xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0 ${
                        pasteStatus === 'pasted'
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                          : pasteStatus === 'manual'
                          ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                          : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300 hover:text-neutral-100'
                      }`}
                      title={pasteStatus === 'manual' ? 'Press Ctrl+V (or Cmd+V) to paste' : 'Paste PIN or invite link from clipboard'}
                    >
                      {pasteStatus === 'pasted' ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300 font-bold">Pasted!</span>
                        </>
                      ) : pasteStatus === 'manual' ? (
                        <>
                          <ClipboardPaste className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-300 font-semibold">Press Ctrl+V</span>
                        </>
                      ) : (
                        <>
                          <ClipboardPaste className="w-4 h-4 text-emerald-400" />
                          <span className="hidden sm:inline">Paste</span>
                        </>
                      )}
                    </button>
                  </div>
                  {pasteStatus === 'manual' ? (
                    <p className="mt-2 text-[11px] text-amber-400 font-medium">
                      Browser blocked direct clipboard access. Input is selected — press <strong>Ctrl+V</strong> (or <strong>Cmd+V</strong>) to paste!
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] text-neutral-400">
                      Pasting an invite link automatically extracts the 5-digit code.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-800/80">
                <button
                  type="submit"
                  id="btn-connect-remote"
                  disabled={isConnecting || !remoteCode.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-neutral-950 font-bold text-sm sm:text-base transition shadow-lg shadow-emerald-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
        )}
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

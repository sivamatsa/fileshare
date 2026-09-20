import React, { useState } from 'react';
import { X, Settings as SettingsIcon, Sliders, Shield, Volume2, HardDrive, Smartphone, Laptop } from 'lucide-react';
import { TransferSettings, IceMode } from '../types';
import { getDeviceNickname, saveDeviceNickname, detectLocalDevice } from '../utils/device';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TransferSettings;
  onSave: (newSettings: Partial<TransferSettings>, newDeviceName?: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  if (!isOpen) return null;

  const initialDeviceInfo = detectLocalDevice();
  const [deviceName, setDeviceName] = useState(getDeviceNickname());
  const [chunkSize, setChunkSize] = useState(settings.chunkSize);
  const [iceMode, setIceMode] = useState<IceMode>(settings.iceMode);
  const [customStunUrl, setCustomStunUrl] = useState(settings.customStunUrl || '');
  const [customSignalingUrl, setCustomSignalingUrl] = useState(settings.customSignalingUrl || '');
  const [autoAccept, setAutoAccept] = useState(settings.autoAcceptTransfers);
  const [soundAlerts, setSoundAlerts] = useState(settings.enableSoundAlerts);
  const [wakeLock, setWakeLock] = useState(settings.enableWakeLock ?? true);
  const [vibration, setVibration] = useState(settings.enableVibration ?? true);
  const [autoDownload, setAutoDownload] = useState(settings.autoDownload ?? true);
  const [localDiscovery, setLocalDiscovery] = useState(settings.enableLocalDiscovery ?? true);

  const handleSave = () => {
    const trimmedName = deviceName.trim();
    if (trimmedName) {
      saveDeviceNickname(trimmedName);
    }
    onSave(
      {
        chunkSize,
        iceMode,
        customStunUrl,
        customSignalingUrl: customSignalingUrl.trim() || undefined,
        autoAcceptTransfers: autoAccept,
        enableSoundAlerts: soundAlerts,
        enableWakeLock: wakeLock,
        enableVibration: vibration,
        autoDownload,
        enableLocalDiscovery: localDiscovery,
      },
      trimmedName || undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-neutral-800 border border-neutral-700/70 text-cyan-400">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100">Transfer Settings</h3>
              <p className="text-xs text-neutral-400">Network traversal & chunking parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Friendly Device Name */}
          <div>
            <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-2">
              <span className="flex items-center gap-1.5">
                {initialDeviceInfo.type === 'mobile' ? (
                  <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>This Device's Name</span>
              </span>
              <span className="text-[11px] text-neutral-400 font-mono">
                {initialDeviceInfo.os} • {initialDeviceInfo.browser}
              </span>
            </label>
            <input
              type="text"
              id="input-device-name"
              value={deviceName}
              maxLength={36}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. My Laptop / Office PC"
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              Peers in your room will identify your connection by this friendly name.
            </p>
          </div>

          {/* Chunk Size */}
          <div>
            <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-2">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                <span>WebRTC Chunk Size</span>
              </span>
              <span className="font-mono text-cyan-400 font-bold">{chunkSize / 1024} KB</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[64, 128, 256, 512].map((kb) => {
                const bytes = kb * 1024;
                const isSelected = chunkSize === bytes;
                return (
                  <button
                    key={kb}
                    type="button"
                    onClick={() => setChunkSize(bytes)}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {kb === 256 ? `${kb} KB (Turbo)` : `${kb} KB`}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-500">
              256 KB Turbo delivers maximum throughput on high-speed Wi-Fi & LAN connections with zero artificial delays.
            </p>
          </div>

          {/* ICE Mode */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>NAT Traversal & ICE Mode</span>
            </label>
            <div className="space-y-2">
              <label
                onClick={() => setIceMode('stun')}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  iceMode === 'stun'
                    ? 'bg-emerald-950/20 border-emerald-500/60 text-neutral-100'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                }`}
              >
                <input
                  type="radio"
                  name="iceMode"
                  checked={iceMode === 'stun'}
                  onChange={() => setIceMode('stun')}
                  className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    Standard Direct + STUN (Recommended)
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                    Uses Google STUN to discover external IP for direct cross-network connection. Zero file bytes pass through STUN.
                  </div>
                </div>
              </label>

              <label
                onClick={() => setIceMode('lan-only')}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  iceMode === 'lan-only'
                    ? 'bg-emerald-950/20 border-emerald-500/60 text-neutral-100'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                }`}
              >
                <input
                  type="radio"
                  name="iceMode"
                  checked={iceMode === 'lan-only'}
                  onChange={() => setIceMode('lan-only')}
                  className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    Strict LAN Only / Zero-STUN (Air-Gapped)
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                    Disables all external STUN queries. Pure host ICE candidates only. Requires devices to be on the same LAN or VPN.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Custom STUN URL (optional) */}
          {iceMode === 'stun' && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                Custom STUN Server (Optional)
              </label>
              <input
                type="text"
                value={customStunUrl}
                onChange={(e) => setCustomStunUrl(e.target.value)}
                placeholder="e.g. stun:stun.mycompany.org:3478"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {/* Custom WebSocket Signaling Server (for GitHub Pages / static hosting) */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
              Signaling Server URL (Optional)
            </label>
            <input
              type="text"
              value={customSignalingUrl}
              onChange={(e) => setCustomSignalingUrl(e.target.value)}
              placeholder="e.g. wss://my-signaling.onrender.com or leave blank for auto"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 font-mono focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[10px] text-neutral-400 mt-1">
              Used to route WebRTC handshakes. Required when deploying on static hosts like GitHub Pages.
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t border-neutral-800">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-xs font-semibold text-neutral-200">Auto-Accept Transfers</div>
                <div className="text-[11px] text-neutral-400">
                  Automatically start streaming incoming files without confirmation
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoAccept}
                onChange={(e) => setAutoAccept(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-700 bg-neutral-950 text-cyan-500 focus:ring-cyan-500/20"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-xs font-semibold text-neutral-200">Keep Screen Awake (Wake Lock)</div>
                <div className="text-[11px] text-neutral-400">
                  Prevents screen from sleeping or dimming during active file transfers
                </div>
              </div>
              <input
                type="checkbox"
                checked={wakeLock}
                onChange={(e) => setWakeLock(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-700 bg-neutral-950 text-cyan-500 focus:ring-cyan-500/20"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-xs font-semibold text-neutral-200">Haptic / Vibration Alerts</div>
                <div className="text-[11px] text-neutral-400">
                  Gentle vibration pulse on mobile devices when file transfers finish
                </div>
              </div>
              <input
                type="checkbox"
                checked={vibration}
                onChange={(e) => setVibration(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-700 bg-neutral-950 text-cyan-500 focus:ring-cyan-500/20"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-xs font-semibold text-neutral-200">Auto-Download Files to Disk</div>
                <div className="text-[11px] text-neutral-400">
                  Automatically trigger browser save as soon as incoming chunks complete
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoDownload}
                onChange={(e) => setAutoDownload(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-700 bg-neutral-950 text-cyan-500 focus:ring-cyan-500/20"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-xs font-semibold text-neutral-200">Same Wi-Fi Local Discovery</div>
                <div className="text-[11px] text-neutral-400">
                  Broadcast this device to nearby devices on same network for 1-click pairing
                </div>
              </div>
              <input
                type="checkbox"
                checked={localDiscovery}
                onChange={(e) => setLocalDiscovery(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-700 bg-neutral-950 text-cyan-500 focus:ring-cyan-500/20"
              />
            </label>

            <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/80 text-[11px] text-neutral-400 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-neutral-200">Privacy & Auto-Expiring History:</span>
                <p className="mt-0.5 text-neutral-400">
                  Transfers stream purely peer-to-peer with zero server storage. Transfer history logs automatically expire and delete after 30 minutes or whenever your session closes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950/60 border-t border-neutral-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

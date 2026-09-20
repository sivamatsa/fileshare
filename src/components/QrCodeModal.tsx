import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, QrCode as QrIcon, Smartphone, ExternalLink } from 'lucide-react';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ isOpen, onClose, roomCode }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
    roomCode
  )}`;

  useEffect(() => {
    if (!isOpen || !roomCode) return;

    QRCode.toDataURL(inviteUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0a0a0a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [isOpen, roomCode, inviteUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrIcon className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-neutral-100">Pair Device via QR</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center">
          <div className="bg-white p-3 rounded-2xl shadow-inner mb-4 flex items-center justify-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Pairing QR Code" className="w-56 h-56 rounded-lg" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-neutral-400 text-xs">
                Generating QR code...
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-medium mb-1">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>Scan with phone camera or 2nd computer</span>
          </div>
          <p className="text-[11px] text-neutral-500 max-w-[260px]">
            Instantly connects to room <strong className="font-mono text-cyan-300">{roomCode}</strong> for high-speed file exchange.
          </p>

          {/* Link copy */}
          <div className="w-full mt-4 flex items-center gap-2 bg-neutral-950 p-2 rounded-xl border border-neutral-800">
            <span className="text-[11px] font-mono text-neutral-400 truncate flex-1 pl-1">
              {inviteUrl}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-neutral-950/60 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

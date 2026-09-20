import React, { useEffect, useState } from 'react';
import { UploadCloud, FolderUp, Zap } from 'lucide-react';
import { scanDroppedItems } from '../utils/folderScanner';

interface FullscreenDropOverlayProps {
  onFilesScanned: (items: Array<{ file: File; relativePath?: string }>) => void;
  disabled?: boolean;
}

export const FullscreenDropOverlay: React.FC<FullscreenDropOverlayProps> = ({
  onFilesScanned,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (disabled) return;

    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.types && e.dataTransfer.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);

      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        const scanned = await scanDroppedItems(e.dataTransfer.items);
        if (scanned.length > 0) {
          onFilesScanned(scanned);
        }
      } else if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const items = Array.from(e.dataTransfer.files).map((file) => ({
          file,
          relativePath: (file as any).webkitRelativePath || file.name,
        }));
        onFilesScanned(items);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [disabled, onFilesScanned]);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-neutral-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-2xl border-2 border-dashed border-cyan-400 bg-neutral-900/90 rounded-3xl p-12 text-center shadow-2xl shadow-cyan-950/60 flex flex-col items-center justify-center scale-100 animate-in zoom-in-95 duration-150">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shadow-inner">
            <UploadCloud className="w-12 h-12 animate-bounce" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-emerald-500 text-neutral-950 shadow-md">
            <FolderUp className="w-4 h-4" />
          </div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
          Drop Files or Folders Anywhere
        </h2>

        <p className="mt-2 text-sm text-neutral-300 max-w-md mx-auto">
          Release your files or folders to queue them for direct peer-to-peer transmission.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-400">
          <span className="flex items-center gap-1 bg-neutral-950 px-3 py-1.5 rounded-full border border-neutral-800">
            <FolderUp className="w-3.5 h-3.5 text-cyan-400" /> Preserves Folder Trees
          </span>
          <span className="flex items-center gap-1 bg-neutral-950 px-3 py-1.5 rounded-full border border-neutral-800">
            <Zap className="w-3.5 h-3.5 text-emerald-400" /> Direct Streaming
          </span>
        </div>
      </div>
    </div>
  );
};

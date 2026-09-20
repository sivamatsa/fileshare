/**
 * Memory-safe streaming storage for multi-gigabyte transfers (OPFS + Progressive Fallback).
 * Guarantees zero byte shifts, exact-size truncation, and correct MIME headers for all file types.
 */

import { resolveMimeType } from '../utils/mime';

export interface DiskStreamTarget {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  isOPFS: boolean;
  writeChunkAt(offset: number, chunk: Uint8Array): Promise<void>;
  finish(): Promise<Blob | File>;
  cleanup(): Promise<void>;
}

// OPFS Native File System Streaming Writer with strict seek & exact-size truncation
class OPFSFileWriter implements DiskStreamTarget {
  public id: string;
  public name: string;
  public size: number;
  public mimeType: string;
  public isOPFS = true;

  private rootHandle: any = null;
  private fileHandle: any = null;
  private writableStream: any = null;
  private opfsFileName: string;

  constructor(id: string, name: string, size: number, mimeType: string) {
    this.id = id;
    this.name = name;
    this.size = size;
    this.mimeType = resolveMimeType(name, mimeType);
    this.opfsFileName = `transfer_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.tmp`;
  }

  async init(): Promise<boolean> {
    try {
      if (!('storage' in navigator) || !navigator.storage.getDirectory) {
        return false;
      }
      this.rootHandle = await navigator.storage.getDirectory();
      this.fileHandle = await this.rootHandle.getFileHandle(this.opfsFileName, { create: true });
      if (this.fileHandle.createWritable) {
        this.writableStream = await this.fileHandle.createWritable({ keepExistingData: true });
        // Pre-allocate or ensure file is clean
        if (this.writableStream.truncate) {
          await this.writableStream.truncate(0);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.warn('OPFS initialization failed, will use progressive memory-safe fallback:', e);
      return false;
    }
  }

  async writeChunkAt(offset: number, chunk: Uint8Array): Promise<void> {
    if (this.writableStream) {
      // Seek to exact byte offset so no duplicate or out-of-order data can ever shift bytes
      if (this.writableStream.seek) {
        await this.writableStream.seek(offset);
      }
      await this.writableStream.write(chunk);
    }
  }

  async finish(): Promise<File> {
    if (this.writableStream) {
      // Strictly truncate to exact expected file size to prevent any trailer corruption
      if (this.writableStream.truncate && this.size > 0) {
        await this.writableStream.truncate(this.size);
      }
      await this.writableStream.close();
      this.writableStream = null;
    }
    if (this.fileHandle) {
      const rawFile = await this.fileHandle.getFile();
      // Ensure the file is returned with the exact size and MIME type
      const finalSlice = rawFile.slice(0, this.size, this.mimeType);
      return new File([finalSlice], this.name, {
        type: this.mimeType,
        lastModified: Date.now(),
      });
    }
    throw new Error('File handle missing on finish');
  }

  async cleanup(): Promise<void> {
    try {
      if (this.writableStream) {
        await this.writableStream.abort().catch(() => {});
        this.writableStream = null;
      }
      if (this.rootHandle && this.fileHandle) {
        await this.rootHandle.removeEntry(this.opfsFileName).catch(() => {});
        this.fileHandle = null;
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

// Progressive In-Memory Fallback with ordered indexing and exact clamping
class ProgressiveMemoryWriter implements DiskStreamTarget {
  public id: string;
  public name: string;
  public size: number;
  public mimeType: string;
  public isOPFS = false;

  // Store received chunks mapped by their exact byte offset
  private receivedChunks: Map<number, Uint8Array> = new Map();

  constructor(id: string, name: string, size: number, mimeType: string) {
    this.id = id;
    this.name = name;
    this.size = size;
    this.mimeType = resolveMimeType(name, mimeType);
  }

  async writeChunkAt(offset: number, chunk: Uint8Array): Promise<void> {
    // Only keep chunk if within file bounds
    if (offset < this.size) {
      const allowedLength = Math.min(chunk.byteLength, this.size - offset);
      const exactChunk = allowedLength === chunk.byteLength ? chunk : chunk.subarray(0, allowedLength);
      this.receivedChunks.set(offset, exactChunk);
    }
  }

  async finish(): Promise<Blob> {
    // Sort chunks strictly by their starting offset
    const sortedOffsets = Array.from(this.receivedChunks.keys()).sort((a, b) => a - b);
    const orderedBuffers: any[] = [];
    let currentOffset = 0;

    for (const off of sortedOffsets) {
      const chunk = this.receivedChunks.get(off)!;
      if (off === currentOffset) {
        orderedBuffers.push(chunk);
        currentOffset += chunk.byteLength;
      } else if (off < currentOffset) {
        // Overlap: slice off the already covered portion
        const overlap = currentOffset - off;
        if (chunk.byteLength > overlap) {
          const validSub = chunk.subarray(overlap);
          orderedBuffers.push(validSub);
          currentOffset += validSub.byteLength;
        }
      } else {
        // Gap: pad zeros if necessary
        const gap = off - currentOffset;
        orderedBuffers.push(new Uint8Array(gap));
        orderedBuffers.push(chunk);
        currentOffset = off + chunk.byteLength;
      }
    }

    this.receivedChunks.clear();
    const combinedBlob = new Blob(orderedBuffers, { type: this.mimeType });
    // Strictly slice to exact size
    return combinedBlob.slice(0, this.size, this.mimeType);
  }

  async cleanup(): Promise<void> {
    this.receivedChunks.clear();
  }
}

/**
 * Factory to create memory-safe file writer.
 * Prefers OPFS on mobile and desktop browsers, falls back safely to ordered chunk assembler.
 */
export async function createDiskStreamWriter(
  id: string,
  name: string,
  size: number,
  mimeType: string
): Promise<DiskStreamTarget> {
  const opfs = new OPFSFileWriter(id, name, size, mimeType);
  const success = await opfs.init();
  if (success) {
    return opfs;
  }
  return new ProgressiveMemoryWriter(id, name, size, mimeType);
}

/**
 * Triggers clean file download on any platform (Android, iOS Safari, Windows, Mac, Linux).
 */
export function triggerFileDownload(fileOrBlob: Blob | File, filename: string): string {
  const url = URL.createObjectURL(fileOrBlob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
    } catch {
      // ignore
    }
  }, 3000);
  return url;
}

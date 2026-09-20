/**
 * Robust MIME-type resolver and extension detection for all common file types:
 * Videos (MP4, MKV, WebM, MOV, AVI), Audios (MP3, WAV, FLAC, AAC),
 * Documents (PDF, DOCX, XLSX, PPTX, TXT, CSV), Archives (ZIP, TAR, GZ, 7Z, RAR),
 * Images, and arbitrary binaries.
 */

const EXTENSION_TO_MIME: Record<string, string> = {
  // Videos
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  ts: 'video/mp2t',
  '3gp': 'video/3gpp',

  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',

  // Documents
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',

  // Archives
  zip: 'application/zip',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar',
  dmg: 'application/x-apple-diskimage',
  iso: 'application/x-iso9660-image',
  apk: 'application/vnd.android.package-archive',

  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

export function resolveMimeType(fileName: string, providedType?: string): string {
  if (providedType && providedType !== 'application/octet-stream' && providedType.trim().length > 0) {
    return providedType;
  }
  const dotIdx = fileName.lastIndexOf('.');
  if (dotIdx !== -1) {
    const ext = fileName.slice(dotIdx + 1).toLowerCase();
    if (EXTENSION_TO_MIME[ext]) {
      return EXTENSION_TO_MIME[ext];
    }
  }
  return 'application/octet-stream';
}

export function getFileTypeLabel(fileName: string, mimeType?: string): string {
  const dotIdx = fileName.lastIndexOf('.');
  const ext = dotIdx !== -1 ? fileName.slice(dotIdx + 1).toUpperCase() : '';
  const resolved = resolveMimeType(fileName, mimeType);

  if (resolved.startsWith('video/')) return `${ext || 'Video'} Video`;
  if (resolved.startsWith('audio/')) return `${ext || 'Audio'} Audio`;
  if (resolved.startsWith('image/')) return `${ext || 'Image'} Image`;
  if (resolved === 'application/pdf') return 'PDF Document';
  if (ext === 'ZIP' || ext === '7Z' || ext === 'TAR' || ext === 'GZ' || ext === 'RAR') return `${ext} Archive`;
  if (ext === 'DOC' || ext === 'DOCX') return 'Word Document';
  if (ext === 'XLS' || ext === 'XLSX') return 'Excel Spreadsheet';
  if (ext === 'PPT' || ext === 'PPTX') return 'PowerPoint';
  if (ext === 'APK') return 'Android App (APK)';
  if (ext === 'ISO' || ext === 'DMG') return 'Disk Image';
  if (resolved.startsWith('text/') || ext === 'TXT' || ext === 'MD') return 'Text Document';
  return ext ? `${ext} File` : 'Binary File';
}

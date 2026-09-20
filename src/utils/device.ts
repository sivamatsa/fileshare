import { DeviceInfo } from '../types';

export function detectLocalDevice(): DeviceInfo {
  const ua = navigator.userAgent || '';
  let os = 'Unknown OS';
  let type: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  let browser = 'Browser';

  // Detect OS & Type
  if (/iPad|Tablet|(android(?!.*mobile))/i.test(ua)) {
    type = 'tablet';
    os = /iPad/i.test(ua) ? 'iPadOS' : 'Android Tablet';
  } else if (/iPhone|iPod/i.test(ua)) {
    type = 'mobile';
    os = 'iOS';
  } else if (/Android/i.test(ua)) {
    type = 'mobile';
    os = 'Android';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    type = 'desktop';
    os = 'macOS';
  } else if (/Windows NT/i.test(ua)) {
    type = 'desktop';
    os = 'Windows';
  } else if (/CrOS/i.test(ua)) {
    type = 'desktop';
    os = 'Chrome OS';
  } else if (/Linux/i.test(ua)) {
    type = 'desktop';
    os = 'Linux';
  }

  // Detect Browser
  if (/Edg\//i.test(ua)) {
    browser = 'Edge';
  } else if (/Chrome\//i.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Firefox';
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    browser = 'Opera';
  }

  // Check saved custom nickname or generate readable default
  const savedName = localStorage.getItem('p2p_device_nickname');
  const defaultName = savedName || `${os} (${browser})`;

  return {
    name: defaultName,
    type,
    os,
    browser,
  };
}

export function saveDeviceNickname(name: string): void {
  if (name.trim()) {
    localStorage.setItem('p2p_device_nickname', name.trim());
  }
}

export function getDeviceNickname(): string {
  return localStorage.getItem('p2p_device_nickname') || '';
}

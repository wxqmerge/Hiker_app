export const getDevicePlatform = () => {
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'windows';
  if (/Android/.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  // iPadOS 13+ reports a Mac user agent; detect via touch points
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  return 'other';
};

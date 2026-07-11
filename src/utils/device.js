export const getDevicePlatform = () => {
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'windows';
  if (/Android|iPhone|iPad|iPod/.test(ua)) return 'mobile';
  return 'other';
};

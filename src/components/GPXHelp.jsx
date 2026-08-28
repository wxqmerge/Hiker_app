import { getDevicePlatform } from '../utils/device';

export default function GPXHelp({ variant = 'light' }) {
  const platform = getDevicePlatform();
  let link = "https://www.gpxsee.org/";

  if (platform === 'android' || platform === 'ios') {
    link = "https://organicmaps.app/";
  }

  const styles = {
    light: {
      button: "border-gray-300 text-gray-600 hover:text-gray-800 bg-gray-100",
      icon: "text-gray-500"
    },
    dark: {
      button: "border-white/40 text-white hover:text-white bg-white/10",
      icon: "text-white"
    }
  };

  const currentStyle = styles[variant] || styles.light;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-1.5 px-3 py-1 border ${currentStyle.button} text-xs font-medium rounded-md transition-colors`}
      aria-label="Get a maps app for GPX files"
    >
      <svg className={`w-3 h-3 ${currentStyle.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.724a1 1 0 001.447.894v10.764a1 1 0 00-1.447.894l-6-3" />
      </svg>
      Get Maps
    </a>
  );
}

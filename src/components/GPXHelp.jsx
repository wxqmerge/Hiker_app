import React from 'react';
import { getDevicePlatform } from '../utils/device';

export default function GPXHelp({ variant = 'light' }) {
  const platform = getDevicePlatform();
  let content = "";
  let link = "";

  if (platform === 'windows') {
    content = "To view GPX files on Windows, we recommend downloading GPXSee.";
    link = "https://www.gpxsee.org/";
  } else if (platform === 'mobile') {
    content = "To view GPX files on your phone, we recommend installing Organic Maps from your app store.";
    link = "https://organicmaps.app/";
  } else {
    content = "We recommend using a GPX viewer like GPXSee or Organic Maps to view trail files.";
    link = "#";
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
    <div className="relative group inline-block">
      <button className={`flex items-center gap-1.5 px-3 py-1 border ${currentStyle.button} text-xs font-medium rounded-md transition-colors`}>
        <svg className={`w-3 h-3 ${currentStyle.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.724a1 1 0 001.447.894v10.764a1 1 0 00-1.447.894l-6-3" />
        </svg>
        Get Maps
      </button>
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-auto">
        <p className="mb-2 leading-relaxed">{content}</p>
        {link !== "#" && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 font-bold underline">
            Visit Website →
          </a>
        )}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 border-8 border-transparent border-b-gray-900">-</div>
      </div>
    </div>
  );
}

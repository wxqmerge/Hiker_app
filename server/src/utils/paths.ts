import path from 'path';
import { getCurrentDir } from './path.js';

const __dirname = getCurrentDir(import.meta.url);
const PROJECT_ROOT = path.join(__dirname, '../../..');

// DATA_DIR is configurable per group via the DATA_DIR env var (a directory name
// relative to the project root). Defaults to 'exported_data' so existing groups
// (sothh, ramblers) are unaffected. A group like TRAVEL sets DATA_DIR=travel_data
// to use its own separate trail/schedule data.
const dataDirName = process.env.DATA_DIR || 'exported_data';
export const DATA_DIR = path.join(PROJECT_ROOT, dataDirName);
export const GPX_DIR = path.join(PROJECT_ROOT, 'GPX');
export const GPX_UPLOAD_DIR = path.join(DATA_DIR, 'gpx');
export const HISTORY_DIR = path.join(DATA_DIR, 'schedule_history');
export const TMP_DIR = path.join(PROJECT_ROOT, 'tmp');

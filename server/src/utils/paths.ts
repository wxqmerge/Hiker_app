import path from 'path';
import { getCurrentDir } from './path.js';

const __dirname = getCurrentDir(import.meta.url);
const PROJECT_ROOT = path.join(__dirname, '../../..');

export const DATA_DIR = path.join(PROJECT_ROOT, 'exported_data');
export const GPX_DIR = path.join(PROJECT_ROOT, 'GPX');
export const GPX_UPLOAD_DIR = path.join(DATA_DIR, 'gpx');
export const HISTORY_DIR = path.join(DATA_DIR, 'schedule_history');
export const TMP_DIR = path.join(PROJECT_ROOT, 'tmp');

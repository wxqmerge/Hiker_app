import dotenv from 'dotenv';
import path from 'path';
import { getCurrentDir } from './path.js';

const __dirname = getCurrentDir(import.meta.url);
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export function validateXlsBuffer(buffer: Buffer) {
  // XLS files start with d0 cf 11 e0 (OLE2 compound document)
  return buffer.length > 4 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;
}

export async function findPythonCmd(): Promise<string> {
  const cmds = ['python', 'python3'];
  for (const cmd of cmds) {
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(cmd, ['--version'], { timeout: 5000, windowsHide: true });
        child.on('close', (code) => code === 0 ? resolve() : reject(new Error()));
        child.on('error', reject);
      });
      return cmd;
    } catch {
      // try next
    }
  }
  throw new Error('Python not found');
}

export function runPythonScript(pythonCmd: string, scriptPath: string, args: string[] = []): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonCmd, [scriptPath, ...args], {
      timeout: 60000,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(Object.assign(new Error(`Python script exited with code ${code}`), { stdout, stderr, code }));
      }
    });

    child.on('error', (error) => {
      reject(Object.assign(error, { stdout, stderr }));
    });
  });
}

export async function processXlsImport(filePath: string, scriptPath: string, trailsPath: string, cleanup = true): Promise<any> {
  const pythonCmd = await findPythonCmd();
  const { stdout, stderr } = await runPythonScript(pythonCmd, scriptPath, [filePath, trailsPath]);

  if (cleanup) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }

  if (stderr) {
    console.warn('[XLS_IMPORT] Python warnings:', stderr);
  }

  let result: any;
  try {
    result = JSON.parse(stdout);
  } catch {
    throw new Error('Failed to parse Python output. Check logs for details.');
  }

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.success || result.matched === 0) {
    throw new Error('No valid hike data found in Excel file');
  }

  return result;
}

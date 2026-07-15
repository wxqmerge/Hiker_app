import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function validateXlsBuffer(buffer: Buffer): boolean {
  return buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
}

export async function runPythonScript(
  pythonCmd: string,
  scriptPath: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(pythonCmd, [scriptPath, ...args], {
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout, stderr };
}

export async function findPythonCmd(): Promise<string> {
  const commands = ['python', 'python3', 'py'];
  for (const cmd of commands) {
    try {
      await execFileAsync(cmd, ['--version']);
      return cmd;
    } catch {
      continue;
    }
  }
  throw new Error('Python not found');
}

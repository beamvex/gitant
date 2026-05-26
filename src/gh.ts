import { execFile } from 'node:child_process';
import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

export function setGhOutputChannel(channel: vscode.OutputChannel): void {
  outputChannel = channel;
}

function append(section: string, text: string): void {
  if (!outputChannel) {
    return;
  }

  const trimmed = text.trimEnd();
  if (!trimmed) {
    return;
  }

  const maxChars = 8000;
  const finalText = trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}\n… (truncated)` : trimmed;

  outputChannel.appendLine(section);
  outputChannel.appendLine(finalText);
}

export type GhResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export async function runGh(args: string[]): Promise<GhResult> {
  outputChannel?.appendLine(`$ gh ${args.join(' ')}`);
  return await new Promise((resolve) => {
    execFile('gh', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const anyErr = error as (NodeJS.ErrnoException & { code?: number }) | null;
      const exitCode = typeof anyErr?.code === 'number' ? anyErr.code : 0;

      outputChannel?.appendLine(`[exit ${exitCode}]`);
      append('[stdout]', stdout ?? '');
      append('[stderr]', stderr ?? '');
      outputChannel?.appendLine('');

      resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode });
    });
  });
}

export async function runGhJson<T>(args: string[]): Promise<T> {
  const res = await runGh(args);
  if (res.exitCode !== 0) {
    const message = (res.stderr || res.stdout || 'Unknown gh error').trim();
    throw new Error(message);
  }

  try {
    return JSON.parse(res.stdout) as T;
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).trim();
    throw new Error(`Failed to parse gh JSON output: ${msg}`);
  }
}

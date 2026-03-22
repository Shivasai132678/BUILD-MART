import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

type AuditTarget = {
  name: 'backend' | 'frontend';
  command: string;
};

type RunDependencyAuditOptions = {
  execCommand?: (command: string) => Promise<void>;
  maxAttempts?: number;
  sleepMs?: number;
  targets?: AuditTarget[];
};

const DEFAULT_TARGETS: AuditTarget[] = [
  {
    name: 'backend',
    command: 'pnpm audit --prod --audit-level=moderate',
  },
  {
    name: 'frontend',
    command: 'pnpm --dir ../frontend audit --prod --audit-level=moderate',
  },
];

const execAsync = promisify(execCallback);

async function defaultExecCommand(command: string): Promise<void> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stdout) {
      process.stdout.write(stdout);
    }
    if (stderr) {
      process.stderr.write(stderr);
    }
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
    };

    if (execError.stdout) {
      process.stdout.write(execError.stdout);
    }
    if (execError.stderr) {
      process.stderr.write(execError.stderr);
    }

    throw error;
  }
}

function isTransientAuditError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const transientPatterns = [
    'enotfound',
    'econnreset',
    'etimedout',
    'eai_again',
    'socket hang up',
    'registry',
    'network',
    'fetch failed',
    '503',
  ];

  return transientPatterns.some((pattern) => message.includes(pattern));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runWithRetry(
  target: AuditTarget,
  execCommand: (command: string) => Promise<void>,
  maxAttempts: number,
  sleepMs: number,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await execCommand(target.command);
      return;
    } catch (error: unknown) {
      const transient = isTransientAuditError(error);
      const canRetry = transient && attempt < maxAttempts;

      if (canRetry) {
        await sleep(sleepMs * attempt);
        continue;
      }

      if (transient) {
        throw new Error(
          `Dependency audit failed after ${maxAttempts} attempts for ${target.name}`,
          { cause: error instanceof Error ? error : undefined },
        );
      }

      throw new Error(`Dependency audit failed for ${target.name}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}

export async function runDependencyAudit(
  options: RunDependencyAuditOptions = {},
): Promise<void> {
  const execCommand = options.execCommand ?? defaultExecCommand;
  const maxAttempts = options.maxAttempts ?? 3;
  const sleepMs = options.sleepMs ?? 1000;
  const targets = options.targets ?? DEFAULT_TARGETS;

  for (const target of targets) {
    await runWithRetry(target, execCommand, maxAttempts, sleepMs);
  }
}

if (require.main === module) {
  runDependencyAudit().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Dependency audit failed';
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}

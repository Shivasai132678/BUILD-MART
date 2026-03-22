import { runDependencyAudit } from './dependency-audit';

describe('runDependencyAudit', () => {
  const execCommand = jest.fn<Promise<void>, [string]>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retries on transient network errors and succeeds on later attempt', async () => {
    execCommand
      .mockRejectedValueOnce(
        new Error('getaddrinfo ENOTFOUND registry.npmjs.org'),
      )
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce(undefined);

    await expect(
      runDependencyAudit({
        execCommand,
        maxAttempts: 3,
        sleepMs: 0,
      }),
    ).resolves.toBeUndefined();

    expect(execCommand).toHaveBeenCalledTimes(4);
  });

  it('fails closed after max retries on persistent registry errors', async () => {
    execCommand.mockRejectedValue(new Error('ECONNRESET')); // always transient

    await expect(
      runDependencyAudit({
        execCommand,
        maxAttempts: 2,
        sleepMs: 0,
      }),
    ).rejects.toThrow('Dependency audit failed after 2 attempts for backend');

    expect(execCommand).toHaveBeenCalledTimes(2);
  });

  it('fails immediately on vulnerability findings (non-network failure)', async () => {
    execCommand.mockRejectedValue(
      new Error('found 2 vulnerabilities (1 high, 1 critical)'),
    );

    await expect(
      runDependencyAudit({
        execCommand,
        maxAttempts: 3,
        sleepMs: 0,
      }),
    ).rejects.toThrow('Dependency audit failed for backend');

    expect(execCommand).toHaveBeenCalledTimes(1);
  });

  it('audits both backend and frontend and fails if either fails', async () => {
    execCommand
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('found 1 high severity vulnerability'));

    await expect(
      runDependencyAudit({
        execCommand,
        maxAttempts: 2,
        sleepMs: 0,
      }),
    ).rejects.toThrow('Dependency audit failed for frontend');

    expect(execCommand).toHaveBeenCalledTimes(2);
    expect(execCommand).toHaveBeenNthCalledWith(
      1,
      'pnpm audit --prod --audit-level=moderate',
    );
    expect(execCommand).toHaveBeenNthCalledWith(
      2,
      'pnpm --dir ../frontend audit --prod --audit-level=moderate',
    );
  });
});

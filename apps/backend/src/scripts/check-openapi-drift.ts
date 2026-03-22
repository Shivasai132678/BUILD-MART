import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { generateOpenApiSpec } from './generate-openapi';

const TRACKED_OPENAPI_PATH = path.resolve(process.cwd(), 'docs', 'openapi.json');

export async function checkOpenApiDrift(): Promise<void> {
  if (!existsSync(TRACKED_OPENAPI_PATH)) {
    throw new Error('docs/openapi.json is missing. Run pnpm docs:openapi to generate it.');
  }

  const tracked = readFileSync(TRACKED_OPENAPI_PATH, 'utf8');
  const generatedPath = await generateOpenApiSpec();
  const regenerated = readFileSync(generatedPath, 'utf8');

  if (tracked !== regenerated) {
    throw new Error(
      'OpenAPI drift detected. Run pnpm docs:openapi and commit docs/openapi.json.',
    );
  }
}

if (require.main === module) {
  checkOpenApiDrift().catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : 'OpenAPI drift check failed';
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}

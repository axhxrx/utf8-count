import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { expect } from '@std/expect';

/*
 Cross-runtime parity test for bin/count.ts. Runs the script under bun, node, and deno against this very file as the input, and asserts all three produce byte-identical output after normalizing out the chunk-count + elapsed-time line (which legitimately varies per runtime's stream chunking).

 Corpus phrases seeded below so each pattern has a non-zero count:

   日本語 ∂ø∂o ∆   日本語 ∂ø∂o ∆   日本語 ∂ø∂o ∆
   🔥café🎌      🔥café🎌      🔥café🎌
 */

const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(here, '..', 'bin', 'count.ts');
const targetFile = fileURLToPath(import.meta.url);

const patterns = ['日本語 ∂ø∂o ∆', '🔥café🎌', '\n'] as const;

type Runtime = 'bun' | 'node' | 'deno';

function runWith(runtime: Runtime): { stdout: string } | 'missing'
{
  const args = runtime === 'deno'
    ? ['run', '-A', scriptPath, targetFile, ...patterns]
    : [scriptPath, targetFile, ...patterns];
  const result = spawnSync(runtime, args, { encoding: 'utf-8' });
  if (result.error !== undefined && 'code' in result.error && result.error.code === 'ENOENT')
  {
    return 'missing';
  }
  if (result.status !== 0)
  {
    throw new Error(`${runtime} exited ${result.status ?? '?'}: ${result.stderr}`);
  }
  return { stdout: result.stdout };
}

/**
 Collapse the line segment that includes elapsed ms and chunk count, both of which can differ across runtimes.
 */
function normalize(output: string): string
{
  return output.replace(/in [\d,]+ chunks? \([\d,.]+ ms, /, 'in <chunks> (<time>, ');
}

describe('bin/count.ts cross-runtime parity', () =>
{
  const runtimes: readonly Runtime[] = ['bun', 'node', 'deno'];
  const outputs = new Map<Runtime, string>();
  const missing: Runtime[] = [];

  for (const runtime of runtimes)
  {
    const result = runWith(runtime);
    if (result === 'missing')
    {
      missing.push(runtime);
    }
    else
    {
      outputs.set(runtime, result.stdout);
    }
  }

  test('bun, node, and deno are all installed', () =>
  {
    expect(missing).toEqual([]);
  });

  test('bun, node, and deno produce identical output (modulo chunk size + timing)', () =>
  {
    const entries = [...outputs.entries()];
    expect(entries.length).toBeGreaterThanOrEqual(2);

    const normalized = entries.map(([runtime, stdout]) => ({ runtime, text: normalize(stdout) }));
    const reference = normalized[0];
    if (reference === undefined)
    {
      throw new Error('no runtime outputs to compare');
    }
    for (const { runtime, text } of normalized.slice(1))
    {
      if (text !== reference.text)
      {
        throw new Error(
          `${runtime} diverges from ${reference.runtime}:\n`
            + `--- ${reference.runtime}\n${reference.text}\n`
            + `+++ ${runtime}\n${text}`,
        );
      }
    }
  });

  test('every pattern appears at least once', () =>
  {
    const sampleEntry = [...outputs.values()][0];
    if (sampleEntry === undefined)
    {
      throw new Error('no runtime outputs available for sanity check');
    }
    const lines = sampleEntry.split('\n');
    for (const pattern of patterns)
    {
      const display = JSON.stringify(pattern);
      const line = lines.find((l) => l.trimStart().startsWith(display));
      expect(line).toBeDefined();
      const match = (line ?? '').match(/(\d[\d,]*)\s*$/);
      expect(match).not.toBeNull();
      const count = Number((match?.[1] ?? '0').replace(/,/g, ''));
      expect(count).toBeGreaterThan(0);
    }
  });
});

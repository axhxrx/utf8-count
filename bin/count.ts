#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { OccurrenceCounter } from '../src/index.ts';

export function printUsage(): void
{
  console.error('Usage: count.ts [--ignore-case] <file> <pattern> [<pattern>...]');
  console.error('       <input> | count.ts [--ignore-case] - <pattern> [<pattern>...]');
}

export async function main(): Promise<void>
{
  const argv = process.argv.slice(2);
  let caseSensitive = true;

  while (argv.length > 0)
  {
    const head = argv[0];
    if (head === undefined || !head.startsWith('-') || head === '-')
    {
      break;
    }
    argv.shift();
    if (head === '--ignore-case' || head === '-i')
    {
      caseSensitive = false;
    }
    else if (head === '--help' || head === '-h')
    {
      printUsage();
      process.exit(0);
    }
    else
    {
      console.error(`Unknown flag: ${head}`);
      printUsage();
      process.exit(1);
    }
  }

  const source = argv.shift();
  const patterns = argv;
  if (source === undefined || patterns.length === 0)
  {
    printUsage();
    process.exit(1);
  }

  const counter = new OccurrenceCounter(patterns, { caseSensitive });

  let stream: AsyncIterable<Uint8Array | string>;
  let label = source;

  if (source === '-')
  {
    stream = process.stdin;
    label = '<stdin>';
  }
  else
  {
    try
    {
      await stat(source);
    }
    catch (error: unknown)
    {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      {
        console.error(`File not found: ${source}`);
        process.exit(1);
      }
      throw error;
    }
    stream = createReadStream(source);
  }

  const encoder = new TextEncoder();
  let totalBytes = 0;
  let chunkCount = 0;
  const startMs = performance.now();

  for await (const raw of stream)
  {
    const bytes = typeof raw === 'string' ? encoder.encode(raw) : raw;
    counter.appendBytes(bytes);
    totalBytes += bytes.byteLength;
    chunkCount += 1;
  }
  counter.end();

  const elapsedMs = performance.now() - startMs;
  const longest = patterns.reduce((max, p) => Math.max(max, p.length), 0);

  console.log(
    `${label}: ${totalBytes.toLocaleString()} byte${totalBytes === 1 ? '' : 's'}`
      + ` in ${chunkCount.toLocaleString()} chunk${chunkCount === 1 ? '' : 's'}`
      + ` (${elapsedMs.toFixed(2)} ms, caseSensitive=${caseSensitive})`,
  );
  for (const pattern of patterns)
  {
    const display = JSON.stringify(pattern).padEnd(longest + 2);
    const n = counter.count(pattern);
    console.log(`  ${display}  ${n.toLocaleString()}`);
  }
}

if (import.meta.main)
{
  main().catch((error: unknown) =>
  {
    console.error(error);
    process.exit(1);
  });
}

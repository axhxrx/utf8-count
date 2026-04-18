import { expect } from '@std/expect';
import { describe, test } from 'node:test';

import { Utf8ChunkDecoder } from '../src/utf8ChunkDecoder.ts';

describe('Utf8ChunkDecoder', () =>
{
  test('decodes a single ASCII chunk verbatim', () =>
  {
    const decoder = new Utf8ChunkDecoder();
    const out = decoder.decode(new Uint8Array([0x68, 0x69]));
    expect(out).toBe('hi');
  });

  test('decodes an empty chunk as empty string and does not mutate state', () =>
  {
    const decoder = new Utf8ChunkDecoder();
    expect(decoder.decode(new Uint8Array(0))).toBe('');
    expect(decoder.decode(new Uint8Array([0x61]))).toBe('a');
  });

  test('reassembles a two-byte codepoint split across two chunks', () =>
  {
    const decoder = new Utf8ChunkDecoder();
    // "é" = c3 a9
    const first = decoder.decode(new Uint8Array([0xc3]));
    const second = decoder.decode(new Uint8Array([0xa9]));
    expect(first + second).toBe('é');
  });

  test('reassembles a four-byte codepoint split across two chunks', () =>
  {
    const decoder = new Utf8ChunkDecoder();
    // "🔥" = F0 9F 94 A5
    const first = decoder.decode(new Uint8Array([0xf0, 0x9f]));
    const second = decoder.decode(new Uint8Array([0x94, 0xa5]));
    expect(first + second).toBe('🔥');
  });

  test('replaces invalid byte sequences with U+FFFD', () =>
  {
    const decoder = new Utf8ChunkDecoder();
    // 0xFF is never a valid UTF-8 start byte.
    const out = decoder.decode(new Uint8Array([0xff, 0x41]));
    expect(out).toContain('\uFFFD');
    expect(out).toContain('A');
  });

  test('end() flushes pending partial codepoint and resets decoder', () =>
  {
    const decoder = new Utf8ChunkDecoder();
    // Feed only the first byte of a two-byte codepoint.
    expect(decoder.decode(new Uint8Array([0xc3]))).toBe('');
    const flushed = decoder.end();
    // The pending byte should surface as a replacement character on flush.
    expect(flushed).toBe('\uFFFD');
    // After reset, a new valid ASCII byte decodes cleanly.
    expect(decoder.decode(new Uint8Array([0x41]))).toBe('A');
  });

  test('preserves a leading UTF-8 BOM as U+FEFF', () =>
  {
    const decoder = new Utf8ChunkDecoder();
    // EF BB BF = U+FEFF BOM, then ASCII "hi".
    const out = decoder.decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69]));
    expect(out).toBe('\uFEFFhi');
  });

  test('preserves the BOM again after end() recreates the decoder', () =>
  {
    const decoder = new Utf8ChunkDecoder();
    decoder.decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]));
    decoder.end();
    // After reset, a subsequent BOM must also be preserved, not silently eaten.
    const out = decoder.decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x62]));
    expect(out).toBe('\uFEFFb');
  });
});

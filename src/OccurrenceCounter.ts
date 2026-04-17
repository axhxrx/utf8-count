import { countOccurrences } from './patternMatcher.ts';
import type { OccurrenceCounterOptions } from './types/OccurrenceCounterOptions.ts';
import { Utf8ChunkDecoder } from './utf8ChunkDecoder.ts';

/**
 Bounded pattern occurrence counter over a chunked UTF-8 byte stream or a
 chunked JS string stream.

 Usage:

 ```ts
 const counter = new OccurrenceCounter(['foo', 'bar'])
 counter.appendString('fo')
 counter.appendString('obar')
 counter.count('foo') // 1
 counter.count('bar') // 1
 ```

 Memory is bounded to `O(maxPatternLength + numPatterns)`; cumulative counts
 are small integers that grow without bound but never dominate.

 Matching semantics are overlap-by-one: after a match at index `i`, the
 search resumes at `i + 1`. So `"aaa"` with pattern `"aa"` counts as `2`.

 Case sensitivity is fixed at construction. When `caseSensitive: false`, both
 stored patterns and incoming chunks are lower-cased before matching, and the
 lookup key in `count()` is normalized the same way.

 The empty pattern `""` is defined to always have `count("") === 1` and
 `hasEverMatched("") === true`, regardless of input.

 `count(pattern)` for an unregistered pattern returns `0` (no error).
 */
export class OccurrenceCounter
{
  readonly #caseSensitive: boolean;
  readonly #normalizedPatterns: readonly string[];
  readonly #counts: Map<string, number>;
  readonly #maxPatternLength: number;
  readonly #decoder: Utf8ChunkDecoder;
  #tail = '';

  constructor(patterns: readonly string[], options: OccurrenceCounterOptions = {})
  {
    this.#caseSensitive = options.caseSensitive ?? true;
    const normalized = Array.from(
      new Set(patterns.map((pattern) => this.#normalize(pattern))),
    );
    this.#normalizedPatterns = normalized;
    this.#counts = new Map();
    for (const pattern of normalized)
    {
      this.#counts.set(pattern, pattern.length === 0 ? 1 : 0);
    }
    this.#maxPatternLength = normalized.reduce(
      (maxLength, pattern) => Math.max(maxLength, pattern.length),
      0,
    );
    this.#decoder = new Utf8ChunkDecoder();
  }

  #normalize(value: string): string
  {
    return this.#caseSensitive ? value : value.toLowerCase();
  }

  /**
   Ingest a UTF-8 byte chunk. Partial codepoints at the end of the chunk are
   held internally and completed by the next chunk.
   */
  appendBytes(chunk: Uint8Array): void
  {
    if (chunk.length === 0)
    {
      return;
    }
    const decoded = this.#decoder.decode(chunk);
    if (decoded.length === 0)
    {
      return;
    }
    this.#ingestString(decoded);
  }

  /**
   Ingest a JS string chunk. String input is already a sequence of UTF-16
   code units; no decoding is performed.
   */
  appendString(chunk: string): void
  {
    if (chunk.length === 0)
    {
      return;
    }
    this.#ingestString(chunk);
  }

  /**
   Feed normalized-or-raw text into the tail-and-count machinery.
   */
  #ingestString(chunk: string): void
  {
    if (this.#normalizedPatterns.length === 0 || this.#maxPatternLength === 0)
    {
      return;
    }

    const normalizedChunk = this.#normalize(chunk);
    const haystack = this.#tail + normalizedChunk;

    for (const pattern of this.#normalizedPatterns)
    {
      if (pattern.length === 0)
      {
        continue;
      }
      const startIndex = Math.max(0, this.#tail.length - pattern.length + 1);
      const previous = this.#counts.get(pattern) ?? 0;
      this.#counts.set(pattern, previous + countOccurrences(haystack, pattern, startIndex));
    }

    const tailLength = Math.max(0, this.#maxPatternLength - 1);
    this.#tail = tailLength === 0 ? '' : haystack.slice(-tailLength);
  }

  /**
   Cumulative count of `pattern` across every chunk fed so far.

   Returns `0` if `pattern` was not registered at construction time (except
   for the empty string, which always returns `1`).
   */
  count(pattern: string): number
  {
    const key = this.#normalize(pattern);
    if (key.length === 0)
    {
      return 1;
    }
    return this.#counts.get(key) ?? 0;
  }

  /**
   Convenience: `count(pattern) > 0`.
   */
  hasEverMatched(pattern: string): boolean
  {
    return this.count(pattern) > 0;
  }

  /**
   Flush the internal UTF-8 decoder. Any pending partial codepoint is treated
   as invalid and a replacement character is emitted into the haystack. The
   next `appendBytes` starts a fresh decoder.

   Has no effect on `appendString`-only usage beyond resetting the decoder.
   */
  end(): void
  {
    const flushed = this.#decoder.end();
    if (flushed.length > 0)
    {
      this.#ingestString(flushed);
    }
  }

  /**
   Current retained tail length in characters. Not part of the stable API;
   exposed for tests that want to assert the memory bound.
   */
  debugTailLength(): number
  {
    return this.#tail.length;
  }
}

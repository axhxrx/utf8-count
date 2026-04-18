# `@axhxrx/utf8-count` Spec

Count occurrences of registered string patterns in a chunked UTF-8 byte stream (or equivalently, a chunked JS string stream) using bounded memory, and report per-pattern cumulative counts and "has-ever-matched" booleans.

## Motivation

Scanning a streaming source for substring occurrences is a recurring problem: log tailing, network response scanning, child-process stdout monitoring, file-tail processing. Two things make a correct implementation non-trivial:

1. **Chunk boundaries.** A pattern like `"foo"` could arrive as `"fo"` then `"o"` across two chunks, or `"foo bar foo"` could straddle arbitrary chunk splits. A naive per-chunk `.includes()` misses such matches.
2. **UTF-8 byte boundaries.** A multi-byte UTF-8 codepoint can be split across Uint8Array chunks. Decoding each chunk independently corrupts the boundary byte. The standard solution (`TextDecoder` with `{ stream: true }`) must live somewhere — once, not per caller.

This library handles both concerns in one place and exposes a tiny API: register patterns up front, append chunks as they arrive, query cumulative counts at any time.

## Non-goals

- Regex, glob, wildcard, or any pattern dialect beyond plain substring match.
- Binary-pattern matching against raw bytes without UTF-8 decoding.
- Stream adapters for specific sources (no built-in integration with `ReadableStream`, `fs.createReadStream`, `child_process.spawn`, etc.). Callers feed chunks themselves.
- Encoding other than UTF-8 for byte input. String input is JS-native UTF-16 code units (standard JavaScript strings).
- Match-position reporting. Only counts and "has-matched" booleans are exposed.
- Dynamic pattern registration after construction. Patterns are fixed at construction time.

## Public API

```ts
export class OccurrenceCounter
{
  constructor(patterns: readonly string[], options?: OccurrenceCounterOptions)

  /**
   Ingest a UTF-8 byte chunk. Partial codepoints at the end of the chunk are held
   internally and completed by the next chunk.
   */
  appendBytes(chunk: Uint8Array): void

  /**
   Ingest a JS string chunk. String input is already a sequence of UTF-16 code
   units; no decoding is performed. Useful when the caller has pre-decoded text
   (e.g. from `readable.setEncoding('utf8')`).
   */
  appendString(chunk: string): void

  /**
   Cumulative count of `pattern` across every chunk fed so far.

   Returns `0` if `pattern` was not registered at construction time (except for
   the empty string, which is defined to always have count `1`).

   Returns the same number regardless of which `appendBytes` / `appendString`
   call produced the matches.
   */
  count(pattern: string): number

  /**
   Convenience: `count(pattern) > 0`.
   */
  hasEverMatched(pattern: string): boolean

  /**
   Optional: flush the internal UTF-8 decoder, treating any pending partial
   codepoint as invalid and letting the next `appendBytes` start a fresh
   decoder. Use when the underlying source has ended and you want to ensure no
   trailing incomplete codepoint will silently appear in a future chunk.

   Has no effect on `appendString`-only usage.
   */
  end(): void
}

export interface OccurrenceCounterOptions
{
  /**
   When `false`, patterns and incoming chunks are both lower-cased before
   matching. Default: `true`.

   Case-folding uses `String.prototype.toLowerCase()` with no locale argument,
   matching the behavior of `Array#includes` and most CLI "case-insensitive"
   conventions. Unicode case-folding edge cases (Turkish dotless-i, etc.) are
   NOT handled specially; callers with those requirements should normalize
   input before feeding it.
   */
  caseSensitive?: boolean
}
```

## Semantics

### Match counting

- Matches are counted by 1-character advance: after a match at index `i`, the search resumes at `i + 1`, not `i + needle.length`. Therefore:
  - `"aaa"` with pattern `"aa"` counts as `2`.
  - `"abababab"` with pattern `"abab"` counts as `3`.
- Matches that straddle chunk boundaries are counted exactly once. `appendString("fo")` followed by `appendString("obar")` with pattern `"foo"` yields `count("foo") === 1`.

### Cross-chunk retention

- After each append, the counter retains only the last `maxPatternLength - 1` characters of input internally, where `maxPatternLength` is the longest registered pattern length (after case-folding). This guarantees any pattern that straddles a future chunk boundary is still detectable.
- Memory bound: `O(maxPatternLength + numPatterns)` for the counter state; count values are small integers.

### Empty patterns

- The empty pattern `""` is defined to have `count("") === 1` and `hasEverMatched("") === true` always. Useful for trivial "always satisfied" checks.

### Unknown patterns

- `count(pattern)` for a pattern not registered at construction returns `0`. No error.

### UTF-8 decoding

- `appendBytes(chunk)` decodes `chunk` using an internal `TextDecoder('utf-8', { fatal: false, ignoreBOM: true })` in stream mode. A codepoint split across two `appendBytes` calls is correctly reassembled.
- A BOM at the start of the first chunk is NOT stripped; it's treated as a normal codepoint and fed through the matcher. Callers that want to strip a BOM should do so before passing the chunk.
- Invalid UTF-8 sequences are replaced with U+FFFD (the standard `TextDecoder` behavior when `fatal: false`). Replacement characters appear in the haystack like any other character; patterns that happen to match them will match.
- Mixing `appendBytes` and `appendString` on the same counter is allowed, in any order. Each `appendBytes` completes its chunk independently; the stream-mode decoder is per-byte-call-chain, not affected by intervening string calls.

### Case sensitivity

- When `caseSensitive: false`, patterns are lower-cased at construction time, and each ingested chunk is lower-cased before matching. The stored count keys use the lower-cased form. `counter.count("FOO")` and `counter.count("foo")` return the same value.
- Lower-casing happens AFTER UTF-8 decoding. Byte-level matching is not supported.

## Worked examples

```ts
import { OccurrenceCounter } from '@axhxrx/utf8-count';

// --- single-chunk string input ---
const c1 = new OccurrenceCounter(['hello', 'world']);
c1.appendString('hello world, hello again');
c1.count('hello'); // 2
c1.count('world'); // 1
c1.hasEverMatched('world'); // true

// --- cross-chunk match ---
const c2 = new OccurrenceCounter(['foo']);
c2.appendString('fo');
c2.appendString('obar');
c2.count('foo'); // 1

// --- case-insensitive ---
const c3 = new OccurrenceCounter(['FOO'], { caseSensitive: false });
c3.appendString('A foo and a Foo and a FOO');
c3.count('foo'); // 3
c3.count('FOO'); // 3 (same key after normalization)

// --- overlapping match ---
const c4 = new OccurrenceCounter(['aa']);
c4.appendString('aaa');
c4.count('aa'); // 2

// --- UTF-8 bytes with multibyte codepoint across chunks ---
// "café" = 63 61 66 c3 a9
const c5 = new OccurrenceCounter(['café']);
c5.appendBytes(new Uint8Array([0x63, 0x61, 0x66, 0xc3])); // "caf" + first byte of 'é'
c5.appendBytes(new Uint8Array([0xa9, 0x20, 0x6f, 0x6b])); // rest of 'é' + " ok"
c5.count('café'); // 1

// --- unknown pattern ---
const c6 = new OccurrenceCounter(['foo']);
c6.appendString('bar');
c6.count('baz'); // 0 (not registered, not an error)
```

## Test matrix

### Basic matching
1. Single-chunk string input with one match.
2. Single-chunk string input with multiple matches.
3. Multiple patterns registered; each counted independently.
4. Empty string argv returns count 0 for all patterns.
5. Empty pattern `""` always has count 1.
6. Unknown (unregistered) pattern has count 0, not an error.

### Cross-chunk behaviour
7. Pattern straddling two string chunks is matched.
8. Pattern straddling three string chunks (tail-of-chunk1 + entire chunk2 + head-of-chunk3) is matched.
9. Pattern that is longer than any single chunk is matched across chunks.
10. Tail retention is bounded by `maxPatternLength - 1` characters (test by appending many small chunks and checking internal tail length if exposed, or by matching a pattern and confirming a later match works).

### Overlapping matches
11. `"aaa"` with pattern `"aa"` counts as 2.
12. `"abababab"` with pattern `"abab"` counts as 3.
13. `"aaaaa"` with pattern `"aa"` counts as 4.

### Case sensitivity
14. Default is case-sensitive: `"Foo"` does not match pattern `"foo"`.
15. `caseSensitive: false`: `"Foo"` matches pattern `"foo"`.
16. `caseSensitive: false`: `count("FOO")` and `count("foo")` return the same value.
17. Case-insensitive mode handles mixed-case across chunk boundaries (e.g. `"Fo"` + `"O"`).

### UTF-8 byte input
18. Single-chunk Uint8Array input produces correct count.
19. Multi-byte codepoint split across two Uint8Array chunks is reassembled.
20. Three-byte codepoint (e.g. a CJK character) split across chunks is reassembled.
21. Four-byte codepoint (e.g. an emoji) split across chunks is reassembled.
22. Invalid UTF-8 byte sequence produces U+FFFD replacement characters, not a thrown error.
23. Mixed `appendBytes` and `appendString` calls on the same counter both contribute to cumulative counts.

### Boundary of empty input
24. `appendBytes(new Uint8Array(0))` has no effect on counts.
25. `appendString("")` has no effect on counts.

### Memory bound smoke test
26. Feeding a very large chunk (e.g. 10 MB of text with no match) does not cause memory to grow beyond `O(maxPatternLength)`. Assert via `debugTailLength()` or equivalent test-only accessor.

### Method behaviours
27. `hasEverMatched(p)` returns `false` before any match, `true` after any match.
28. `count(p)` is monotonically non-decreasing across calls.
29. `end()` followed by another `appendBytes` starts a fresh decoder (no cross-contamination of partial codepoints).

## File layout

```
utf8-count/
  SPEC.md                        # this document
  README.md
  src/
    OccurrenceCounter.ts         # main class
    utf8ChunkDecoder.ts          # internal: TextDecoder stream wrapper, tail retention
    patternMatcher.ts            # internal: overlap-by-one counting primitive
    types/
      OccurrenceCounterOptions.ts
      index.ts                   # re-exports
    index.ts                     # re-exports public surface (runtime + types)
  test/
    OccurrenceCounter.test.ts    # primary test file covering the test matrix
    utf8ChunkDecoder.test.ts     # unit tests for the decoder wrapper (if separation pays off)
  deno.jsonc
  package.json
  tsconfig.json
  dprint.jsonc
```

Convention: every subproject in the axhxrx monorepo puts types in a `types/` subdirectory, one file per main type. Even when there are only a handful of types.

Goal: no file exceeds ~250 lines. The main class should be well under that.

## Dependencies

- Runtime: none (uses native `TextDecoder`, available in Bun/Deno/Node 18+).
- Dev: `@std/expect`, `@std/assert`, `typescript`.

## Publishing

- JSR: `@axhxrx/utf8-count`.
- Versioning: semver, starts at `0.1.0`.

## Open design questions (resolved during implementation, not spec)

- **Debug accessors.** Should the counter expose its internal tail length for test assertions? Lean: yes, as a `debugTailLength()` method, with an explicit "not part of the stable API" doc comment. Alternative: a test-only hook via a separate export path.
- **Snapshotting.** Should the counter support a `snapshot()` method that returns a frozen point-in-time view of all counts? Defer to v0.2 if a real use case emerges.

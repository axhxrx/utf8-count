import { expect } from '@std/expect';
import { describe, test } from 'node:test';

import { OccurrenceCounter } from '../src/OccurrenceCounter.ts';

describe('OccurrenceCounter: basic matching', () =>
{
  // 1. Single-chunk string input with one match.
  test('single-chunk string input with one match', () =>
  {
    const counter = new OccurrenceCounter(['hello']);
    counter.appendString('hello world');
    expect(counter.count('hello')).toBe(1);
    expect(counter.hasEverMatched('hello')).toBe(true);
  });

  // 2. Single-chunk string input with multiple matches.
  test('single-chunk string input with multiple matches', () =>
  {
    const counter = new OccurrenceCounter(['hello']);
    counter.appendString('hello world, hello again');
    expect(counter.count('hello')).toBe(2);
  });

  // 3. Multiple patterns registered; each counted independently.
  test('multiple patterns registered are counted independently', () =>
  {
    const counter = new OccurrenceCounter(['foo', 'bar']);
    counter.appendString('foo bar foo bar bar');
    expect(counter.count('foo')).toBe(2);
    expect(counter.count('bar')).toBe(3);
  });

  // 4. Empty string argv returns count 0 for all patterns.
  test('empty input returns count 0 for all registered patterns', () =>
  {
    const counter = new OccurrenceCounter(['foo', 'bar']);
    expect(counter.count('foo')).toBe(0);
    expect(counter.count('bar')).toBe(0);
    expect(counter.hasEverMatched('foo')).toBe(false);
  });

  // 5. Empty pattern "" always has count 1.
  test('empty pattern always has count 1 and hasEverMatched true', () =>
  {
    const counter = new OccurrenceCounter(['foo']);
    expect(counter.count('')).toBe(1);
    expect(counter.hasEverMatched('')).toBe(true);

    const empty = new OccurrenceCounter([]);
    expect(empty.count('')).toBe(1);
    expect(empty.hasEverMatched('')).toBe(true);
  });

  // 6. Unknown pattern has count 0, not an error.
  test('unknown (unregistered) pattern has count 0 without error', () =>
  {
    const counter = new OccurrenceCounter(['foo']);
    counter.appendString('bar');
    expect(counter.count('baz')).toBe(0);
    expect(counter.hasEverMatched('baz')).toBe(false);
  });
});

describe('OccurrenceCounter: cross-chunk behaviour', () =>
{
  // 7. Pattern straddling two string chunks is matched.
  test('pattern straddling two string chunks is matched', () =>
  {
    const counter = new OccurrenceCounter(['foo']);
    counter.appendString('fo');
    counter.appendString('obar');
    expect(counter.count('foo')).toBe(1);
  });

  // 8. Pattern straddling three string chunks.
  test('pattern straddling three string chunks is matched', () =>
  {
    const counter = new OccurrenceCounter(['foobar']);
    counter.appendString('fo');
    counter.appendString('ob');
    counter.appendString('ar!');
    expect(counter.count('foobar')).toBe(1);
  });

  // 9. Pattern longer than any single chunk is matched across chunks.
  test('pattern longer than any chunk is matched across chunks', () =>
  {
    const counter = new OccurrenceCounter(['abcdefghij']);
    for (const ch of 'xxabcdefghijyy')
    {
      counter.appendString(ch);
    }
    expect(counter.count('abcdefghij')).toBe(1);
  });

  // 10. Tail retention is bounded by maxPatternLength - 1.
  test('tail retention is bounded by maxPatternLength - 1', () =>
  {
    const counter = new OccurrenceCounter(['foo']);
    for (let i = 0; i < 1000; i += 1)
    {
      counter.appendString('x');
    }
    expect(counter.debugTailLength()).toBeLessThanOrEqual(2);
    counter.appendString('foo');
    expect(counter.count('foo')).toBe(1);
  });
});

describe('OccurrenceCounter: overlapping matches', () =>
{
  // 11. "aaa" with pattern "aa" counts as 2.
  test('"aaa" with pattern "aa" counts as 2', () =>
  {
    const counter = new OccurrenceCounter(['aa']);
    counter.appendString('aaa');
    expect(counter.count('aa')).toBe(2);
  });

  // 12. "abababab" with pattern "abab" counts as 3.
  test('"abababab" with pattern "abab" counts as 3', () =>
  {
    const counter = new OccurrenceCounter(['abab']);
    counter.appendString('abababab');
    expect(counter.count('abab')).toBe(3);
  });

  // 13. "aaaaa" with pattern "aa" counts as 4.
  test('"aaaaa" with pattern "aa" counts as 4', () =>
  {
    const counter = new OccurrenceCounter(['aa']);
    counter.appendString('aaaaa');
    expect(counter.count('aa')).toBe(4);
  });
});

describe('OccurrenceCounter: case sensitivity', () =>
{
  // 14. Default is case-sensitive.
  test('default is case-sensitive: "Foo" does not match "foo"', () =>
  {
    const counter = new OccurrenceCounter(['foo']);
    counter.appendString('Foo bar');
    expect(counter.count('foo')).toBe(0);
    expect(counter.hasEverMatched('foo')).toBe(false);
  });

  // 15. caseSensitive: false matches mixed case.
  test('caseSensitive: false: "Foo" matches pattern "foo"', () =>
  {
    const counter = new OccurrenceCounter(['foo'], { caseSensitive: false });
    counter.appendString('Foo bar');
    expect(counter.count('foo')).toBe(1);
  });

  // 16. count("FOO") and count("foo") are equal in case-insensitive mode.
  test('caseSensitive: false: count of any case returns the same value', () =>
  {
    const counter = new OccurrenceCounter(['FOO'], { caseSensitive: false });
    counter.appendString('A foo and a Foo and a FOO');
    expect(counter.count('foo')).toBe(3);
    expect(counter.count('FOO')).toBe(3);
    expect(counter.count('Foo')).toBe(3);
  });

  // 17. Case-insensitive mode handles mixed case across chunk boundaries.
  test('case-insensitive mode handles mixed case across chunk boundaries', () =>
  {
    const counter = new OccurrenceCounter(['foo'], { caseSensitive: false });
    counter.appendString('Fo');
    counter.appendString('O bar');
    expect(counter.count('foo')).toBe(1);
  });
});

describe('OccurrenceCounter: UTF-8 byte input', () =>
{
  const enc = new TextEncoder();

  // 18. Single-chunk Uint8Array input produces correct count.
  test('single-chunk Uint8Array input produces correct count', () =>
  {
    const counter = new OccurrenceCounter(['hello']);
    counter.appendBytes(enc.encode('hello, hello, world'));
    expect(counter.count('hello')).toBe(2);
  });

  // 19. Multi-byte (2-byte) codepoint split across chunks is reassembled.
  test('two-byte codepoint split across chunks is reassembled', () =>
  {
    // "café" = 63 61 66 c3 a9
    const counter = new OccurrenceCounter(['café']);
    counter.appendBytes(new Uint8Array([0x63, 0x61, 0x66, 0xc3]));
    counter.appendBytes(new Uint8Array([0xa9, 0x20, 0x6f, 0x6b]));
    expect(counter.count('café')).toBe(1);
  });

  // 20. Three-byte codepoint (CJK) split across chunks is reassembled.
  test('three-byte CJK codepoint split across chunks is reassembled', () =>
  {
    // "日本" = E6 97 A5, E6 9C AC
    const counter = new OccurrenceCounter(['日本']);
    const bytes = enc.encode('日本');
    // Split inside the first character (after first byte).
    counter.appendBytes(bytes.slice(0, 1));
    counter.appendBytes(bytes.slice(1, 4));
    counter.appendBytes(bytes.slice(4));
    expect(counter.count('日本')).toBe(1);
  });

  // 21. Four-byte codepoint (emoji) split across chunks is reassembled.
  test('four-byte emoji codepoint split across chunks is reassembled', () =>
  {
    // "🔥" = F0 9F 94 A5
    const counter = new OccurrenceCounter(['🔥']);
    const bytes = enc.encode('hi 🔥 ok');
    // Split mid-emoji at each byte boundary.
    counter.appendBytes(bytes.slice(0, 4)); // "hi " + first byte of 🔥
    counter.appendBytes(bytes.slice(4, 5));
    counter.appendBytes(bytes.slice(5, 6));
    counter.appendBytes(bytes.slice(6));
    expect(counter.count('🔥')).toBe(1);
  });

  // 22. Invalid UTF-8 sequence produces U+FFFD, not a thrown error.
  test('invalid UTF-8 sequence produces U+FFFD replacements without throwing', () =>
  {
    const counter = new OccurrenceCounter(['\uFFFD']);
    // 0xFF is never valid at the start of a UTF-8 byte sequence.
    counter.appendBytes(new Uint8Array([0xff, 0x41, 0xfe, 0x42]));
    expect(counter.count('\uFFFD')).toBeGreaterThanOrEqual(1);
  });

  // Spec: "A BOM at the start of the first chunk is NOT stripped".
  test('leading UTF-8 BOM is not stripped and appendBytes matches appendString', () =>
  {
    const bomAndFoo = new Uint8Array([0xef, 0xbb, 0xbf, 0x66, 0x6f, 0x6f]);

    const byteCounter = new OccurrenceCounter(['\uFEFFfoo']);
    byteCounter.appendBytes(bomAndFoo);
    expect(byteCounter.count('\uFEFFfoo')).toBe(1);

    const stringCounter = new OccurrenceCounter(['\uFEFFfoo']);
    stringCounter.appendString('\uFEFFfoo');
    expect(stringCounter.count('\uFEFFfoo')).toBe(1);
  });

  // 23. Mixed appendBytes and appendString contribute to cumulative counts.
  test('mixed appendBytes and appendString contribute cumulatively', () =>
  {
    const counter = new OccurrenceCounter(['foo']);
    counter.appendString('foo and ');
    counter.appendBytes(enc.encode('foo again'));
    counter.appendString(' and foo');
    expect(counter.count('foo')).toBe(3);
  });
});

describe('OccurrenceCounter: empty input boundaries', () =>
{
  // 24. appendBytes(Uint8Array(0)) has no effect.
  test('appendBytes with empty Uint8Array has no effect', () =>
  {
    const counter = new OccurrenceCounter(['foo']);
    counter.appendBytes(new Uint8Array(0));
    expect(counter.count('foo')).toBe(0);
    expect(counter.debugTailLength()).toBe(0);
  });

  // 25. appendString("") has no effect.
  test('appendString with empty string has no effect', () =>
  {
    const counter = new OccurrenceCounter(['foo']);
    counter.appendString('');
    expect(counter.count('foo')).toBe(0);
    expect(counter.debugTailLength()).toBe(0);
  });
});

describe('OccurrenceCounter: memory bound smoke test', () =>
{
  // 26. Feeding 10 MB of text with no match keeps tail bounded.
  test('feeding 10 MB of non-matching text keeps tail bounded', () =>
  {
    const counter = new OccurrenceCounter(['needlex']);
    const block = 'x'.repeat(1024 * 1024); // 1 MiB
    for (let i = 0; i < 10; i += 1)
    {
      counter.appendString(block);
    }
    expect(counter.debugTailLength()).toBeLessThanOrEqual(6);
    expect(counter.count('needlex')).toBe(0);
  });
});

describe('OccurrenceCounter: method behaviours', () =>
{
  // 27. hasEverMatched is false before any match, true after.
  test('hasEverMatched returns false before any match and true after', () =>
  {
    const counter = new OccurrenceCounter(['foo']);
    expect(counter.hasEverMatched('foo')).toBe(false);
    counter.appendString('no match here');
    expect(counter.hasEverMatched('foo')).toBe(false);
    counter.appendString(' foo ');
    expect(counter.hasEverMatched('foo')).toBe(true);
  });

  // 28. count(p) is monotonically non-decreasing.
  test('count is monotonically non-decreasing across calls', () =>
  {
    const counter = new OccurrenceCounter(['foo']);
    let last = counter.count('foo');
    expect(last).toBe(0);
    counter.appendString('foo');
    expect(counter.count('foo')).toBeGreaterThanOrEqual(last);
    last = counter.count('foo');
    counter.appendString('bar');
    expect(counter.count('foo')).toBeGreaterThanOrEqual(last);
    last = counter.count('foo');
    counter.appendString('foo foo');
    expect(counter.count('foo')).toBeGreaterThanOrEqual(last);
  });

  // 29. end() followed by another appendBytes starts a fresh decoder.
  test('end() followed by appendBytes starts a fresh decoder', () =>
  {
    const counter = new OccurrenceCounter(['ab']);
    // Feed only the first byte of a two-byte codepoint ("é" = c3 a9).
    counter.appendBytes(new Uint8Array([0xc3]));
    // No complete codepoint yet, nothing to count.
    expect(counter.count('ab')).toBe(0);
    counter.end();
    // After end(), the decoder is fresh. Feed ASCII "ab" cleanly.
    counter.appendBytes(new Uint8Array([0x61, 0x62]));
    expect(counter.count('ab')).toBe(1);
  });
});

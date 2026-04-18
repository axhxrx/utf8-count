# @axhxrx/utf8-count

Count occurrences of registered string patterns in a chunked UTF-8 byte stream (or JS string series) using minimal memory.

See [SPEC.md](./SPEC.md) for the full specification.

## Install

```bash
# Deno
deno add jsr:@axhxrx/utf8-count

# Bun / Node
bunx jsr add @axhxrx/utf8-count
```

## Quick start

```ts
import { OccurrenceCounter } from '@axhxrx/utf8-count'

const counter = new OccurrenceCounter(['hello', 'world'])
counter.appendString('hello wor');
counter.appendString('ld, hell');
counter.appendString('o again')
counter.count('hello') // 2
counter.count('world') // 1

// UTF-8 byte input, including multi-byte codepoints split across chunks:
const c = new OccurrenceCounter(['café'])
c.appendBytes(new Uint8Array([0x63, 0x61, 0x66, 0xc3])) // "caf" + first byte of 'é'
c.appendBytes(new Uint8Array([0xa9])) // rest of 'é'
c.count('café') // 1
```

# CLI

```
./bin/count.ts README.md count byte count string "new Uint8Array"
README.md: 1,485 bytes in 1 chunk (0.84 ms, caseSensitive=true)
  "count"           20
  "byte"            8
  "count"           20
  "string"          4
  "new Uint8Array"  4
```

Or, from JSR:

```
deno run -R https://jsr.io/@axhxrx/utf8-count/0.1.0/bin/count.ts \
  --ignore-case \
  README.md \
  deno bun node
README.md: 1,600 bytes in 1 chunk (2.83 ms, caseSensitive=false)
  "deno"  7
  "bun"   6
  "node"  5
```  

## Tests

```bash
bun test
deno test -A
node --test
```

## Runtimes

Deno, Bun, Node 24.2+

## License

MIT

## Happenings

- 2026-04-18 💄 0.1.2 — beautify README

- 2026-04-18 🩹 0.1.1 — fix bug in README

- 2026-04-18 📦 0.1.0 — initial release

以上

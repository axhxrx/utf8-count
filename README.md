# @axhxrx/utf8-stream-occurrences

Count occurrences of registered string patterns in a chunked UTF-8 byte stream (or chunked JS string stream) using bounded memory.

See [SPEC.md](./SPEC.md) for the full specification.

## Install

```bash
# Deno
deno add jsr:@axhxrx/utf8-stream-occurrences

# Bun / Node
bunx jsr add @axhxrx/utf8-stream-occurrences
```

## Quick start

```ts
import { OccurrenceCounter } from '@axhxrx/utf8-stream-occurrences'

const counter = new OccurrenceCounter(['hello', 'world'])
counter.appendString('hello world, hello again')
counter.count('hello') // 2
counter.count('world') // 1

// UTF-8 byte input, including multi-byte codepoints split across chunks:
const c = new OccurrenceCounter(['café'])
c.appendBytes(new Uint8Array([0x63, 0x61, 0x66, 0xc3])) // "caf" + first byte of 'é'
c.appendBytes(new Uint8Array([0xa9])) // rest of 'é'
c.count('café') // 1
```

## Tests

```bash
bun test
deno test -A
```

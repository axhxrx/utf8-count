/**
 Thin wrapper around `TextDecoder` that keeps a single streaming decoder alive
 across repeated `decode` calls. Partial UTF-8 codepoints at the end of one
 chunk are carried over internally and completed by the next chunk.

 Invalid UTF-8 sequences are replaced with U+FFFD (the default `fatal: false`
 behavior). A BOM at the start of the first chunk is preserved (not stripped).

 `end()` flushes any pending partial codepoint and resets the decoder so the
 next `decode` call starts a fresh stream. This is useful when the underlying
 source has ended and the caller wants to ensure no trailing incomplete
 codepoint will silently resurface in a later chunk.
 */
export class Utf8ChunkDecoder
{
  #decoder: TextDecoder;

  constructor()
  {
    this.#decoder = Utf8ChunkDecoder.#makeDecoder();
  }

  static #makeDecoder(): TextDecoder
  {
    // `ignoreBOM: true` preserves an initial U+FEFF as a normal codepoint in
    // the output, per the spec's requirement that a leading BOM be fed into
    // the matcher like any other character. With `ignoreBOM: false` the
    // decoder strips the BOM — the opposite of what the name suggests.
    return new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
  }

  /**
   Decode `chunk` as the next segment of a streaming UTF-8 byte sequence.
   Returns the fully-decoded characters up to the last complete codepoint in
   `chunk`; any trailing partial codepoint is held for the next call.
   */
  decode(chunk: Uint8Array): string
  {
    if (chunk.length === 0)
    {
      return '';
    }
    return this.#decoder.decode(chunk, { stream: true });
  }

  /**
   Flush the decoder. Any pending partial codepoint is emitted as a
   replacement character, and a fresh decoder is installed so future `decode`
   calls start a new stream.
   */
  end(): string
  {
    const flushed = this.#decoder.decode();
    this.#decoder = Utf8ChunkDecoder.#makeDecoder();
    return flushed;
  }
}

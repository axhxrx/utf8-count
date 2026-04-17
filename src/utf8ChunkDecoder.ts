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
    return new TextDecoder('utf-8', { fatal: false, ignoreBOM: false });
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

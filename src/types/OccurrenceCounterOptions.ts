/**
 Options controlling how `OccurrenceCounter` matches registered patterns against ingested chunks.
 */
export interface OccurrenceCounterOptions
{
  /**
   When `false`, patterns and incoming chunks are both lower-cased before matching. Default: `true`.

   Case-folding uses `String.prototype.toLowerCase()` with no locale argument, matching the behavior of `Array#includes` and most CLI "case-insensitive" conventions. Unicode case-folding edge cases (Turkish dotless-i, etc.) are NOT handled specially; callers with those requirements should normalize input before feeding it.
   */
  caseSensitive?: boolean;
}

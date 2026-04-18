/**
 Count overlap-by-one occurrences of `needle` in `haystack` starting at `startIndex`. After a match at index `i`, the search resumes at `i + 1`,
 not `i + needle.length`. So `countOccurrences('aaa', 'aa')` returns `2`.

 An empty needle is defined to return `1` as a convenience for callers that treat `""` as an always-satisfied pattern.
 */
export function countOccurrences(haystack: string, needle: string, startIndex = 0): number
{
  if (needle.length === 0)
  {
    return 1;
  }

  let count = 0;
  let searchIndex = Math.max(0, startIndex);

  while (searchIndex <= haystack.length - needle.length)
  {
    const matchIndex = haystack.indexOf(needle, searchIndex);
    if (matchIndex === -1)
    {
      break;
    }
    count += 1;
    searchIndex = matchIndex + 1;
  }

  return count;
}

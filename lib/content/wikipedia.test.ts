import { describe, it, expect } from 'vitest';
import {
  parseSummary,
  parseEnglishTitle,
  parseWikidataDescription,
  parseGeosearch,
  truncateToSentences,
} from './wikipedia';

// Fixtures below are trimmed copies of live responses, checked against the real
// endpoints during development (en.wikipedia.org REST summary, geosearch, and
// www.wikidata.org wbgetentities) rather than assumed from memory.

describe('truncateToSentences', () => {
  it('keeps the first two sentences and drops the rest', () => {
    const text =
      'Kiyomizu-dera is a Buddhist temple located in eastern Kyoto, Japan. ' +
      'It belongs to the Kita-Hosso sect of Japanese Buddhism. ' +
      "The temple's full name is Otowa-san Kiyomizu-dera. " +
      'The temple is the 16th stop on the Saigoku Kannon Pilgrimage route.';
    const out = truncateToSentences(text);
    expect(out).toBe(
      'Kiyomizu-dera is a Buddhist temple located in eastern Kyoto, Japan. It belongs to the Kita-Hosso sect of Japanese Buddhism.',
    );
  });

  it('leaves a short one-sentence text alone', () => {
    expect(truncateToSentences('Buddhist temple in Kyoto, Japan.')).toBe('Buddhist temple in Kyoto, Japan.');
  });

  it('caps at maxChars even within the sentence budget, cutting only at a word boundary', () => {
    const long = `${'A very long single sentence that keeps going and going and going '.repeat(5)}.`;
    const out = truncateToSentences(long, 2, 60);
    expect(out.length).toBeLessThanOrEqual(61); // 60 + the ellipsis character
    expect(out.endsWith('…')).toBe(true);

    // The text before the ellipsis must be a verbatim prefix of the source, and
    // whatever character follows that prefix in the source must be whitespace —
    // i.e. the cut landed between words, not through the middle of one.
    const kept = out.slice(0, -1);
    expect(long.startsWith(kept)).toBe(true);
    expect(long[kept.length]).toMatch(/\s/);
  });

  it('does not drop a sentence containing a decimal number before the true end', () => {
    // Regression: the previous implementation used text.match() on a pattern that
    // could fail to complete at "2.5" (a period not followed by whitespace), and
    // a failed match makes the regex engine silently skip ahead — dropping the
    // whole sentence up to the next point where the pattern happened to succeed.
    // Confirmed live against the real Fushimi Inari-taisha Wikipedia summary.
    const text =
      'Fushimi Inari-taisha is the head shrine of the kami Inari, located in Kyoto, Japan. ' +
      'The shrine sits at the base of a mountain and includes trails spanning 4 kilometres (2.5 mi) and take approximately 2 hours to walk up. ' +
      "It is unclear whether the mountain's name came first.";
    const out = truncateToSentences(text, 2, 500);
    expect(out).toContain('The shrine sits at the base of a mountain');
    expect(out).not.toMatch(/^\d/); // must not start mid-sentence, e.g. "5 mi) and..."
  });

  it('handles text with no sentence-ending punctuation at all', () => {
    expect(truncateToSentences('no punctuation here')).toBe('no punctuation here');
  });
});

describe('parseSummary', () => {
  it('extracts and truncates a standard page', () => {
    const json = {
      type: 'standard',
      extract:
        'Kiyomizu-dera  is a Buddhist temple located in eastern Kyoto, Japan. ' +
        'It belongs to the Kita-Hosso sect of Japanese Buddhism and its honzon is a hibutsu statue of Jūichimen Kannon. ' +
        "The temple's full name is Otowa-san Kiyomizu-dera.",
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Kiyomizu-dera' } },
    };
    const out = parseSummary(json, 'en', 'Kiyomizu-dera');
    expect(out?.url).toBe('https://en.wikipedia.org/wiki/Kiyomizu-dera');
    expect(out?.extract).toContain('Buddhist temple located in eastern Kyoto');
  });

  it('returns null for a disambiguation page even though it has an extract', () => {
    // Confirmed live: /page/summary/Springfield returns type "disambiguation"
    // *with* a non-empty extract field — the type check has to run regardless.
    const json = { type: 'disambiguation', extract: 'Springfield may refer to several places.' };
    expect(parseSummary(json, 'en', 'Springfield')).toBeNull();
  });

  it('returns null when there is no extract at all', () => {
    expect(parseSummary({ type: 'standard' }, 'en', 'X')).toBeNull();
  });

  it('falls back to a constructed URL when content_urls is missing', () => {
    const out = parseSummary({ type: 'standard', extract: 'Text.' }, 'ja', '清水寺');
    expect(out?.url).toBe('https://ja.wikipedia.org/wiki/%E6%B8%85%E6%B0%B4%E5%AF%BA');
  });
});

describe('parseEnglishTitle', () => {
  it('reads the enwiki sitelink title', () => {
    const json = {
      entities: { Q221716: { type: 'item', id: 'Q221716', sitelinks: { enwiki: { title: 'Kiyomizu-dera' } } } },
    };
    expect(parseEnglishTitle(json, 'Q221716')).toBe('Kiyomizu-dera');
  });

  it('returns null when there is no English sitelink', () => {
    expect(parseEnglishTitle({ entities: { Q1: { sitelinks: {} } } }, 'Q1')).toBeNull();
  });

  it('returns null when the entity id is not present in the response', () => {
    expect(parseEnglishTitle({ entities: {} }, 'Q999')).toBeNull();
  });
});

describe('parseWikidataDescription', () => {
  it('reads and capitalizes the English description', () => {
    // Wikidata descriptions are lowercase by convention.
    const json = { entities: { Q221716: { descriptions: { en: { value: 'buddhist temple in kyoto, japan' } } } } };
    expect(parseWikidataDescription(json, 'Q221716')).toBe('Buddhist temple in kyoto, japan');
  });

  it('returns null when there is no English description', () => {
    expect(parseWikidataDescription({ entities: { Q1: { descriptions: {} } } }, 'Q1')).toBeNull();
  });
});

describe('parseGeosearch', () => {
  it('maps title and dist for every hit', () => {
    // Confirmed live shape for list=geosearch.
    const json = {
      batchcomplete: '',
      query: {
        geosearch: [
          { pageid: 631068, ns: 0, title: 'Kiyomizu-dera', lat: 34.995, lon: 135.785, dist: 11.1, primary: '' },
        ],
      },
    };
    expect(parseGeosearch(json)).toEqual([{ title: 'Kiyomizu-dera', distanceM: 11.1 }]);
  });

  it('returns an empty array when there are no nearby hits', () => {
    expect(parseGeosearch({ query: { geosearch: [] } })).toEqual([]);
  });

  it('returns an empty array on a malformed response', () => {
    expect(parseGeosearch({})).toEqual([]);
  });
});

import {HighlightQueryPipe} from './highlight-query.pipe';

describe('HighlightQueryPipe', () => {
  const pipe = new HighlightQueryPipe();

  it('bolds a case-insensitive match', () => {
    expect(pipe.transform('Ночной дозор', 'ДОЗОР')).toBe('Ночной <b>дозор</b>');
  });

  it('bolds every occurrence', () => {
    expect(pipe.transform('aXbXc', 'x')).toBe('a<b>X</b>b<b>X</b>c');
  });

  it('returns escaped text when the query is blank', () => {
    expect(pipe.transform('a < b', '  ')).toBe('a &lt; b');
  });

  it('escapes html in text and match', () => {
    expect(pipe.transform('<i>загадка</i>', '<i>')).toBe('<b>&lt;i&gt;</b>загадка&lt;/i&gt;');
  });

  it('leaves text without matches untouched', () => {
    expect(pipe.transform('Gryffindor', 'harry')).toBe('Gryffindor');
  });
});

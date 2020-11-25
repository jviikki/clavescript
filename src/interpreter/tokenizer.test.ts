import {createTokenizer, Token, TokenizerError, TokenType} from './tokenizer';
import {createInputStream} from './input-stream';

describe('Tokenizer', () => {
  it('recognizes keywords, identifiers and punctuation', () => {
    const expectedTokens: (Token | TokenizerError)[] = [
      {type: TokenType.Keyword, value: 'loop'},
      {type: TokenType.Identifier, value: 'pattern'},
      {type: TokenType.Punctuation, value: ';'},
    ];

    const t = createTokenizer(createInputStream('loop pattern;'));
    const tokens = [];
    while (!t.eof()) {
      const token = t.next();
      tokens.push(token);
      if (token.type === 'error') break;
    }

    expect(tokens).toEqual(expectedTokens);
  });

  it('does not recognize non-ASCII characters as identifiers', () => {
    const t = createTokenizer(createInputStream('ö'));
    const tokens = [];
    while (!t.eof()) {
      const token = t.next();
      tokens.push(token);
      if (token.type === 'error') break;
    }

    expect(tokens.length).toEqual(1);
    expect(tokens[0]).toMatchObject({type: 'error'});
  });
});

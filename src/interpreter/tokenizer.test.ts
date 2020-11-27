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

  it('recognizes all token types and ignores comments', () => {
    const input =
      '# here are some comments\n' +
      '\n' +
      'tempo 100; # set the tempo here\n' +
      '\n' +
      'pattern :=\n' +
      '  { x -  | x := 88 }        :=:\n' +
      '  { x - x - - x | x := 44 } :=:\n' +
      '  { x - - - | x := 25 }     :+:\n' +
      '\n' +
      '  { x - x - | x := 88 }     :=:\n' +
      '  { x - x - | x := 44 }     :=:\n' +
      '  { x - - - | x := 25 }     :+:\n' +
      '\n' +
      '(  { x - x - | x := 88 }    :=:\n' +
      '   { x - x | x := 44 }      :=:\n' +
      '   { x - - - | x := 25 }  );\n' +
      '\n' +
      '# Some more comments\n' +
      '\n' +
      'loop pattern; # start looping the pattern';

    const expectedTokens: (Token | TokenizerError)[] = [
      {
        type: TokenType.Keyword,
        value: 'tempo',
      },
      {
        type: TokenType.Integer,
        value: 100,
      },
      {
        type: TokenType.Punctuation,
        value: ';',
      },
      {
        type: TokenType.Identifier,
        value: 'pattern',
      },
      {
        type: TokenType.Operator,
        value: ':=',
      },
      {
        type: TokenType.Punctuation,
        value: '{',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Punctuation,
        value: '|',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: ':=',
      },
      {
        type: TokenType.Integer,
        value: 88,
      },
      {
        type: TokenType.Punctuation,
        value: '}',
      },
      {
        type: TokenType.Operator,
        value: ':=:',
      },
      {
        type: TokenType.Punctuation,
        value: '{',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Punctuation,
        value: '|',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: ':=',
      },
      {
        type: TokenType.Integer,
        value: 44,
      },
      {
        type: TokenType.Punctuation,
        value: '}',
      },
      {
        type: TokenType.Operator,
        value: ':=:',
      },
      {
        type: TokenType.Punctuation,
        value: '{',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Punctuation,
        value: '|',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: ':=',
      },
      {
        type: TokenType.Integer,
        value: 25,
      },
      {
        type: TokenType.Punctuation,
        value: '}',
      },
      {
        type: TokenType.Operator,
        value: ':+:',
      },
      {
        type: TokenType.Punctuation,
        value: '{',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Punctuation,
        value: '|',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: ':=',
      },
      {
        type: TokenType.Integer,
        value: 88,
      },
      {
        type: TokenType.Punctuation,
        value: '}',
      },
      {
        type: TokenType.Operator,
        value: ':=:',
      },
      {
        type: TokenType.Punctuation,
        value: '{',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Punctuation,
        value: '|',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: ':=',
      },
      {
        type: TokenType.Integer,
        value: 44,
      },
      {
        type: TokenType.Punctuation,
        value: '}',
      },
      {
        type: TokenType.Operator,
        value: ':=:',
      },
      {
        type: TokenType.Punctuation,
        value: '{',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Punctuation,
        value: '|',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: ':=',
      },
      {
        type: TokenType.Integer,
        value: 25,
      },
      {
        type: TokenType.Punctuation,
        value: '}',
      },
      {
        type: TokenType.Operator,
        value: ':+:',
      },
      {
        type: TokenType.Punctuation,
        value: '(',
      },
      {
        type: TokenType.Punctuation,
        value: '{',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Punctuation,
        value: '|',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: ':=',
      },
      {
        type: TokenType.Integer,
        value: 88,
      },
      {
        type: TokenType.Punctuation,
        value: '}',
      },
      {
        type: TokenType.Operator,
        value: ':=:',
      },
      {
        type: TokenType.Punctuation,
        value: '{',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Punctuation,
        value: '|',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: ':=',
      },
      {
        type: TokenType.Integer,
        value: 44,
      },
      {
        type: TokenType.Punctuation,
        value: '}',
      },
      {
        type: TokenType.Operator,
        value: ':=:',
      },
      {
        type: TokenType.Punctuation,
        value: '{',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Operator,
        value: '-',
      },
      {
        type: TokenType.Punctuation,
        value: '|',
      },
      {
        type: TokenType.Identifier,
        value: 'x',
      },
      {
        type: TokenType.Operator,
        value: ':=',
      },
      {
        type: TokenType.Integer,
        value: 25,
      },
      {
        type: TokenType.Punctuation,
        value: '}',
      },
      {
        type: TokenType.Punctuation,
        value: ')',
      },
      {
        type: TokenType.Punctuation,
        value: ';',
      },
      {
        type: TokenType.Keyword,
        value: 'loop',
      },
      {
        type: TokenType.Identifier,
        value: 'pattern',
      },
      {
        type: TokenType.Punctuation,
        value: ';',
      },
    ];

    const t = createTokenizer(createInputStream(input));
    const tokens = [];
    while (!t.eof()) {
      const token = t.next();
      tokens.push(token);
      if (token.type === 'error') break;
    }

    expect(tokens).toEqual(expectedTokens);
  });

  it('raises error on unrecognized operator', () => {
    const invalidOperator = ':++:';
    const t = createTokenizer(createInputStream(invalidOperator));
    const tokens = [];
    const token = t.next();
    tokens.push(token);

    expect(tokens.length).toEqual(1);
    expect(tokens[0]).toMatchObject({type: 'error'});
    expect(t.line()).toEqual(1);
    expect(t.col()).toEqual(5);
  });
});

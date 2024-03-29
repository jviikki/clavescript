import {EOF, InputStream} from './input-stream';

export enum TokenType {
  EOF,
  Integer,
  Punctuation,
  Operator,
  Keyword,
  Identifier,
  Float,
  Boolean,
  String,
}

const punctuationStrings = [
  '{',
  '}',
  ',',
  '|',
  ';',
  '(',
  ')',
  '[',
  ']',
] as const;
type PunctuationString = typeof punctuationStrings[number];

const operatorStrings = [
  ':=:',
  ':+:',
  '/',
  '*',
  '+',
  '-',
  '>',
  '>=',
  '<',
  '<=',
  '!=',
  '==',
  '&&',
  '||',
  '=',
  '!',
] as const;
type OperatorString = typeof operatorStrings[number];

const commandStrings = ['loop', 'tempo', 'play', 'sleep'] as const;
export type CommandString = typeof commandStrings[number];

const keywordStrings = [
  'seq',
  'fun',
  'step',
  'return',
  'if',
  'else',
  'while',
  'for',
  'let',
  'nil',
  ...commandStrings,
] as const;
export type KeywordString = typeof keywordStrings[number];

export type EOFToken = {
  type: TokenType.EOF;
};

export type IntegerToken = {
  type: TokenType.Integer;
  value: number;
};

export type FloatToken = {
  type: TokenType.Float;
  value: number;
};

export type PunctuationToken = {
  type: TokenType.Punctuation;
  value: PunctuationString;
};

export type OperatorToken = {
  type: TokenType.Operator;
  value: OperatorString;
};

export type KeywordToken = {
  type: TokenType.Keyword;
  value: KeywordString;
};

export type IdentifierToken = {
  type: TokenType.Identifier;
  value: string;
};

export type BooleanToken = {
  type: TokenType.Boolean;
  value: boolean;
};

export type StringToken = {
  type: TokenType.String;
  value: string;
};

export type Token =
  | EOFToken
  | PunctuationToken
  | IntegerToken
  | OperatorToken
  | KeywordToken
  | IdentifierToken
  | FloatToken
  | BooleanToken
  | StringToken;

export type TokenizerError = {
  type: 'error';
  msg: string;
};

export type Tokenizer = {
  next(): Token | TokenizerError;
  peek(): Token | TokenizerError;
  eof(): boolean;
  line(): number;
  col(): number;
};

export const createTokenizer: (input: InputStream) => Tokenizer = input => {
  let peekedToken: Token | TokenizerError | null = null; // null means that no token has been peeked

  const stringIncludes: (str: string, ch: string) => boolean = (str, ch) =>
    str.indexOf(ch) !== -1;

  // \u00a0 is non-breaking space
  const isWhitespace: (ch: string) => boolean = ch =>
    stringIncludes(' \t\n\r\u00a0', ch);

  const isNotLinefeed: (ch: string) => boolean = ch => ch !== '\n';

  const isDigit: (ch: string) => boolean = ch =>
    stringIncludes('0123456789', ch);

  const isPunctuation: (ch: string) => boolean = ch =>
    punctuationStrings.find((p: PunctuationString) => p === ch) !== undefined;

  const isOperatorChar: (ch: string) => boolean = ch =>
    stringIncludes('!&*+-/:<=>|', ch);

  const isIdentifierStartChar: (ch: string) => boolean = ch =>
    /[a-z_]/i.test(ch);

  const isIdentifierChar: (ch: string) => boolean = ch =>
    isIdentifierStartChar(ch) || stringIncludes('?!-0123456789', ch);

  const ignoreWhile: (
    predicate: (char: string) => boolean
  ) => void = predicate => {
    for (
      let ch = input.peek();
      ch !== EOF && predicate(ch);
      ch = input.peek()
    ) {
      input.next(); // ignore the character
    }
  };

  const readWhile: (
    predicate: (char: string) => boolean
  ) => string = predicate => {
    let str = '';
    for (
      let ch = input.peek();
      ch !== EOF && predicate(ch);
      ch = input.peek()
    ) {
      const ch = input.next();
      if (ch === EOF) return str;
      str += ch;
    }
    return str;
  };

  const skipComment: () => void = () => ignoreWhile(isNotLinefeed);

  // const readInteger: () => IntegerToken = () => {
  //   const number = readWhile(isDigit);
  //   return {type: TokenType.Integer, value: parseInt(number, 10)};
  // };

  const readNumber: () => IntegerToken | FloatToken = () => {
    const integer = readWhile(isDigit);
    const ch = input.peek();
    if (ch === '.') {
      input.next();
      const fractional = readWhile(isDigit);
      return {
        type: TokenType.Float,
        value: parseFloat(`${integer}.${fractional}`),
      };
    } else {
      return {type: TokenType.Integer, value: parseInt(integer, 10)};
    }
  };

  const readPunctuation: () => PunctuationToken | TokenizerError = () => {
    const err: TokenizerError = {
      type: 'error',
      msg: 'EOF while tokenizing punctuation character',
    };

    const ch = input.next();
    if (ch === EOF) return err;

    const puncStr = punctuationStrings.find((p: PunctuationString) => p === ch);
    if (puncStr === undefined) return err;

    return {
      type: TokenType.Punctuation,
      value: puncStr,
    };
  };

  const readOperator: () =>
    | OperatorToken
    | PunctuationToken
    | TokenizerError = () => {
    const op = readWhile(isOperatorChar);
    const opString: OperatorString | undefined = operatorStrings.find(
      (o: OperatorString) => o === op
    );
    if (opString === undefined) {
      // TODO: This is horrible. Move this away from operator function.
      if (op === '|') {
        return {
          type: TokenType.Punctuation,
          value: '|',
        };
      } else {
        return {
          type: 'error',
          msg: `Unrecognized operator ${op} on line ${input.line()} (column ${input.col()})`,
        };
      }
    }

    return {
      type: TokenType.Operator,
      value: opString,
    };
  };

  const readIdentifier: () =>
    | IdentifierToken
    | KeywordToken
    | BooleanToken = () => {
    const value = readWhile(isIdentifierChar);

    if (keywordStrings.some(kw => kw === value)) {
      return {
        type: TokenType.Keyword,
        value: value as KeywordString,
      };
    } else if (value === 'true') {
      return {type: TokenType.Boolean, value: true};
    } else if (value === 'false') {
      return {type: TokenType.Boolean, value: false};
    } else {
      return {
        type: TokenType.Identifier,
        value: value,
      };
    }
  };

  const readString: () => StringToken | TokenizerError = () => {
    input.next(); // " character
    const str = readWhile(c => c !== '"');
    const quote = input.next();
    if (quote !== '"') {
      throw Error('Tokenizer error: unterminated string');
      // return {type: 'error', msg: 'Unterminated string'};
    }
    return {
      type: TokenType.String,
      value: str,
    };
  };

  const readNext: () => Token | TokenizerError = () => {
    ignoreWhile(isWhitespace);

    const ch = input.peek();

    if (ch === EOF) {
      return {type: TokenType.EOF};
    }
    if (ch === '#') {
      skipComment();
      return readNext();
    }
    if (ch === '"') {
      return readString();
    }
    if (isDigit(ch)) {
      return readNumber();
    }
    if (isOperatorChar(ch)) {
      return readOperator();
    }
    if (isPunctuation(ch)) {
      return readPunctuation();
    }
    if (isIdentifierStartChar(ch)) {
      return readIdentifier();
    }

    return {
      type: 'error',
      msg: `Cannot handle character "${ch}" at line ${input.line()} (column ${
        input.col() + 1
      })`,
    };
  };

  const next = () => {
    if (peekedToken !== null) {
      const token = peekedToken;
      peekedToken = null;
      return token;
    }
    return readNext();
  };

  const peek = () => {
    if (peekedToken !== null) return peekedToken;
    peekedToken = readNext();
    return peekedToken;
  };

  return {
    next: next,
    peek: peek,
    eof: () => peek().type === TokenType.EOF,
    line: () => input.line(),
    col: () => input.col(),
  };
};

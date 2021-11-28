import {EOF, InputStream} from './input-stream';

export enum TokenType {
  EOF,
  Integer,
  Punctuation,
  Operator,
  Keyword,
  Identifier,
  Float,
}

const punctuationStrings = ['{', '}', ',', '|', ';', '(', ')'] as const;
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
  ':=',
  '!',
] as const;
type OperatorString = typeof operatorStrings[number];

const commandStrings = ['loop', 'tempo', 'play', 'sleep'] as const;
export type CommandString = typeof commandStrings[number];

const keywordStrings = ['seq', 'fun', ...commandStrings] as const;
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

export type Token =
  | EOFToken
  | PunctuationToken
  | IntegerToken
  | OperatorToken
  | KeywordToken
  | IdentifierToken
  | FloatToken;

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

  const isWhitespace: (ch: string) => boolean = ch =>
    stringIncludes(' \t\n\r', ch);

  const isNotLinefeed: (ch: string) => boolean = ch => ch !== '\n';

  const isDigit: (ch: string) => boolean = ch =>
    stringIncludes('0123456789', ch);

  const isPunctuation: (ch: string) => boolean = ch =>
    punctuationStrings.find((p: PunctuationString) => p === ch) !== undefined;

  const isOperatorChar: (ch: string) => boolean = ch =>
    stringIncludes('=:+-', ch);

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

  const readOperator: () => OperatorToken | TokenizerError = () => {
    const op = readWhile(isOperatorChar);
    const opString: OperatorString | undefined = operatorStrings.find(
      (o: OperatorString) => o === op
    );
    if (opString === undefined) {
      return {
        type: 'error',
        msg: `Unrecognized operator ${op} on line ${input.line()} (column ${input.col()})`,
      };
    }

    return {
      type: TokenType.Operator,
      value: opString,
    };
  };

  const readIdentifier: () => IdentifierToken | KeywordToken = () => {
    const value = readWhile(isIdentifierChar);

    if (keywordStrings.some(kw => kw === value)) {
      return {
        type: TokenType.Keyword,
        value: value as KeywordString,
      };
    } else {
      return {
        type: TokenType.Identifier,
        value: value,
      };
    }
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
    if (isDigit(ch)) {
      return readNumber();
    }
    if (isPunctuation(ch)) {
      return readPunctuation();
    }
    if (isOperatorChar(ch)) {
      return readOperator();
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

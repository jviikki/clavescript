import {
  KeywordString,
  Token,
  Tokenizer,
  TokenizerError,
  TokenType,
} from './tokenizer';

export type Integer = {
  type: 'integer';
  value: number;
};

export type Float = {
  type: 'float';
  value: number;
};

export type Identifier = {
  type: 'identifier';
  name: string;
};

export type StepRest = {
  type: 'step_rest';
};

export type Assignment = {
  type: 'assignment';
  left: Identifier;
  right: Integer | Float | MusicalExpression | Identifier | MusicalProcedure;
};

export type StepSequenceAttribute = Assignment;

export type StepSequence = {
  type: 'step_sequence';
  pattern: (Integer | Identifier | StepRest)[];
  attributes: StepSequenceAttribute[];
};

export type MusicalExpression = StepSequence | MusicalBinaryOperator;

export type MusicalBinaryOperator = {
  type: 'musical_binary';
  operator: ':=:' | ':+:';
  left: MusicalExpression;
  right: MusicalExpression;
};

export type MusicalProcedure = {
  type: 'musical_procedure';
  expressions: Expression[];
};

export type BuiltInCommand = {
  type: 'cmd';
  name: KeywordString;
  arg: MusicalExpression | Identifier | Integer | Float;
};

export type FunctionArgs = Expression[];

export type FunctionCall = {
  type: 'call';
  func: Expression;
  args: FunctionArgs;
};

export type Expression = Assignment | BuiltInCommand | FunctionCall;

export type Block = {
  type: 'block';
  expressions: Expression[];
};

export type ParseError = {
  msg: string;
};

type BindingPower = [number, number];

const getOperatorBindingPower: (op: string) => BindingPower = op => {
  switch (op) {
    case ':=:':
      return [3, 4];
    case ':+:':
      return [1, 2];
    default:
      throw new Error(`Parse error: Unrecognized operator ${op}`);
  }
};

export const parse: (tokenizer: Tokenizer) => Block = tokenizer => {
  const parseInteger: () => Integer = () => {
    const next = tokenizer.next();
    if (next.type !== TokenType.Integer)
      throw new Error(
        `Parse error: Expected integer on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );
    return {
      type: 'integer',
      value: next.value,
    };
  };

  const parseFloat: () => Float = () => {
    const next = tokenizer.next();
    if (next.type !== TokenType.Float)
      throw new Error(
        `Parse error: Expected float on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );
    return {
      type: 'float',
      value: next.value,
    };
  };

  const parseStepSequenceAttributes: () => StepSequenceAttribute[] = () => {
    const assignments: Assignment[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      assignments.push(parseAssignment());
      const token = tokenizer.peek();
      if (token.type === TokenType.Punctuation && token.value === ',') {
        assertPunc(',');
      } else {
        break;
      }
    }
    return assignments;
  };

  const parseStepSequence: () => StepSequence = () => {
    const pattern: (Integer | Identifier | StepRest)[] = [];

    assertPunc('{');
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const token = tokenizer.peek();
      if (token.type === TokenType.Identifier) {
        pattern.push(parseIdentifier());
      } else if (token.type === TokenType.Integer) {
        pattern.push(parseInteger());
      } else if (token.type === TokenType.Operator && token.value === '-') {
        assertOperator('-');
        pattern.push({type: 'step_rest'});
      } else if (
        token.type === TokenType.Punctuation &&
        (token.value === '|' || token.value === '}')
      ) {
        break;
      } else {
        throw new Error(
          `Unable to parse step pattern on line ${tokenizer.line()} (column ${tokenizer.col()})`
        );
      }
    }

    let attributes: StepSequenceAttribute[] = [];
    const nextToken = tokenizer.peek();
    if (nextToken.type === TokenType.Punctuation && nextToken.value === '|') {
      assertPunc('|');
      attributes = parseStepSequenceAttributes();
    }
    assertPunc('}');

    return {
      type: 'step_sequence',
      pattern: pattern,
      attributes: attributes,
    };
  };

  const parseMusicalExpressionWithBP: (
    minBP: number
  ) => MusicalExpression = minBP => {
    let lhs: MusicalExpression | null = null;
    const token = tokenizer.peek();
    switch (token.type) {
      case TokenType.Punctuation:
        if (token.value === '(') {
          assertPunc('(');
          lhs = parseMusicalExpressionWithBP(0);
          assertPunc(')');
          break;
        } else if (token.value === '{') {
          lhs = parseStepSequence();
          break;
        }
        throw new Error(
          `Unexpected token on line ${tokenizer.line()} (column ${tokenizer.col()})`
        );
      default:
        throw new Error(
          `Unexpected token on line ${tokenizer.line()} (column ${tokenizer.col()})`
        );
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const token = tokenizer.peek();
      if (token.type !== TokenType.Operator) break;
      if (token.value !== ':+:' && token.value !== ':=:') break;
      const [leftBP, rightBP] = getOperatorBindingPower(token.value);
      if (leftBP < minBP) break;
      tokenizer.next();
      const rhs = parseMusicalExpressionWithBP(rightBP);
      lhs = {
        type: 'musical_binary',
        operator: token.value,
        left: lhs,
        right: rhs,
      };
    }

    return lhs;
  };

  const parseMusicalExpression: () => MusicalExpression = () =>
    parseMusicalExpressionWithBP(0);

  const parseIdentifier: () => Identifier = () => {
    const next = tokenizer.next();
    if (next.type !== TokenType.Identifier)
      throw new Error(
        `Parse error: Expected identifier on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );
    return {
      type: 'identifier',
      name: next.value,
    };
  };

  const assertSeq: () => void = () => {
    const token = tokenizer.next();
    if (!(token.type === TokenType.Keyword && token.value === 'seq')) {
      throw new Error(
        `Parse error: "seq" expected on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );
    }
  };

  const parseMusicalProcedure: () => MusicalProcedure = () => {
    assertSeq();
    return {
      type: 'musical_procedure',
      expressions: parseDelimitedList('{', '}', ';', parseExpression),
    };
  };

  const parseAssignmentRightValue: () =>
    | Integer
    | Float
    | MusicalExpression
    | Identifier
    | MusicalProcedure = () => {
    const next = tokenizer.peek();
    if (next.type === TokenType.Integer) {
      return parseInteger();
    } else if (next.type === TokenType.Float) {
      return parseFloat();
    } else if (next.type === TokenType.Identifier) {
      return parseIdentifier();
    } else if (next.type === TokenType.Keyword) {
      return parseMusicalProcedure();
    } else {
      return parseMusicalExpression();
    }
  };

  const assertOperator: (op: string) => void = op => {
    const token = tokenizer.next();
    if (token.type !== TokenType.Operator || token.value !== op)
      throw Error(
        `Parse error: Expected operator "${op}" on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );
  };

  const assertPunc: (punc: string) => void = punc => {
    const token = tokenizer.next();
    if (token.type !== TokenType.Punctuation || token.value !== punc)
      throw Error(
        `Parse error: Expected "${punc}" on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );
  };

  const isPunc: (punc: string) => boolean = punc => {
    const token = tokenizer.peek();
    return token.type === TokenType.Punctuation && token.value === punc;
  };

  const parseAssignment: () => Assignment = () => {
    const identifier = parseIdentifier();
    assertOperator(':=');
    return {
      type: 'assignment',
      left: identifier,
      right: parseAssignmentRightValue(),
    };
  };

  const parseBuiltInCommandArg: () =>
    | MusicalExpression
    | Identifier
    | Integer
    | Float = () => {
    const token = tokenizer.peek();
    switch (token.type) {
      case TokenType.Identifier:
        return parseIdentifier();
      case TokenType.Integer:
        return parseInteger();
      case TokenType.Float:
        return parseFloat();
      default:
        throw Error('Unable to parse the build in command argument');
    }
  };

  // TODO: make this specific to the built-in command
  const parseBuiltInCommand: () => BuiltInCommand = () => {
    const token = tokenizer.next();
    if (token.type !== TokenType.Keyword)
      throw new Error(
        `Parse error: Expected a keyword on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );
    return {
      type: 'cmd',
      name: token.value,
      arg: parseBuiltInCommandArg(),
    };
  };

  // const maybeCall: (parseExpr: () => Expression) => Expression = parseExpr => {
  //   const expr = parseExpr();
  //   return isPunc('(') ? parseCall(expr) : expr;
  // };

  const parseCall: (expr: Expression) => FunctionCall = expr => ({
    type: 'call',
    func: expr,
    args: parseDelimitedList('(', ')', ',', parseExpression),
  });

  const parseDelimitedList: <T>(
    start: string,
    stop: string,
    separator: string,
    parser: () => T
  ) => T[] = (start, stop, separator, parser) => {
    const parsedItems = [];
    let first = true;
    assertPunc(start);
    while (!tokenizer.eof()) {
      if (isPunc(stop)) break;
      if (first) {
        first = false;
      } else {
        assertPunc(separator);
      }
      if (isPunc(stop)) break;
      parsedItems.push(parser());
    }
    assertPunc(stop);
    return parsedItems;
  };

  // const parseExpression: () => Expression = () => {
  //   return maybeCall(() => {
  //     const next = tokenizer.peek();
  //     let expression = null;
  //     switch (next.type) {
  //       case TokenType.Identifier:
  //         expression = parseAssignment();
  //         break;
  //       case TokenType.Keyword:
  //         expression = parseBuiltInCommand();
  //         break;
  //       default:
  //         throw new Error('Unable to parse expression');
  //     }
  //     return expression;
  //   });
  // };

  const parseExpressionWithBP: (minBP: number) => Expression = minBP => {
    let lhs: MusicalExpression | null = null;
    const token = tokenizer.peek();
    switch (token.type) {
      case TokenType.Punctuation:
        if (token.value === '(') {
          assertPunc('(');
          lhs = parseMusicalExpressionWithBP(0);
          assertPunc(')');
          break;
        } else if (token.value === '{') {
          lhs = parseStepSequence();
          break;
        }
        throw new Error(
          `Unexpected token on line ${tokenizer.line()} (column ${tokenizer.col()})`
        );
      default:
        throw new Error(
          `Unexpected token on line ${tokenizer.line()} (column ${tokenizer.col()})`
        );
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const token = tokenizer.peek();
      if (token.type !== TokenType.Operator) break;
      if (token.value !== ':+:' && token.value !== ':=:') break;
      const [leftBP, rightBP] = getOperatorBindingPower(token.value);
      if (leftBP < minBP) break;
      tokenizer.next();
      const rhs = parseMusicalExpressionWithBP(rightBP);
      lhs = {
        type: 'musical_binary',
        operator: token.value,
        left: lhs,
        right: rhs,
      };
    }

    return lhs;
  };

  const parseExpression: () => Expression = () =>
    parseExpressionWithBP(0);

  const parseExpressions: () => Expression[] = () =>
    parseExpressionsUntil(() => false); // Parse until EOF

  const parseExpressionsUntil: (
    predicate: (nextToken: Token | TokenizerError) => boolean
  ) => Expression[] = predicate => {
    const expressions: Expression[] = [];

    for (;;) {
      const next = tokenizer.peek();

      if (next.type === TokenType.EOF || predicate(next)) {
        return expressions;
      }

      expressions.push(parseExpression());
      assertPunc(';');
    }
  };

  const parseBlock: () => Block = () => {
    return {
      type: 'block',
      expressions: parseExpressions(),
    };
  };

  return parseBlock();
};

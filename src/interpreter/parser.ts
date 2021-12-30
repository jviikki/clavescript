import {
  CommandString,
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

export type BooleanLiteral = {
  type: 'boolean';
  value: boolean;
};

export type Identifier = {
  type: 'identifier';
  name: string;
};

export type Assignment = {
  type: 'assignment';
  left: Identifier;
  right: Expression;
};

export type StepSequenceAttribute = Assignment;

export type StepRest = {
  type: 'step_rest';
};

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
  statements: Statement[];
};

export type BuiltInCommand = {
  type: 'cmd';
  name: CommandString;
  arg: Expression;
};

export type FunctionDefinition = {
  type: 'fun';
  params: string[];
  body: Statement[];
};

export type FunctionArgs = Expression[];

export type FunctionCall = {
  type: 'call';
  func: Expression;
  args: FunctionArgs;
};

export type BinaryOperatorType =
  | '/'
  | '*'
  | '+'
  | '-'
  | '>'
  | '>='
  | '<'
  | '<='
  | '!='
  | '=='
  | '&&'
  | '||'
  | ':='
  | ':=:'
  | ':+:';

export type BinaryOperator = {
  type: 'binary_operator';
  operator: BinaryOperatorType;
  left: Expression;
  right: Expression;
};

export type UnaryOperatorType = '!' | '-';

export type UnaryOperator = {
  type: 'unary_operator';
  operator: UnaryOperatorType;
  operand: Expression;
};

export type Expression =
  | BinaryOperator
  | UnaryOperator
  | FunctionDefinition
  | FunctionCall
  | MusicalProcedure
  | StepSequence
  | Identifier
  | Integer
  | Float
  | BooleanLiteral;

export type ReturnStmt = {
  type: 'return';
  value: Expression;
};

export type IfStmt = {
  type: 'if';
  condition: Expression;
  body: Block | Statement;
  else: Block | Statement | undefined;
};

export type WhileStmt = {
  type: 'while';
  body: Block;
};

export type Statement =
  | BuiltInCommand
  | Expression
  | ReturnStmt
  | IfStmt
  | WhileStmt
  | Block;

export type Block = {
  type: 'block';
  statements: Statement[];
};

export type Program = {
  type: 'program';
  statements: Statement[];
};

type BindingPower = [number, number];

export const parse: (tokenizer: Tokenizer) => Program = tokenizer => {
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

  const parseBoolean: () => BooleanLiteral = () => {
    const next = tokenizer.next();
    if (next.type !== TokenType.Boolean)
      throw new Error(
        `Parse error: Expected boolean on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );
    return {
      type: 'boolean',
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

    const t = tokenizer.next();
    if (t.type !== TokenType.Keyword || t.value !== 'step')
      throw new Error(
        `Unable to parse step pattern on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );

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
    assertPunc('{');
    const statements = parseBlockStatements();
    assertPunc('}');
    return {
      type: 'musical_procedure',
      statements: statements,
    };
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
      right: parseExpression(),
    };
  };

  // TODO: make this specific to the built-in command
  const parseBuiltInCommand: () => BuiltInCommand = () => {
    const token = tokenizer.next();
    if (
      !(
        token.type === TokenType.Keyword &&
        (token.value === 'loop' ||
          token.value === 'tempo' ||
          token.value === 'play' ||
          token.value === 'sleep')
      )
    ) {
      throw new Error(
        `Parse error: Expected a command on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );
    }
    const expr = parseExpression();
    assertPunc(';');
    return {
      type: 'cmd',
      name: token.value,
      arg: expr,
    };
  };

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

  const assertFun: () => void = () => {
    const token = tokenizer.next();
    if (!(token.type === TokenType.Keyword && token.value === 'fun')) {
      throw new Error(
        `Parse error: "fun" expected on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );
    }
  };

  const parseFunctionDefinition: () => FunctionDefinition = () => {
    assertFun();
    const params = parseDelimitedList(
      '(',
      ')',
      ',',
      () => parseIdentifier().name
    );
    assertPunc('{');
    const body = parseBlockStatements();
    assertPunc('}');
    return {
      type: 'fun',
      params: params,
      body: body,
    };
  };

  const getPrefixOperatorBindingPower: (op: string) => BindingPower = op => {
    switch (op) {
      case '!':
        return [0, 16];
      case '-':
        return [0, 16];
      default:
        throw new Error(`Parse error: Unrecognized operator ${op}`);
    }
  };

  const getPostfixOperatorBindingPower: (op: '(') => BindingPower = op => {
    switch (op) {
      case '(':
        return [17, 0];
      default:
        throw new Error(`Parse error: Unrecognized operator ${op}`);
    }
  };

  const getInfixOperatorBindingPower: (
    op: BinaryOperatorType
  ) => BindingPower | null = op => {
    switch (op) {
      case ':=:':
        return [3, 4];
      case ':+:':
        return [1, 2];
      case '/':
      case '*':
        return [13, 14];
      case '+':
      case '-':
        return [11, 12];
      case '>':
      case '>=':
      case '<':
      case '<=':
        return [9, 10];
      case '!=':
      case '==':
        return [7, 8];
      case '&&':
        return [5, 6];
      case '||':
        return [3, 4];
      case ':=':
        return [2, 1];
      default:
        return null;
    }
  };

  const parseExpressionKeyword: () =>
    | StepSequence
    | FunctionDefinition
    | MusicalProcedure = () => {
    const token = tokenizer.peek();
    if (token.type !== TokenType.Keyword)
      throw new Error(
        `Parse error: Expected a keyword on line ${tokenizer.line()} (column ${tokenizer.col()})`
      );
    switch (token.value) {
      case 'step':
        return parseStepSequence();
      case 'fun':
        return parseFunctionDefinition();
      case 'seq':
        return parseMusicalProcedure();
      default:
        throw new Error(
          `Parse error: Expected a step sequence or function declaration on line ${tokenizer.line()} (column ${tokenizer.col()})`
        );
    }
  };

  const parseExpressionWithBP: (minBP: number) => Expression = minBP => {
    let lhs: Expression | null = null;
    const token = tokenizer.peek();
    switch (token.type) {
      case TokenType.Identifier:
        lhs = parseIdentifier();
        break;
      case TokenType.Float:
        lhs = parseFloat();
        break;
      case TokenType.Integer:
        lhs = parseInteger();
        break;
      case TokenType.Boolean:
        lhs = parseBoolean();
        break;
      case TokenType.Keyword:
        lhs = parseExpressionKeyword();
        break;
      case TokenType.Punctuation:
        if (token.value === '(') {
          assertPunc('(');
          lhs = parseExpressionWithBP(0);
          assertPunc(')');
          break;
        }
        throw new Error(
          `Unexpected token on line ${tokenizer.line()} (column ${tokenizer.col()})`
        );
      case TokenType.Operator:
        {
          // Prefix operators
          if (token.value !== '!' && token.value !== '-')
            throw new Error(
              `Unexpected token on line ${tokenizer.line()} (column ${tokenizer.col()})`
            );
          const rbp = getPrefixOperatorBindingPower(token.value);
          tokenizer.next();
          lhs = {
            type: 'unary_operator',
            operator: token.value,
            operand: parseExpressionWithBP(rbp[1]),
          };
        }
        break;
      default:
        throw new Error(
          `Unexpected token on line ${tokenizer.line()} (column ${tokenizer.col()})`
        );
    }

    for (;;) {
      const op = tokenizer.peek();

      // Postfix operators
      if (op.type === TokenType.Punctuation && op.value === '(') {
        const bp = getPostfixOperatorBindingPower(op.value);
        if (bp[0] < minBP) break;
        lhs = parseCall(lhs);
        continue;
      }

      // Infix operators
      if (op.type !== TokenType.Operator) break;
      if (op.value === '!') break;
      const bp = getInfixOperatorBindingPower(op.value);
      if (!bp) break;
      const [leftBP, rightBP] = bp;
      if (leftBP < minBP) break;
      tokenizer.next();
      const rhs = parseExpressionWithBP(rightBP);
      lhs = {
        type: 'binary_operator',
        operator: op.value,
        left: lhs,
        right: rhs,
      };
    }

    return lhs;
  };

  const parseExpression: () => Expression = () => parseExpressionWithBP(0);

  const parseReturnStatement: () => ReturnStmt = () => {
    tokenizer.next();
    const expr = parseExpression();
    assertPunc(';');
    return {
      type: 'return',
      value: expr,
    };
  };

  const parseIfStatement: () => IfStmt = () => {
    tokenizer.next(); // if keyword
    assertPunc('(');
    const condition = parseExpression();
    assertPunc(')');
    const body = parseBlockOrStmt();

    const next = tokenizer.peek();
    let elseBlock: Block | Statement | undefined = undefined;
    if (next.type === TokenType.Keyword && next.value === 'else') {
      tokenizer.next();
      elseBlock = parseBlockOrStmt();
    }

    return {
      type: 'if',
      condition: condition,
      body: body,
      else: elseBlock,
    };
  };

  const parseExpressionStmt: () => Expression = () => {
    const expr = parseExpression();
    assertPunc(';');
    return expr;
  };

  const parseStatement: () => Statement = () => {
    const next = tokenizer.peek();
    switch (next.type) {
      case TokenType.Keyword:
        if (next.value === 'fun' || next.value === 'step')
          return parseExpressionStmt();
        else if (next.value === 'return') return parseReturnStatement();
        else if (next.value === 'if') return parseIfStatement();
        // else if (next.value === 'while') return parseWhileStatement();
        // else if (next.value === 'for') return parseForStatement();
        else return parseBuiltInCommand();
      default:
        return parseExpressionStmt();
    }
  };

  const parseStatementsUntil: (
    predicate: (nextToken: Token | TokenizerError) => boolean
  ) => Statement[] = predicate => {
    const statements: Statement[] = [];

    for (;;) {
      const next = tokenizer.peek();

      if (predicate(next)) {
        return statements;
      }

      statements.push(parseStatement());
    }
  };

  const parseProgramStatements: () => Statement[] = () => {
    return parseStatementsUntil(nextToken => nextToken.type === TokenType.EOF);
  };

  const parseBlockStatements: () => Statement[] = () => {
    return parseStatementsUntil(
      nextToken =>
        nextToken.type === TokenType.Punctuation && nextToken.value === '}'
    );
  };

  const parseBlockOrStmt: () => Block | Statement = () => {
    const token = tokenizer.peek();
    if (token.type === TokenType.Punctuation && token.value === '{') {
      return parseBlock();
    } else {
      return parseStatement();
    }
  };

  const parseBlock: () => Block = () => {
    assertPunc('{');
    const statements = parseBlockStatements();
    assertPunc('}');

    return {
      type: 'block',
      statements: statements,
    };
  };

  const parseProgram: () => Program = () => {
    return {
      type: 'program',
      statements: parseProgramStatements(),
    };
  };

  return parseProgram();
};

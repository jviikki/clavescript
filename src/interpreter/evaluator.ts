import {
  BuiltInCommand,
  Float,
  Identifier,
  Integer,
  MusicalBinaryOperator,
  MusicalExpression,
  MusicalProcedure,
  Block,
  StepSequence,
  Expression,
  FunctionCall,
  FunctionDefinition,
  Statement,
  BinaryOperator,
  UnaryOperator,
  BooleanLiteral,
  Program,
  IfStmt,
  WhileStmt,
  ReturnStmt,
  ArrayLiteral,
  ArrayIndexOperator,
} from './parser';
import {
  EventSourceSequence,
  MusicalEventSource,
  Sequence,
  Sequencer,
  sequenceToEventSource,
} from '../music/sequencer';
import {initializeBuiltInFunctions} from './built-in-functions';

export type Evaluator = {
  evaluate(p: Program): void;
};

type VariableNumber = {type: 'number'; value: number};
type VariableSequence = {type: 'sequence'; value: Sequence};
type VariableMusicalEventSource = {
  type: 'musical_event_source';
  value: MusicalEventSource;
};
type VariableFunctionDefinition = {type: 'fun'; value: FunctionDefinition};
type VariableBuiltInFunction = {
  type: 'internal';
  name: string;
  value: (...args: VariableValue[]) => VariableValue;
};
type VariableBoolean = {type: 'boolean'; value: boolean};
type VariableArray = {type: 'array'; items: VariableValue[]};
type VariableNil = {type: 'nil'};

export type VariableValue =
  | VariableNumber
  | VariableSequence
  | VariableMusicalEventSource
  | VariableFunctionDefinition
  | VariableBuiltInFunction
  | VariableBoolean
  | VariableArray
  | VariableNil;

export type Environment = {
  extend(): Environment;
  getParent(): Environment | null;
  lookup(name: string): Environment | null;
  isInCurrentScope(name: string): boolean;
  get(name: string): VariableValue;
  set(name: string, value: VariableValue): void;
  def(name: string, value: VariableValue): void;
  logVariables(): void;
};

type Scope = {
  [name: string]: VariableValue;
};

const createEnvironment: (
  parent?: Environment | null,
  vars?: Scope
) => Environment = (parent = null, scope = {}) => {
  const env = {
    extend(): Environment {
      return createEnvironment(env, Object.create(scope));
    },

    getParent(): Environment | null {
      return parent;
    },

    lookup(name: string): Environment | null {
      let currentScope: Environment | null = env;
      while (currentScope) {
        if (currentScope.isInCurrentScope(name)) return currentScope;
        currentScope = currentScope.getParent();
      }
      return null;
    },

    isInCurrentScope(name: string): boolean {
      return Object.prototype.hasOwnProperty.call(scope, name);
    },

    get(name: string): VariableValue {
      return scope[name];
    },

    set(name: string, value: VariableValue): void {
      const scope = env.lookup(name);
      if (scope) {
        scope.def(name, value);
      } else {
        env.def(name, value);
      }
    },

    def(name: string, value: VariableValue): void {
      scope[name] = value;
    },

    logVariables(): void {
      console.log(scope);
    },
  };

  return env;
};

type Context = {
  env: Environment;
  seq: Sequence;
  playheadPosition: number;
  playUntil: number;
};

type SequenceAndPlayheadPos = {
  sequence: Sequence;
  playheadPos: number;
};

type EventGen<T> = Generator<SequenceAndPlayheadPos, T, number>;

function runGenerator<T>(gen: EventGen<T>): T {
  for (;;) {
    const val = gen.next(Number.MAX_VALUE);
    if (val.done) {
      return val.value;
    }
  }
}

export const createEvaluator: (
  sequencer: Sequencer
) => Evaluator = sequencer => {
  class ReturnValue {
    value: VariableValue;

    constructor(value: VariableValue) {
      this.value = value;
    }
  }

  const ctx: Context = {
    env: createEnvironment(),
    seq: [],
    playheadPosition: 0,
    playUntil: 0,
  };

  initializeBuiltInFunctions(ctx.env);

  const evaluateIdentifier: (ctx: Context, exp: Identifier) => VariableValue = (
    ctx,
    exp
  ) => ctx.env.get(exp.name);

  const evaluateInteger: (exp: Integer) => VariableNumber = exp => ({
    type: 'number',
    value: exp.value,
  });

  const evaluateFloat: (exp: Float) => VariableNumber = exp => ({
    type: 'number',
    value: exp.value,
  });

  const evaluateIdentifierAsSequence: (
    ctx: Context,
    exp: Identifier
  ) => Sequence | MusicalEventSource = (ctx, exp) => {
    const id = evaluateIdentifier(ctx, exp);
    if (id === undefined || id === null)
      throw Error(`Undefined variable: ${exp.name}`);
    if (id.type === 'sequence' || id.type === 'musical_event_source')
      return id.value;
    else throw Error('Identifier must be a sequence');
  };

  // eslint-disable-next-line require-yield
  function* evaluatePlay(ctx: Context, stmt: BuiltInCommand): EventGen<void> {
    const pitch = yield* evaluateExpression(ctx, stmt.arg);
    if (pitch.type !== 'number')
      throw Error('Play only accepts a number as argument');

    ctx.seq.push({
      type: 'NOTE',
      startTime: ctx.playheadPosition,
      duration: 0.25,
      volume: 64,
      pitch: pitch.value,
      instrument: 'audio',
    });
    ctx.seq.push({
      type: 'NOTE',
      startTime: ctx.playheadPosition,
      duration: 0.25,
      volume: 64,
      pitch: pitch.value,
      instrument: 'midi',
    });
  }

  function* evaluateSleep(ctx: Context, stmt: BuiltInCommand): EventGen<void> {
    const arg = yield* evaluateExpression(ctx, stmt.arg);

    if (arg.type !== 'number')
      throw Error('Sleep command only accepts numbers');

    ctx.playheadPosition += arg.value;

    while (ctx.playheadPosition > ctx.playUntil) {
      ctx.playUntil = yield {
        sequence: ctx.seq,
        playheadPos: ctx.playheadPosition,
      };
      ctx.seq = [];
    }
  }

  function* evaluateCallToBuiltInFunction(
    ctx: Context,
    call: FunctionCall,
    fun: VariableBuiltInFunction
  ): EventGen<VariableValue> {
    if (call.args.length !== fun.value.length)
      throw Error(
        `Built-in function ${fun.name} expects ${fun.value.length} arguments. ${call.args.length} arguments provided.`
      );
    const args: VariableValue[] = [];
    for (const arg of call.args) {
      args.push(yield* evaluateExpression(ctx, arg));
    }
    return fun.value(...args);
  }

  function* evaluateFunctionCall(
    ctx: Context,
    expr: FunctionCall
  ): EventGen<VariableValue> {
    const func = yield* evaluateExpression(ctx, expr.func);

    if (func.type === 'internal') {
      return yield* evaluateCallToBuiltInFunction(ctx, expr, func);
    }

    if (func.type !== 'fun') {
      throw Error('Attempting to call a non-function');
    }

    if (func.value.params.length !== expr.args.length) {
      throw Error(
        `Number of arguments provided: ${expr.args.length}, expected: ${func.value.params.length}`
      );
    }

    const oldEnv = ctx.env;
    ctx.env = ctx.env.extend();

    for (let i = 0; i < expr.args.length; i++) {
      ctx.env.set(
        func.value.params[i],
        yield* evaluateExpression(ctx, expr.args[i])
      );
    }

    try {
      yield* evaluateFunctionBody(ctx, func.value.body);
    } catch (ex) {
      if (ex instanceof ReturnValue) {
        ctx.env = oldEnv;
        return ex.value;
      } else {
        throw ex;
      }
    }

    ctx.env = oldEnv;
    return {type: 'nil'};
  }

  // eslint-disable-next-line require-yield
  function evaluateFunctionDefinition(
    ctx: Context,
    stmt: FunctionDefinition
  ): VariableFunctionDefinition {
    return {
      type: 'fun',
      value: stmt,
    };
  }

  function* evaluateFunctionBody(
    ctx: Context,
    statements: Statement[]
  ): EventGen<void> {
    for (const stmt of statements) {
      yield* evaluateStmt(ctx, stmt);
    }
  }

  const evaluateMusicalProcedure: (
    ctx: Context,
    exp: MusicalProcedure
  ) => MusicalEventSource = (ctx, exp) => {
    function* evaluatorGenerator(
      ctx: Context
    ): EventGen<SequenceAndPlayheadPos> {
      ctx.playUntil = yield {
        sequence: ctx.seq,
        playheadPos: ctx.playheadPosition,
      };

      yield* evaluateBlock(ctx, exp);

      return {
        sequence: ctx.seq,
        playheadPos: ctx.playheadPosition,
      };
    }

    let isDone = false;
    let evaluator = evaluatorGenerator({
      env: ctx.env.extend(),
      seq: [],
      playheadPosition: 0,
      playUntil: 0,
    });
    evaluator.next(0);
    let currentPlayheadPos = 0;

    return {
      restart() {
        isDone = false;
        evaluator = evaluatorGenerator({
          env: ctx.env.extend(),
          seq: [],
          playheadPosition: 0,
          playUntil: 0,
        });
        evaluator.next(0);
        currentPlayheadPos = 0;
      },

      getEventsUntil(playheadPos: number): EventSourceSequence {
        if (isDone)
          return {
            events: [],
            done: true,
            currentPlayheadPos: currentPlayheadPos,
          };
        const nextEvents = evaluator.next(playheadPos);
        isDone = nextEvents.done || false;
        currentPlayheadPos = nextEvents.value.playheadPos;
        return {
          events: nextEvents.value.sequence,
          done: isDone,
          currentPlayheadPos: currentPlayheadPos,
        };
      },
    };
  };

  const evaluateMusicalExpression: (
    exp: MusicalExpression
  ) => Sequence = exp => {
    switch (exp.type) {
      case 'step_sequence':
        return evaluateStepSequence(exp);
      case 'musical_binary':
        return evaluateMusicalBinaryOperator(exp);
    }
  };

  const evaluateStepSequence: (exp: StepSequence) => Sequence = exp => {
    const attrs: {[name: string]: number} = exp.attributes.reduce(
      (acc, attr) => {
        if (attr.right.type !== 'integer') throw Error('Must be integer');
        const val = attr.right.value;
        return {...acc, [attr.left.name]: val};
      },
      {}
    );

    const seq: Sequence = [];
    let startTime = 0;
    exp.pattern.forEach(step => {
      let pitch = 0;
      if (step.type === 'step_rest') {
        startTime += 0.25;
        return;
      } else if (step.type === 'integer') {
        pitch = step.value;
      } else if (step.type === 'identifier') {
        pitch = attrs[step.name];
        if (pitch === undefined)
          throw Error(`Unknown identifier: ${step.name}`);
      }
      seq.push({
        type: 'NOTE',
        duration: 0.25,
        instrument: 'audio',
        pitch: pitch,
        volume: 64,
        startTime: startTime,
      });
      seq.push({
        type: 'NOTE',
        duration: 0.25,
        instrument: 'midi',
        pitch: pitch,
        volume: 64,
        startTime: startTime,
      });
      startTime += 0.25;
    });
    return seq;
  };

  const evaluateMusicalBinaryOperator: (
    exp: MusicalBinaryOperator
  ) => Sequence = exp => {
    switch (exp.operator) {
      case ':+:':
        return evaluateMusicalSequenceOperator(exp);
      case ':=:':
        return evaluateMusicalStackOperator(exp);
    }
  };

  const evaluateMusicalSequenceOperator: (
    exp: MusicalBinaryOperator
  ) => Sequence = exp => {
    const seqLeft: Sequence = evaluateMusicalExpression(exp.left);
    const seqRight: Sequence = evaluateMusicalExpression(exp.right);

    if (seqLeft.length === 0) return seqRight;

    const lastNote = seqLeft[seqLeft.length - 1];
    if (lastNote.type === 'PITCH_BEND') return seqRight; // TODO: find last note
    const offset = lastNote.startTime + lastNote.duration;

    return seqLeft.concat(
      seqRight.map(n => {
        if (n.type === 'PITCH_BEND') {
          return {...n, time: n.time + offset};
        } else {
          return {...n, startTime: n.startTime + offset};
        }
      })
    );
  };

  const evaluateMusicalStackOperator: (
    exp: MusicalBinaryOperator
  ) => Sequence = exp => {
    const seqLeft: Sequence = evaluateMusicalExpression(exp.left);
    const seqRight: Sequence = evaluateMusicalExpression(exp.right);

    return seqLeft.concat(seqRight).sort((a, b) => {
      if (a.type === 'PITCH_BEND' || b.type === 'PITCH_BEND') return 0;
      return a.startTime - b.startTime;
    });
  };

  function* evaluateTempo(ctx: Context, exp: BuiltInCommand): EventGen<void> {
    const arg = yield* evaluateExpression(ctx, exp.arg);
    if (arg.type !== 'number')
      throw Error('Tempo only accepts numbers as argument');

    sequencer.setTempo(arg.value);
  }

  function* evaluateCmd(ctx: Context, exp: BuiltInCommand): EventGen<void> {
    switch (exp.name) {
      case 'loop':
        if (exp.arg.type === 'identifier') {
          const seq = evaluateIdentifierAsSequence(ctx, exp.arg);
          // TODO: ID of the loop is now the variable name. Set this separately.
          sequencer.setLoop(
            exp.arg.name,
            seq instanceof Array ? sequenceToEventSource(seq) : seq
          );
        }
        break;
      case 'tempo':
        yield* evaluateTempo(ctx, exp);
        break;
      case 'play':
        yield* evaluatePlay(ctx, exp);
        break;
      case 'sleep':
        yield* evaluateSleep(ctx, exp);
        break;
      default:
        throw Error('Unrecognized statement');
    }
  }

  function* evaluateUnaryOperator(
    ctx: Context,
    exp: UnaryOperator
  ): EventGen<VariableValue> {
    const value = yield* evaluateExpression(ctx, exp.operand);
    switch (exp.operator) {
      case '!': {
        if (value.type !== 'boolean') throw Error('Expecting a boolean');
        return {type: 'boolean', value: !value.value};
      }
      case '-': {
        if (value.type !== 'number') throw Error('Expecting a number');
        return {type: 'number', value: -value.value};
      }
    }
  }

  const evaluateBoolean: (exp: BooleanLiteral) => VariableBoolean = exp => ({
    type: 'boolean',
    value: exp.value,
  });

  function* evaluateAddition(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableNumber | VariableArray> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);
    if (left.type === 'number' && right.type === 'number') {
      return {type: 'number', value: left.value + right.value};
    } else if (left.type === 'array' && right.type === 'array') {
      return {type: 'array', items: [...left.items, ...right.items]};
    } else {
      throw Error('Operands of + operator should be numbers');
    }
  }

  function* evaluateSubtraction(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableNumber> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);
    if (left.type !== 'number' || right.type !== 'number')
      throw Error('Operands of - operator should be numbers');
    return {type: 'number', value: left.value - right.value};
  }

  function* evaluateSequenceOperator(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableSequence> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);
    if (left.type !== 'sequence' || right.type !== 'sequence') {
      throw Error('Operands of :+: operator should be sequences');
    }

    if (left.value.length === 0) return right;

    const lastNote = left.value[left.value.length - 1];
    if (lastNote.type === 'PITCH_BEND') return right; // TODO: find last note
    const offset = lastNote.startTime + lastNote.duration;

    return {
      type: 'sequence',
      value: left.value.concat(
        right.value.map(n => {
          if (n.type === 'PITCH_BEND') {
            return {...n, time: n.time + offset};
          } else {
            return {...n, startTime: n.startTime + offset};
          }
        })
      ),
    };
  }

  function* evaluateUnequalTo(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableBoolean> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);
    if (
      (left.type === 'number' && right.type === 'number') ||
      (left.type === 'boolean' && right.type === 'boolean')
    ) {
      return {type: 'boolean', value: left.value !== right.value};
    }

    throw Error('Comparison != between incompatible types');
  }

  function* evaluateLogicalAnd(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableBoolean> {
    const left = yield* evaluateExpression(ctx, exp.left);
    if (left.type !== 'boolean')
      throw Error('First operand of && operator should be a boolean');
    if (!left.value) return {type: 'boolean', value: false};
    const right = yield* evaluateExpression(ctx, exp.right);
    if (right.type !== 'boolean')
      throw Error('Second operand of && operator should be a boolean');
    return {type: 'boolean', value: left.value && right.value};
  }

  function* evaluateMultiplication(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableNumber> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);
    if (left.type !== 'number' || right.type !== 'number')
      throw Error('Operands of - operator should be numbers');
    return {type: 'number', value: left.value * right.value};
  }

  function* evaluateDivision(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableNumber> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);
    if (left.type !== 'number' || right.type !== 'number')
      throw Error('Operands of - operator should be numbers');
    if (left.value === 0) throw Error('Division by zero');
    return {type: 'number', value: left.value / right.value};
  }

  function* evaluateAssignmentToArrayIndex(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableArray> {
    if (exp.left.type !== 'index') throw Error('Array indexing expected');
    const value = yield* evaluateExpression(ctx, exp.right);
    const index = yield* evaluateExpression(ctx, exp.left.index);
    if (index.type !== 'number' || !Number.isInteger(index.value))
      throw Error('Arrays must be indexed with integers');
    const array = yield* evaluateExpression(ctx, exp.left.array);
    if (array.type !== 'array') {
      throw Error('Trying to index a type that is not an array');
    }
    if (index.value < 0 || index.value >= array.items.length) {
      throw Error(`Index ${index.value} outside of array bounds`);
    }

    array.items[index.value] = value;
    if (exp.left.array.type === 'identifier')
      ctx.env.set(exp.left.array.name, array);
    return array;
  }

  function* evaluateAssignment(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableValue> {
    if (exp.left.type === 'identifier') {
      const value = yield* evaluateExpression(ctx, exp.right);
      const currentValue = ctx.env.get(exp.left.name);
      if (currentValue && currentValue.type === 'internal') {
        // TODO: Allow overwriting if internal function is not in global scope.
        // E.g. it has been assigned to a variable.
        throw Error(
          `Unable to overwrite a built-in function: ${currentValue.name}`
        );
      }
      // if (value.type === 'internal')
      //   throw Error(
      //     `Cannot assign built-in function ${value.name} to a variable`
      //   );
      ctx.env.set(exp.left.name, value);
      return value;
    } else if (exp.left.type === 'index') {
      return yield* evaluateAssignmentToArrayIndex(ctx, exp);
    } else {
      throw Error('Left operand of assignment = needs to be an identifier');
    }
  }

  function* evaluateStackOperator(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableSequence> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);

    if (left.type !== 'sequence' || right.type !== 'sequence') {
      throw Error('Operands of :+: operator should be sequences');
    }

    return {
      type: 'sequence',
      value: left.value.concat(right.value).sort((a, b) => {
        if (a.type === 'PITCH_BEND' || b.type === 'PITCH_BEND') return 0;
        return a.startTime - b.startTime;
      }),
    };
  }

  function* evaluateLessThan(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableBoolean> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);
    if (left.type === 'number' && right.type === 'number') {
      return {type: 'boolean', value: left.value < right.value};
    }
    throw Error('Comparison < between incompatible types');
  }

  function* evaluateLessThanOrEqualTo(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableBoolean> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);
    if (left.type === 'number' && right.type === 'number') {
      return {type: 'boolean', value: left.value <= right.value};
    }
    throw Error('Comparison <= between incompatible types');
  }

  function* evaluateEqualTo(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableBoolean> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);
    if (left.type === 'number' && right.type === 'number') {
      return {type: 'boolean', value: left.value === right.value};
    }

    throw Error('Comparison == between incompatible types');
  }

  function* evaluateGreaterThan(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableBoolean> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);
    if (left.type === 'number' && right.type === 'number') {
      return {type: 'boolean', value: left.value > right.value};
    }
    throw Error('Comparison > between incompatible types');
  }

  function* evaluateGreaterThanOrEqualTo(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableBoolean> {
    const left = yield* evaluateExpression(ctx, exp.left);
    const right = yield* evaluateExpression(ctx, exp.right);
    if (left.type === 'number' && right.type === 'number') {
      return {type: 'boolean', value: left.value >= right.value};
    }
    throw Error('Comparison >= between incompatible types');
  }

  function* evaluateLogicalOr(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableBoolean> {
    const left = yield* evaluateExpression(ctx, exp.left);
    if (left.type !== 'boolean')
      throw Error('First operand of || operator should be a boolean');
    if (left.value) return {type: 'boolean', value: true};
    const right = yield* evaluateExpression(ctx, exp.right);
    if (right.type !== 'boolean')
      throw Error('Second operand of && operator should be a boolean');
    return {type: 'boolean', value: left.value || right.value};
  }

  function* evaluateBinaryOperator(
    ctx: Context,
    exp: BinaryOperator
  ): EventGen<VariableValue> {
    switch (exp.operator) {
      case '-':
        return yield* evaluateSubtraction(ctx, exp);
      case ':+:':
        return yield* evaluateSequenceOperator(ctx, exp);
      case '!=':
        return yield* evaluateUnequalTo(ctx, exp);
      case '&&':
        return yield* evaluateLogicalAnd(ctx, exp);
      case '*':
        return yield* evaluateMultiplication(ctx, exp);
      case '+':
        return yield* evaluateAddition(ctx, exp);
      case '/':
        return yield* evaluateDivision(ctx, exp);
      case '=':
        return yield* evaluateAssignment(ctx, exp);
      case ':=:':
        return yield* evaluateStackOperator(ctx, exp);
      case '<':
        return yield* evaluateLessThan(ctx, exp);
      case '<=':
        return yield* evaluateLessThanOrEqualTo(ctx, exp);
      case '==':
        return yield* evaluateEqualTo(ctx, exp);
      case '>':
        return yield* evaluateGreaterThan(ctx, exp);
      case '>=':
        return yield* evaluateGreaterThanOrEqualTo(ctx, exp);
      case '||':
        return yield* evaluateLogicalOr(ctx, exp);
    }
  }

  function* evaluateArrayLiteral(
    ctx: Context,
    exp: ArrayLiteral
  ): EventGen<VariableArray> {
    const items = [];
    for (const item of exp.items) {
      items.push(yield* evaluateExpression(ctx, item));
    }
    return {
      type: 'array',
      items: items,
    };
  }

  function* evaluateArrayIndex(
    ctx: Context,
    exp: ArrayIndexOperator
  ): EventGen<VariableValue> {
    const array = yield* evaluateExpression(ctx, exp.array);
    if (array.type !== 'array') {
      throw Error('Only arrays can be indexed');
    }
    const index = yield* evaluateExpression(ctx, exp.index);
    if (index.type !== 'number' || !Number.isInteger(index.value)) {
      throw Error('Arrays can only be indexed with integers');
    }
    if (index.value < 0 || index.value >= array.items.length) {
      throw Error(`Index ${index.value} outside of array bounds`);
    }

    return array.items[index.value];
  }

  function* evaluateExpression(
    ctx: Context,
    exp: Expression
  ): EventGen<VariableValue> {
    switch (exp.type) {
      case 'boolean':
        return evaluateBoolean(exp);
      case 'integer':
        return evaluateInteger(exp);
      case 'float':
        return evaluateFloat(exp);
      case 'identifier':
        return evaluateIdentifier(ctx, exp);
      case 'step_sequence':
        // TODO: change function to return correct value
        return {type: 'sequence', value: evaluateStepSequence(exp)};
      case 'unary_operator':
        return yield* evaluateUnaryOperator(ctx, exp);
      case 'binary_operator':
        return yield* evaluateBinaryOperator(ctx, exp);
      case 'fun':
        return evaluateFunctionDefinition(ctx, exp);
      case 'call':
        return yield* evaluateFunctionCall(ctx, exp);
      case 'musical_procedure':
        return {
          type: 'musical_event_source',
          value: evaluateMusicalProcedure(ctx, exp),
        };
      case 'array_literal':
        return yield* evaluateArrayLiteral(ctx, exp);
      case 'index':
        return yield* evaluateArrayIndex(ctx, exp);
    }
  }

  function* evaluateIfStmt(ctx: Context, stmt: IfStmt): EventGen<void> {
    const cond = yield* evaluateExpression(ctx, stmt.condition);
    if (cond.type !== 'boolean') {
      throw Error('The condition of if statement must evaluate to a boolean');
    }

    if (cond.value) {
      return yield* evaluateStmt(ctx, stmt.body);
    }

    if (stmt.else) {
      return yield* evaluateStmt(ctx, stmt.else);
    }
  }

  function* evaluateWhileStmt(ctx: Context, stmt: WhileStmt): EventGen<void> {
    function* shouldContinue(): EventGen<boolean> {
      const cond = yield* evaluateExpression(ctx, stmt.condition);

      if (cond.type !== 'boolean') {
        throw Error(
          'The condition of while statement must evaluate to a boolean'
        );
      }

      return cond.value;
    }

    while (yield* shouldContinue()) {
      yield* evaluateStmt(ctx, stmt.body);
    }
  }

  function* evaluateReturnStmt(ctx: Context, stmt: ReturnStmt): EventGen<void> {
    throw new ReturnValue(yield* evaluateExpression(ctx, stmt.value));
  }

  function* evaluateStmt(ctx: Context, stmt: Statement): EventGen<void> {
    switch (stmt.type) {
      case 'cmd':
        yield* evaluateCmd(ctx, stmt);
        break;
      case 'return':
        yield* evaluateReturnStmt(ctx, stmt);
        break;
      case 'if':
        yield* evaluateIfStmt(ctx, stmt);
        break;
      case 'while':
        yield* evaluateWhileStmt(ctx, stmt);
        break;
      case 'block':
        yield* evaluateBlock(ctx, stmt);
        break;
      default:
        yield* evaluateExpression(ctx, stmt);
        break;
    }
  }

  function* evaluateBlock(
    ctx: Context,
    program: Program | Block | MusicalProcedure
  ): EventGen<void> {
    for (const stmt of program.statements) {
      yield* evaluateStmt(ctx, stmt);
    }
  }

  const evaluateAndPlay: (program: Program) => void = program => {
    runGenerator(evaluateBlock(ctx, program));
    sequencer.play();
  };

  return {
    evaluate: evaluateAndPlay,
  };
};

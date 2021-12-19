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
} from './parser';
import {
  EventSourceSequence,
  MusicalEventSource,
  Sequence,
  Sequencer,
  sequenceToEventSource,
} from '../music/sequencer';

export type Evaluator = {
  evaluate(p: Block): void;
};

type VariableNumber = {type: 'number'; value: number};
type VariableSequence = {type: 'sequence'; value: Sequence};
type VariableMusicalEventSource = {
  type: 'musical_event_source';
  value: MusicalEventSource;
};
type VariableFunctionDefinition = {type: 'fun'; value: FunctionDefinition};
type VariableBoolean = {type: 'boolean'; value: boolean};
type VariableNil = {type: 'nil'};

type VariableValue =
  | VariableNumber
  | VariableSequence
  | VariableMusicalEventSource
  | VariableFunctionDefinition
  | VariableBoolean
  | VariableNil;

type Environment = {
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
  const ctx: Context = {
    env: createEnvironment(),
    seq: [],
    playheadPosition: 0,
    playUntil: 0,
  };

  // const evaluateAssignmentOld: (ctx: Context, exp: Assignment) => void = (
  //   ctx,
  //   exp
  // ) => {
  //   ctx.env.set(exp.left.name, evaluateAssignmentRightValue(ctx, exp.right));
  // };

  // const evaluateAssignmentExpression: (
  //   ctx: Context,
  //   exp: BinaryOperator
  // ) => void = (ctx, exp) => {
  //   if (exp.operator !== ':=' || exp.left.type !== 'identifier')
  //     throw Error('Assignment only allowed to an identifier');
  //
  //   ctx.env.set(exp.left.name, evaluateAssignmentRightValue(ctx, exp.right));
  // };

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

  const evaluateIdentifierAsInteger: (
    ctx: Context,
    exp: Identifier
  ) => number = (ctx, exp) => {
    const id = evaluateIdentifier(ctx, exp);
    if (id.type !== 'number') throw Error('Must be a numerical value');
    return id.value;
  };

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
    // if (stmt.arg.type !== 'integer') throw Error('Must be an integer');

    const pitch = (() => {
      if (stmt.arg.type === 'identifier') {
        return evaluateIdentifierAsInteger(ctx, stmt.arg);
      } else if (stmt.arg.type === 'integer') {
        return stmt.arg.value;
      } else {
        throw Error('Must be an integer');
      }
    })();

    ctx.seq.push({
      type: 'NOTE',
      startTime: ctx.playheadPosition,
      duration: 0.25,
      volume: 64,
      pitch: pitch,
      instrument: 'audio',
    });
    ctx.seq.push({
      type: 'NOTE',
      startTime: ctx.playheadPosition,
      duration: 0.25,
      volume: 64,
      pitch: pitch,
      instrument: 'midi',
    });
  }

  function* evaluateSleep(ctx: Context, stmt: BuiltInCommand): EventGen<void> {
    ctx.playheadPosition += (() => {
      if (stmt.arg.type === 'identifier') {
        return evaluateIdentifierAsInteger(ctx, stmt.arg);
      } else if (stmt.arg.type === 'float' || stmt.arg.type === 'integer') {
        return stmt.arg.value;
      } else {
        throw Error('Must be an integer or a float');
      }
    })();

    while (ctx.playheadPosition > ctx.playUntil) {
      ctx.playUntil = yield {
        sequence: ctx.seq,
        playheadPos: ctx.playheadPosition,
      };
      ctx.seq = [];
    }
  }

  // eslint-disable-next-line require-yield
  function* evaluateFunctionCall(
    ctx: Context,
    stmt: FunctionCall
  ): EventGen<VariableValue> {
    // TODO: accept all expressions
    if (stmt.func.type !== 'identifier') {
      throw Error('Function calls are implemented only for identifiers');
    }
    const func = ctx.env.get(stmt.func.name);
    if (func.type !== 'fun') {
      throw Error('Attempting to call a non-function');
    }

    if (func.value.params.length !== stmt.args.length) {
      throw Error(
        `Arguments provided: ${stmt.args.length}, expected: ${func.value.params.length}`
      );
    }

    const oldEnv = ctx.env;
    ctx.env = ctx.env.extend();
    // const newCtx: Context = {
    //   ...ctx,
    //   env: ctx.env.extend(),
    // };

    // TODO: accept all expressions. Now accepting only number literals.
    for (let i = 0; i < stmt.args.length; i++) {
      const arg = stmt.args[i];
      switch (arg.type) {
        case 'integer':
          ctx.env.set(func.value.params[i], evaluateInteger(arg));
          break;
        case 'float':
          ctx.env.set(func.value.params[i], evaluateFloat(arg));
      }
    }

    // yield* evaluateFunctionBody(newCtx, func.value.body);
    yield* evaluateFunctionBody(ctx, func.value.body);
    ctx.env = oldEnv;
    return {type: 'nil'};
  }

  // eslint-disable-next-line require-yield
  function* evaluateFunctionDefinition(
    ctx: Context,
    stmt: FunctionDefinition
  ): EventGen<FunctionDefinition> {
    console.log('evaluating function definition');
    return stmt;
  }

  // eslint-disable-next-line require-yield
  // function* evaluateAssignmentGen(
  //   ctx: Context,
  //   exp: Assignment
  // ): Generator<SequenceAndPlayheadPos, void, number> {
  //   ctx.env.set(
  //     exp.left.name,
  //     yield* evaluateAssignmentRightValueGen(ctx, exp.right)
  //   );
  // }

  // eslint-disable-next-line require-yield
  // function* evaluateAssignmentRightValueGen(
  //   ctx: Context,
  //   exp: Expression
  // ): Generator<SequenceAndPlayheadPos, VariableValue, number> {
  //   switch (exp.type) {
  //     case 'binary_operator':
  //       // TODO: Implement binary operator
  //       throw Error('Binary operator not yet implemented');
  //     case 'unary_operator':
  //       // TODO: Implement unary operator
  //       throw Error('Unary operator not yet implemented');
  //     case 'identifier':
  //       return evaluateIdentifier(ctx, exp);
  //     case 'integer':
  //       return evaluateInteger(exp);
  //     case 'float':
  //       return evaluateFloat(exp);
  //     case 'boolean':
  //       // TODO: Implement boolean literal
  //       throw Error('Boolean literal not yet implemented');
  //     case 'step_sequence':
  //       return {type: 'sequence', value: evaluateMusicalExpression(exp)};
  //     // case 'musical_binary':
  //     //   return {type: 'sequence', value: evaluateMusicalExpression(exp)};
  //     case 'musical_procedure':
  //       return {
  //         type: 'musical_event_source',
  //         value: evaluateMusicalProcedure(ctx, exp),
  //       };
  //     case 'fun':
  //       return {
  //         type: 'fun',
  //         value: yield* evaluateFunctionDefinition(ctx, exp),
  //       };
  //     case 'call':
  //       throw Error('Evaluation of function call not yet implemented');
  //   }
  // }

  function* evaluateStatement(ctx: Context, stmt: Statement): EventGen<void> {
    if (stmt.type === 'cmd') {
      switch (stmt.name) {
        case 'play':
          yield* evaluatePlay(ctx, stmt);
          break;
        case 'sleep':
          yield* evaluateSleep(ctx, stmt);
          break;
        default:
          break;
      }
    } else if (stmt.type === 'call') {
      yield* evaluateFunctionCall(ctx, stmt);
    }
    // else if (stmt.type === 'assignment') {
    //   yield* evaluateAssignmentGen(ctx, stmt);
    // }
  }

  function* evaluateFunctionBody(
    ctx: Context,
    statements: Statement[]
  ): EventGen<void> {
    for (const stmt of statements) {
      yield* evaluateStatement(ctx, stmt);
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

      yield* evaluateFunctionBody(ctx, exp.statements);

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

  // const evaluateAssignmentRightValue: (
  //   ctx: Context,
  //   exp: Expression
  // ) => VariableValue = (ctx, exp) => {
  //   switch (exp.type) {
  //     case 'unary_operator':
  //       // TODO: Implement unary operator
  //       throw Error('Unary operator not yet implemented');
  //     case 'binary_operator':
  //       // TODO: implement binary operator
  //       throw Error('Binary operator not yet implemented');
  //     case 'identifier':
  //       return evaluateIdentifier(ctx, exp);
  //     case 'integer':
  //       return evaluateInteger(exp);
  //     case 'float':
  //       return evaluateFloat(exp);
  //     case 'boolean':
  //       // TODO: implement boolean literal
  //       throw Error('Boolean literal not yet implemented');
  //     case 'step_sequence':
  //       return {type: 'sequence', value: evaluateMusicalExpression(exp)};
  //     // case 'musical_binary':
  //     //   return {type: 'sequence', value: evaluateMusicalExpression(exp)};
  //     case 'musical_procedure':
  //       return {
  //         type: 'musical_event_source',
  //         value: evaluateMusicalProcedure(ctx, exp),
  //       };
  //     case 'fun':
  //       return {
  //         type: 'fun',
  //         value: runGenerator(evaluateFunctionDefinition(ctx, exp)),
  //       };
  //     case 'call':
  //       throw new Error('Evaluation of function call is not implemented yet');
  //   }
  // };

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

  const evaluateCmd: (ctx: Context, exp: BuiltInCommand) => void = (
    ctx,
    exp
  ) => {
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
        if (exp.arg.type === 'identifier') {
          sequencer.setTempo(evaluateIdentifierAsInteger(ctx, exp.arg));
        } else if (exp.arg.type === 'integer') {
          sequencer.setTempo(evaluateInteger(exp.arg).value);
        } else {
          throw Error('Tempo must be an integer');
        }
        break;
    }
  };

  const evaluateUnaryOperator: (
    ctx: Context,
    exp: UnaryOperator
  ) => VariableValue = (ctx, exp) => {
    const value = evaluateExpression(ctx, exp.operand);
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
  };

  const evaluateBoolean: (exp: BooleanLiteral) => VariableBoolean = exp => ({
    type: 'boolean',
    value: exp.value,
  });

  const evaluateAddition: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableNumber = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);
    if (left.type !== 'number' || right.type !== 'number')
      throw Error('Operands of + operator should be numbers');
    return {type: 'number', value: left.value + right.value};
  };

  const evaluateSubtraction: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableNumber = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);
    if (left.type !== 'number' || right.type !== 'number')
      throw Error('Operands of - operator should be numbers');
    return {type: 'number', value: left.value - right.value};
  };

  const evaluateSequenceOperator: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableSequence = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);
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
  };

  const evaluateUnequalTo: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableBoolean = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);
    if (
      (left.type === 'number' && right.type === 'number') ||
      (left.type === 'boolean' && right.type === 'boolean')
    ) {
      return {type: 'boolean', value: left.value !== right.value};
    }

    throw Error('Comparison != between incompatible types');
  };

  const evaluateLogicalAnd: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableBoolean = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    if (left.type !== 'boolean')
      throw Error('First operand of && operator should be a boolean');
    if (!left.value) return {type: 'boolean', value: false};
    const right = evaluateExpression(ctx, exp.right);
    if (right.type !== 'boolean')
      throw Error('Second operand of && operator should be a boolean');
    return {type: 'boolean', value: left.value && right.value};
  };

  const evaluateMultiplication: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableNumber = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);
    if (left.type !== 'number' || right.type !== 'number')
      throw Error('Operands of - operator should be numbers');
    return {type: 'number', value: left.value * right.value};
  };

  const evaluateDivision: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableNumber = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);
    if (left.type !== 'number' || right.type !== 'number')
      throw Error('Operands of - operator should be numbers');
    if (left.value === 0) throw Error('Division by zero');
    return {type: 'number', value: left.value / right.value};
  };

  const evaluateAssignment: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableValue = (ctx, exp) => {
    if (exp.left.type !== 'identifier')
      throw Error('Left operand of assignment := needs to be an identifier');
    const value = evaluateExpression(ctx, exp.right);
    ctx.env.set(exp.left.name, value);
    return value;
  };

  const evaluateStackOperator: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableSequence = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);

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
  };

  const evaluateLessThan: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableBoolean = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);
    if (left.type === 'number' && right.type === 'number') {
      return {type: 'boolean', value: left.value < right.value};
    }
    throw Error('Comparison < between incompatible types');
  };

  const evaluateLessThanOrEqualTo: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableBoolean = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);
    if (left.type === 'number' && right.type === 'number') {
      return {type: 'boolean', value: left.value <= right.value};
    }
    throw Error('Comparison <= between incompatible types');
  };

  const evaluateEqualTo: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableBoolean = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);
    if (left.type === 'number' && right.type === 'number') {
      return {type: 'boolean', value: left.value === right.value};
    }

    throw Error('Comparison == between incompatible types');
  };

  const evaluateGreaterThan: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableBoolean = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);
    if (left.type === 'number' && right.type === 'number') {
      return {type: 'boolean', value: left.value > right.value};
    }
    throw Error('Comparison > between incompatible types');
  };

  const evaluateGreaterThanOrEqualTo: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableBoolean = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    const right = evaluateExpression(ctx, exp.right);
    if (left.type === 'number' && right.type === 'number') {
      return {type: 'boolean', value: left.value >= right.value};
    }
    throw Error('Comparison >= between incompatible types');
  };

  const evaluateLogicalOr: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableBoolean = (ctx, exp) => {
    const left = evaluateExpression(ctx, exp.left);
    if (left.type !== 'boolean')
      throw Error('First operand of || operator should be a boolean');
    if (left.value) return {type: 'boolean', value: true};
    const right = evaluateExpression(ctx, exp.right);
    if (right.type !== 'boolean')
      throw Error('Second operand of && operator should be a boolean');
    return {type: 'boolean', value: left.value || right.value};
  };

  const evaluateBinaryOperator: (
    ctx: Context,
    exp: BinaryOperator
  ) => VariableValue = (ctx, exp) => {
    switch (exp.operator) {
      case '-':
        return evaluateSubtraction(ctx, exp);
      case ':+:':
        return evaluateSequenceOperator(ctx, exp);
      case '!=':
        return evaluateUnequalTo(ctx, exp);
      case '&&':
        return evaluateLogicalAnd(ctx, exp);
      case '*':
        return evaluateMultiplication(ctx, exp);
      case '+':
        return evaluateAddition(ctx, exp);
      case '/':
        return evaluateDivision(ctx, exp);
      case ':=':
        return evaluateAssignment(ctx, exp);
      case ':=:':
        return evaluateStackOperator(ctx, exp);
      case '<':
        return evaluateLessThan(ctx, exp);
      case '<=':
        return evaluateLessThanOrEqualTo(ctx, exp);
      case '==':
        return evaluateEqualTo(ctx, exp);
      case '>':
        return evaluateGreaterThan(ctx, exp);
      case '>=':
        return evaluateGreaterThanOrEqualTo(ctx, exp);
      case '||':
        return evaluateLogicalOr(ctx, exp);
    }
  };

  const evaluateExpression: (ctx: Context, exp: Expression) => VariableValue = (
    ctx,
    exp
  ) => {
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
        return evaluateUnaryOperator(ctx, exp);
      case 'binary_operator':
        return evaluateBinaryOperator(ctx, exp);
      case 'fun':
        // TODO: change function to return the correct value directly
        return {
          type: 'fun',
          value: runGenerator(evaluateFunctionDefinition(ctx, exp)),
        };
      case 'call':
        return runGenerator(evaluateFunctionCall(ctx, exp));
      case 'musical_procedure':
        return {
          type: 'musical_event_source',
          value: evaluateMusicalProcedure(ctx, exp),
        };
    }
  };

  const evaluateStmt: (stmt: Statement) => void = stmt => {
    switch (stmt.type) {
      case 'cmd':
        evaluateCmd(ctx, stmt);
        break;
      case 'return':
        // TODO: no need to outside of function scope
        break;
      default:
        evaluateExpression(ctx, stmt);
        break;
    }
  };

  const evaluate: (program: Block) => void = program => {
    program.statements.forEach(evaluateStmt);
    sequencer.play();
  };

  return {
    evaluate: evaluate,
  };
};

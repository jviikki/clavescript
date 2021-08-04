import {
  Assignment,
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

type VariableValue = number | Sequence | MusicalEventSource;

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
};

export const createEvaluator: (
  sequencer: Sequencer
) => Evaluator = sequencer => {
  const ctx: Context = {
    env: createEnvironment(),
  };

  const evaluate: (program: Block) => void = program => {
    program.statements.forEach(stmt => {
      switch (stmt.type) {
        case 'assignment':
          evaluateAssignment(ctx, stmt);
          break;
        case 'cmd':
          evaluateCmd(ctx, stmt);
          break;
      }
    });
    sequencer.play();
  };

  const evaluateAssignment: (ctx: Context, exp: Assignment) => void = (
    ctx,
    exp
  ) => {
    ctx.env.set(exp.left.name, evaluateAssignmentRightValue(ctx, exp.right));
  };

  const evaluateIdentifier: (
    ctx: Context,
    exp: Identifier
  ) => number | Sequence | MusicalEventSource = (ctx, exp) =>
    ctx.env.get(exp.name);

  const evaluateInteger: (exp: Integer) => number = exp => exp.value;

  const evaluateFloat: (exp: Float) => number = exp => exp.value;

  const evaluateIdentifierAsInteger: (
    ctx: Context,
    exp: Identifier
  ) => number = (ctx, exp) => {
    const id = evaluateIdentifier(ctx, exp);
    if (typeof id !== 'number') throw Error('Must be a numerical value');
    return id;
  };

  const evaluateIdentifierAsSequence: (
    ctx: Context,
    exp: Identifier
  ) => Sequence | MusicalEventSource = (ctx, exp) => {
    const id = evaluateIdentifier(ctx, exp);
    if (id === undefined || id === null)
      throw Error(`Undefined variable: ${exp.name}`);
    if (typeof id === 'number')
      throw Error('Identifier refers to a number. It must be sequence.');
    return id;
  };

  const evaluateMusicalProcedure: (
    ctx: Context,
    exp: MusicalProcedure
  ) => MusicalEventSource = (ctx, exp) => {
    type SequenceAndPlayheadPos = {
      sequence: Sequence;
      playheadPos: number;
    };

    function* evaluatorGenerator(
      ctx: Context
    ): Generator<SequenceAndPlayheadPos, SequenceAndPlayheadPos, number> {
      let currentTime = 0;
      let seq: Sequence = [];
      let until: number = yield {
        sequence: seq,
        playheadPos: currentTime,
      };

      for (const stmt of exp.statements) {
        if (stmt.type !== 'cmd')
          throw Error('Musical expressions can contain only commands');
        switch (stmt.name) {
          case 'play':
            if (stmt.arg.type !== 'integer') throw Error('Must be an integer');
            seq.push({
              type: 'NOTE',
              startTime: currentTime,
              duration: 0.25,
              volume: 64,
              pitch: stmt.arg.value,
              instrument: 'audio',
            });
            seq.push({
              type: 'NOTE',
              startTime: currentTime,
              duration: 0.25,
              volume: 64,
              pitch: stmt.arg.value,
              instrument: 'midi',
            });
            break;
          case 'sleep':
            // TODO: extract this function
            currentTime += (() => {
              if (stmt.arg.type === 'identifier') {
                return evaluateIdentifierAsInteger(ctx, stmt.arg);
              } else if (
                stmt.arg.type === 'float' ||
                stmt.arg.type === 'integer'
              ) {
                return stmt.arg.value;
              } else {
                throw Error('Must be an integer or a float');
              }
            })();

            while (currentTime > until) {
              until = yield {
                sequence: seq,
                playheadPos: currentTime,
              };
              seq = [];
            }
            break;
          default:
            break;
        }
      }

      return {
        sequence: seq,
        playheadPos: currentTime,
      };
    }

    let isDone = false;
    let evaluator = evaluatorGenerator({env: ctx.env.extend()});
    evaluator.next(0);
    let currentPlayheadPos = 0;

    return {
      restart() {
        isDone = false;
        evaluator = evaluatorGenerator({env: ctx.env.extend()});
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

  const evaluateAssignmentRightValue: (
    ctx: Context,
    exp: Expression
  ) => number | Sequence | MusicalEventSource = (ctx, exp) => {
    switch (exp.type) {
      case 'identifier':
        return evaluateIdentifier(ctx, exp);
      case 'integer':
        return evaluateInteger(exp);
      case 'float':
        return evaluateFloat(exp);
      case 'step_sequence':
      case 'musical_binary':
        return evaluateMusicalExpression(exp);
      case 'musical_procedure':
        return evaluateMusicalProcedure(ctx, exp);
      case 'call':
        throw new Error('Function call is not implemented yet');
    }
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
          sequencer.setTempo(evaluateInteger(exp.arg));
        } else {
          throw Error('Tempo must be an integer');
        }
        break;
    }
  };

  return {
    evaluate: evaluate,
  };
};

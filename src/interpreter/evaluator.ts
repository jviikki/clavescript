import {
  Assignment,
  BuiltInCommand,
  Identifier,
  Integer,
  MusicalBinaryOperator,
  MusicalExpression,
  MusicalProcedure,
  Program,
  StepSequence,
} from './parser';
import {
  MusicalEventSource,
  Sequence,
  Sequencer,
  sequenceToEventSource,
} from '../music/sequencer';

export type Evaluator = {
  evaluate(p: Program): void;
  printGlobalScope(): void;
};

type Scope = {
  [name: string]: number | Sequence | MusicalEventSource;
};

export const createEvaluator: (
  sequencer: Sequencer
) => Evaluator = sequencer => {
  // This object will act as the global scope for variables
  const globalScope: Scope = {};

  const assignVariable: (
    name: string,
    value: number | Sequence | MusicalEventSource
  ) => void = (name, value) => {
    globalScope[name] = value;
  };

  const getVariable: (
    name: string
  ) => number | Sequence | MusicalEventSource = name => globalScope[name];

  const evaluate: (program: Program) => void = program => {
    program.expressions.forEach(exp => {
      switch (exp.type) {
        case 'assignment':
          evaluateAssignment(exp);
          break;
        case 'cmd':
          evaluateCmd(exp);
          break;
      }
    });
  };

  const evaluateAssignment: (exp: Assignment) => void = exp => {
    assignVariable(exp.left.name, evaluateAssignmentRightValue(exp.right));
  };

  const evaluateIdentifier: (
    exp: Identifier
  ) => number | Sequence | MusicalEventSource = exp => getVariable(exp.name);

  const evaluateInteger: (exp: Integer) => number = exp => exp.value;

  const evaluateIdentifierAsInteger: (exp: Identifier) => number = exp => {
    const id = evaluateIdentifier(exp);
    if (typeof id !== 'number') throw Error('Must be a numerical value');
    return id;
  };

  const evaluateIdentifierAsSequence: (
    exp: Identifier
  ) => Sequence | MusicalEventSource = exp => {
    const id = evaluateIdentifier(exp);
    if (typeof id === 'number') throw Error('Identifier must be sequence');
    return id;
  };

  const evaluateMusicalProcedure: (
    exp: MusicalProcedure
  ) => MusicalEventSource = exp => {
    function* evaluatorGenerator(): Generator<Sequence, Sequence, number> {
      let currentTime = 0;
      let seq: Sequence = [];
      let until: number = yield seq;

      for (const e of exp.expressions) {
        if (e.type !== 'cmd')
          throw Error('Musical expressions can contain only commands');
        switch (e.name) {
          case 'play':
            if (e.arg.type !== 'integer')
              throw Error('Must be a numerical value');
            seq.push({
              type: 'NOTE',
              startTime: currentTime,
              duration: 0.25,
              volume: 64,
              pitch: e.arg.value,
              instrument: 'audio',
            });
            seq.push({
              type: 'NOTE',
              startTime: currentTime,
              duration: 0.25,
              volume: 64,
              pitch: e.arg.value,
              instrument: 'midi',
            });
            break;
          case 'sleep':
            if (e.arg.type !== 'integer')
              throw Error('Must be a numerical value');
            currentTime += e.arg.value;
            while (currentTime > until) {
              until = yield seq;
              seq = [];
            }
            break;
          default:
            break;
        }
      }

      return seq;
    }

    let isDone = false;
    const evaluator = evaluatorGenerator();
    evaluator.next(0);

    return {
      getEventsUntil(playheadPos: number): Sequence {
        if (isDone) return [];
        const nextEvents = evaluator.next(playheadPos);
        isDone = nextEvents.done || false;
        return nextEvents.value;
      },
    };
  };

  const evaluateAssignmentRightValue: (
    exp: Integer | MusicalExpression | Identifier | MusicalProcedure
  ) => number | Sequence | MusicalEventSource = exp => {
    switch (exp.type) {
      case 'identifier':
        return evaluateIdentifier(exp);
      case 'integer':
        return evaluateInteger(exp);
      case 'step_sequence':
      case 'musical_binary':
        return evaluateMusicalExpression(exp);
      case 'musical_procedure':
        return evaluateMusicalProcedure(exp);
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

  let counter = 0;
  const evaluateCmd: (exp: BuiltInCommand) => void = exp => {
    switch (exp.name) {
      case 'loop':
        if (exp.arg.type === 'identifier') {
          const seq = evaluateIdentifierAsSequence(exp.arg);
          sequencer.setLoop(
            `${++counter}`,
            seq instanceof Array ? sequenceToEventSource(seq) : seq
          );
          sequencer.play();
        }
        break;
      case 'tempo':
        if (exp.arg.type === 'identifier') {
          sequencer.setTempo(evaluateIdentifierAsInteger(exp.arg));
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
    printGlobalScope: () => console.log(globalScope),
  };
};

import {
  Assignment,
  BuiltInCommand,
  Identifier,
  Integer,
  MusicalBinaryOperator,
  MusicalExpression,
  Program,
  StepSequence,
} from './parser';
import {Sequence, Sequencer} from '../sequencer';

type Scope = {
  [name: string]: number | Sequence;
};

// This object will act as the global scope for variables
const globalScope: Scope = {};

const assignVariable: (name: string, value: number | Sequence) => void = (
  name,
  value
) => {
  globalScope[name] = value;
};

const getVariable: (name: string) => number | Sequence = name =>
  globalScope[name];

export const printGlobalScope: () => void = () => {
  console.log(globalScope);
};

// TODO: This is horrible, remove
let sequencer: Sequencer | null = null;

export const evaluate: (program: Program, seq: Sequencer) => void = (
  program,
  seq
) => {
  // TODO: Remove this
  sequencer = seq;

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

const evaluateIdentifier: (exp: Identifier) => number | Sequence = exp =>
  getVariable(exp.name);

const evaluateInteger: (exp: Integer) => number = exp => exp.value;

const evaluateIdentifierAsInteger: (exp: Identifier) => number = exp => {
  const id = evaluateIdentifier(exp);
  if (typeof id !== 'number') throw Error('Must be a numerical value');
  return id;
};

const evaluateIdentifierAsSequence: (exp: Identifier) => Sequence = exp => {
  const id = evaluateIdentifier(exp);
  if (typeof id === 'number') throw Error('Identifier must be sequence');
  return id as Sequence;
};

const evaluateAssignmentRightValue: (
  exp: Integer | MusicalExpression | Identifier
) => number | Sequence = exp => {
  switch (exp.type) {
    case 'identifier':
      return evaluateIdentifier(exp);
    case 'integer':
      return evaluateInteger(exp);
    case 'step_sequence':
    case 'musical_binary':
      return evaluateMusicalExpression(exp);
  }
};

const evaluateMusicalExpression: (exp: MusicalExpression) => Sequence = exp => {
  switch (exp.type) {
    case 'step_sequence':
      return evaluateStepSequence(exp);
    case 'musical_binary':
      return evaluateMusicalBinaryOperator(exp);
  }
};

const evaluateStepSequence: (exp: StepSequence) => Sequence = exp => {
  const attrs: {[name: string]: number} = exp.attributes.reduce((acc, attr) => {
    if (attr.right.type !== 'integer') throw Error('Must be integer');
    const val = attr.right.value;
    return {...acc, [attr.left.name]: val};
  }, {});

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
      if (pitch === undefined) throw Error(`Unknown identifier: ${step.name}`);
    }
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

const evaluateCmd: (exp: BuiltInCommand) => void = exp => {
  // TODO: Remove this once passing the sequencer is made better
  if (sequencer === null) throw new Error('Sequencer is not initialized');

  switch (exp.name) {
    case 'loop':
      if (exp.arg.type === 'identifier') {
        sequencer.setSequence(evaluateIdentifierAsSequence(exp.arg));
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

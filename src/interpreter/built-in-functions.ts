import {Environment, VariableString, VariableValue} from './evaluator';
import {Logger} from '../logger';
import {getMidiAccess, isWebMIDISupported} from '../music/midi';

export const initializeBuiltInFunctions: (
  globalEnv: Environment,
  logger: Logger
) => void = (globalEnv, logger) => {
  globalEnv.set('len', {
    type: 'internal',
    name: 'len',
    value: (val: VariableValue) => {
      if (val.type !== 'array')
        throw Error("Built-in function 'len' can only be applied to arrays");
      return {type: 'number', value: val.items.length};
    },
  });

  globalEnv.set('rand', {
    type: 'internal',
    name: 'rand',
    value: () => {
      return {type: 'number', value: Math.random()};
    },
  });

  globalEnv.set('floor', {
    type: 'internal',
    name: 'floor',
    value: (val: VariableValue) => {
      if (val.type !== 'number')
        throw Error("Built in function 'floor' can be only applied to numbers");
      return {type: 'number', value: Math.floor(val.value)};
    },
  });

  globalEnv.set('ceil', {
    type: 'internal',
    name: 'ceil',
    value: (val: VariableValue) => {
      if (val.type !== 'number')
        throw Error("Built in function 'ceil' can be only applied to numbers");
      return {type: 'number', value: Math.ceil(val.value)};
    },
  });

  const convertToString: (val: VariableValue) => VariableString = val => {
    if (val.type === 'string') return {...val};
    if (val.type === 'number')
      return {type: 'string', value: val.value.toString(10)};
    if (val.type === 'boolean')
      return {type: 'string', value: val.value.toString()};
    if (val.type === 'array')
      return {
        type: 'string',
        value:
          '[' +
          val.items
            .map(i => {
              const str = convertToString(i);
              return i.type === 'string' ? `"${str.value}"` : str.value;
            })
            .join(', ') +
          ']',
      };
    if (val.type === 'nil') return {type: 'string', value: 'nil'};
    throw Error(`Cannot convert ${val.type} to string`);
  };

  globalEnv.set('print', {
    type: 'internal',
    name: 'print',
    value: (val: VariableValue) => {
      logger.i(convertToString(val).value);
      return {type: 'nil'};
    },
  });

  globalEnv.set('str', {
    type: 'internal',
    name: 'str',
    value: convertToString,
  });

  globalEnv.set('list_midi_outputs', {
    type: 'internal',
    name: 'list_midi_outputs',
    value: () => {
      if (!isWebMIDISupported()) {
        throw Error('Web MIDI API is not supported by the browser');
      }

      const midi = getMidiAccess();
      const outputs: VariableString[] = Array.from(
        midi.listOutputs().values()
      ).map(o => ({
        type: 'string',
        value: o.name || 'undefined',
      }));

      return {
        type: 'array',
        items: outputs,
      };
    },
  });
};

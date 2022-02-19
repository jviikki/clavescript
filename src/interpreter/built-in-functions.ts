import {
  Environment,
  VariableArray,
  VariableString,
  VariableValue,
} from './evaluator';
import {Logger} from '../logger';
import {getMidiAccess, isWebMIDISupported} from '../music/midi';
import {spread} from './util';

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
    if (val.type === 'audio_instrument')
      return {type: 'string', value: `audio_instrument(${val.id})`};
    if (val.type === 'midi_instrument')
      return {
        type: 'string',
        value: `midi_instrument(output="${val.output.name}",channel=${val.channel})`,
      };
    if (val.type === 'note')
      return {
        type: 'string',
        value: `note(${
          convertToString(val.instrument).value
        },p=${val.pitch.toString(10)},v=${val.volume.toString(
          10
        )},d=${val.duration.toString(10)})`,
      };

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
      const outputs: VariableArray[] = Array.from(
        midi.listOutputs().values()
      ).map(o => ({
        type: 'array',
        items: [
          {
            type: 'string',
            value: o.id,
          },
          {
            type: 'string',
            value: o.name || 'undefined',
          },
        ],
      }));

      return {
        type: 'array',
        items: outputs,
      };
    },
  });

  globalEnv.set('create_midi_instrument', {
    type: 'internal',
    name: 'create_midi_instrument',
    value: (outputId: VariableValue, channel: VariableValue) => {
      if (outputId.type !== 'string')
        throw Error('MIDI output ID must be a string');

      if (
        channel.type !== 'number' ||
        !Number.isInteger(channel.value) ||
        channel.value < 1 ||
        channel.value > 16
      ) {
        throw Error('MIDI channel must be an integer between 1 - 16');
      }

      const midi = getMidiAccess();
      const output = midi.listOutputs().get(outputId.value);
      if (!output) {
        throw Error(`MIDI output with ID ${outputId.value} does not exist`);
      }

      return {
        type: 'midi_instrument',
        output: output,
        channel: channel.value - 1,
      };
    },
  });

  globalEnv.set('note', {
    type: 'internal',
    name: 'note',
    value: (
      instrument: VariableValue,
      pitch: VariableValue,
      volume: VariableValue,
      duration: VariableValue
    ) => {
      if (
        instrument.type !== 'midi_instrument' &&
        instrument.type !== 'audio_instrument'
      )
        throw Error('Invalid instrument');

      if (
        pitch.type !== 'number' ||
        !Number.isInteger(pitch.value) ||
        pitch.value < 0 ||
        pitch.value > 127
      )
        throw Error('Pitch must be an integer in range 0 - 127');

      if (
        volume.type !== 'number' ||
        !Number.isInteger(volume.value) ||
        pitch.value < 0 ||
        pitch.value > 127
      )
        throw Error('Volume must be an integerin range 0 - 127');

      if (duration.type !== 'number' || duration.value < 0)
        throw Error('Duration must be an positive number');

      return {
        type: 'note',
        instrument: instrument,
        pitch: pitch.value,
        volume: volume.value,
        duration: duration.value,
      };
    },
  });

  globalEnv.set('spread', {
    type: 'internal',
    name: 'spread',
    value: (accentedBeats: VariableValue, beats: VariableValue) => {
      if (
        accentedBeats.type !== 'number' ||
        !Number.isInteger(accentedBeats.value)
      )
        throw Error('Argument accentedBeats needs to be an integer');

      if (beats.type !== 'number' || !Number.isInteger(beats.value))
        throw Error('Argument beats needs to be an integer');

      return {
        type: 'array',
        items: spread(accentedBeats.value, beats.value).map(isAccent => ({
          type: 'boolean',
          value: isAccent,
        })),
      };
    },
  });
};

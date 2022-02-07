import {AbsPitch} from './music';
import {NoteRef} from './instrument';
import MIDIOutput = WebMidi.MIDIOutput;

// const DEFAULT_MIDI_OUTPUT_DEVICE_NAME = 'MIDISPORT 2x2 Anniv A ';
export const DEFAULT_MIDI_OUTPUT_DEVICE_NAME = 'IAC Driver Bus 1';

export const isWebMIDISupported = () => !!navigator.requestMIDIAccess;

export type MIDIAccess = {
  listOutputs(): WebMidi.MIDIOutputMap;
  playNote(
    output: WebMidi.MIDIOutput,
    pitch: AbsPitch,
    velocity: number,
    time?: number
  ): NoteRef;
};

let midiAccess: MIDIAccess | null = null;

export const getMIDIAccess: (
  getAudioContextTime: () => number
) => Promise<MIDIAccess> = async getAudioContextTime => {
  if (midiAccess) return midiAccess;

  if (!isWebMIDISupported()) {
    throw new Error('WebMIDI is not supported');
  }

  const access = await navigator.requestMIDIAccess(); // { sysex: true }

  midiAccess = {
    listOutputs(): WebMidi.MIDIOutputMap {
      return access.outputs;
    },

    playNote(
      output: MIDIOutput,
      pitch: AbsPitch,
      velocity: number,
      time?: number
    ): NoteRef {
      const calculateStartTime = () => {
        const now = window.performance.now();
        if (time === undefined) {
          return now;
        } else {
          const clockOffset = now - getAudioContextTime() * 1000;
          return time * 1000 + clockOffset;
        }
      };

      const startTime = calculateStartTime();

      output.send([0x90, pitch, velocity], startTime);

      return {
        stop: (time?: number) => {
          const stopOffset = 1; // millisecond, make sure that stop event always comes after start
          const now = window.performance.now();
          const clockOffset = now - getAudioContextTime() * 1000;
          output.send(
            [0x80, pitch, velocity],
            time === undefined
              ? startTime + stopOffset
              : time * 1000 + clockOffset
          );
        },
      };
    },
  };

  return midiAccess;
};

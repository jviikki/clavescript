import {AbsPitch} from './music';
import {NoteRef} from './instrument';
import MIDIOutput = WebMidi.MIDIOutput;

// const MIDI_OUTPUT_DEVICE_NAME = 'MIDISPORT 2x2 Anniv A ';
const MIDI_OUTPUT_DEVICE_NAME = 'IAC Driver Bus 1';

// TODO: initialize this in a different scope
let midiOutput: MIDIOutput;

let getAudioContextTime: () => number = () => 0;

export const isWebMIDISupported = () => !!navigator.requestMIDIAccess;

export const initializeMIDI: (
  getAudioContextTime: () => number
) => void = async getAudioContextTimeFunc => {
  getAudioContextTime = getAudioContextTimeFunc;
  if (!isWebMIDISupported()) {
    throw new Error('WebMIDI is not supported');
  }

  const access = await navigator.requestMIDIAccess(); // { sysex: true }

  // access.inputs.forEach(i => {
  //     if (i.name === MIDI_INPUT_DEVICE_NAME) {
  //         console.log(`Setting onMIDIMessage callback for ${i.name}`);
  //         i.onmidimessage = onMIDIMessage;
  //     }
  // });

  access.outputs.forEach(o => {
    console.log(o);
    if (o.name === MIDI_OUTPUT_DEVICE_NAME) {
      console.log(`setting ${MIDI_OUTPUT_DEVICE_NAME} as MIDI output device`);
      midiOutput = o;
    }
  });
};

export const playMidiNote: (
  pitch: AbsPitch,
  velocity: number,
  time?: number
) => NoteRef = (pitch, velocity, time = undefined) => {
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

  midiOutput.send([0x90, pitch, velocity], startTime);

  return {
    stop: (time?: number) => {
      const stopOffset = 1; // millisecond, make sure that stop event always comes after start
      const now = window.performance.now();
      const clockOffset = now - getAudioContextTime() * 1000;
      midiOutput.send(
        [0x80, pitch, velocity],
        time === undefined ? startTime + stopOffset : time * 1000 + clockOffset
      );
    },
  };
};

import {AbsPitch} from './music';
import {NoteRef} from './instrument';
import MIDIOutput = WebMidi.MIDIOutput;

// const MIDI_OUTPUT_DEVICE_NAME = 'MIDISPORT 2x2 Anniv A ';
const MIDI_OUTPUT_DEVICE_NAME = 'IAC Driver Bus 1';

// TODO: initialize this in a different scope
let midiOutput: MIDIOutput;

let clockOffset = 0;

export const isWebMIDISupported = () => !!navigator.requestMIDIAccess;

export const initializeMIDI: (
  currentTime: number
) => void = async currentTime => {
  if (!isWebMIDISupported()) {
    throw new Error('WebMIDI is not supported');
  }

  clockOffset = window.performance.now() - currentTime * 1000;
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

export const updateAudioContextTime: (
  currentTime: number
) => void = currentTime =>
  (clockOffset = window.performance.now() - currentTime * 1000);

export const playMidiNote: (
  pitch: AbsPitch,
  velocity: number,
  time?: number
) => NoteRef = (pitch, velocity, time = undefined) => {
  midiOutput.send(
    [0x90, pitch, velocity],
    time === undefined ? window.performance.now() : time * 1000 + clockOffset
  );

  return {
    stop: (time?: number) => {
      midiOutput.send(
        [0x80, pitch, velocity],
        time === undefined
          ? window.performance.now()
          : time * 1000 + clockOffset
      );
    },
  };
};

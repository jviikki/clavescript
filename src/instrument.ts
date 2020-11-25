import {AbsPitch} from './music';

export type NoteRef = {
  stop(time?: number): void;
};

export type Instrument = {
  playNote(pitch: AbsPitch, velocity: number, time?: number): NoteRef;
};

type InstrumentStore = {
  [name: string]: Instrument;
};

const instrumentStore: InstrumentStore = {};

const nopNoteRef: NoteRef = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stop: (time?: number) => {},
};

const nopInstrument = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  playNote: (pitch: AbsPitch, velocity: number, time?: number) => nopNoteRef,
};

export const getInstrument: (name: string) => Instrument = name =>
  instrumentStore[name] ?? nopInstrument;

export const addInstrument: (name: string, instrument: Instrument) => void = (
  name,
  instrument
) => {
  instrumentStore[name] = instrument;
};

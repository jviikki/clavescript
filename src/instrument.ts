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

export type ReadOnlyInstrumentLibrary = {
  get(name: string): Instrument;
};

export type InstrumentLibrary = {
  add(name: string, instrument: Instrument): void;
} & ReadOnlyInstrumentLibrary;

const nopNoteRef: NoteRef = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stop: (time?: number) => {},
};

const nopInstrument = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  playNote: (pitch: AbsPitch, velocity: number, time?: number) => nopNoteRef,
};

export const createInstrumentLibrary: () => InstrumentLibrary = () => {
  const instrumentStore: InstrumentStore = {};

  const getInstrument: (name: string) => Instrument = name =>
    instrumentStore[name] ?? nopInstrument;

  const addInstrument: (name: string, instrument: Instrument) => void = (
    name,
    instrument
  ) => {
    instrumentStore[name] = instrument;
  };

  return {
    get: getInstrument,
    add: addInstrument,
  };
};

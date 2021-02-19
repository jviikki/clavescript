import {AudioManager} from './audio';
import {NoteRef, ReadOnlyInstrumentLibrary} from './instrument';

export type MusicalEvent = Note | PitchBend;

export type Note = {
  type: 'NOTE';
  startTime: number; // 1 is one beat, i.e quarter note
  instrument: string;
  pitch: number; // absolute pitch 0 - 128
  duration: number; // 1 equals one beat, i.e quarter note
  volume: number; // 0-127 (more or less the same as
};

type PitchBend = {
  type: 'PITCH_BEND';
  time: number;
  instrument: string;
};

export type Sequence = Array<MusicalEvent>;

export type MusicalEventSource = {
  getEventsUntil(playheadPos: number): Sequence;
};

export const sequenceToEventSource: (
  seq: Sequence
) => MusicalEventSource = seq => {
  let pos = 0;
  return {
    getEventsUntil(playheadPos: number): Sequence {
      const events = [];
      for (; pos < seq.length; pos++) {
        const event = seq[pos];
        const time = event.type === 'NOTE' ? event.startTime : event.time;
        if (playheadPos < time) break;
        events.push(event);
      }
      return events;
    },
  };
};

export type Sequencer = {
  play(): void;
  pause(): void;
  stop(): void;
  setLoop(id: string, s: MusicalEventSource): void;
  unsetLoop(id: string): void;
  setTempo(beatsPerMinute: number): void;
};

type NoteOffEvent = NoteRef & {noteOffPlayheadPos: number};

type LoopStorage = {
  setLoop(id: string, loop: MusicalEventSource): void;
  unsetLoop(id: string): void;
  unsetAll(): void;
  getEventsUntil(absTime: number): Sequence;
};

const createLoopStorage: () => LoopStorage = () => {
  type LoopMap = {
    [id: string]: MusicalEventSource;
  };

  let loops: LoopMap = {};

  return {
    setLoop(id: string, loop: MusicalEventSource) {
      loops[id] = loop;
    },

    unsetLoop(id: string) {
      delete loops[id];
    },

    unsetAll() {
      loops = {};
    },

    getEventsUntil(absTime: number): Sequence {
      return Object.values(loops).flatMap(loop => loop.getEventsUntil(absTime));
    },
  };
};

export const createSequencer: (
  audio: AudioManager,
  instruments: ReadOnlyInstrumentLibrary
) => Sequencer = (audio, instruments) => {
  const SCHEDULER_INTERVAL = 25; // ms
  const LOOKAHEAD_TIME = 100; // ms

  let beatsPerMinute = 120; // Beats (quarter notes) per minute
  let isPlaying = false;

  const loopStorage = createLoopStorage();

  return {
    play(): void {
      isPlaying = true;
      let previousPlayheadPos = 0; // In beats, i.e. 1.0 = 1 quarter note
      let previousAbsoluteTime: number = audio.getCurrentTime();
      let currentlyPlayingNotes: Array<NoteOffEvent> = [];
      const playheadPosToAbsTime: (pos: number) => number = pos =>
        (pos * 60) / beatsPerMinute;
      const absTimeToPlayhead: (absTime: number) => number = absTime =>
        (absTime * beatsPerMinute) / 60;

      const schedule = () => {
        if (!isPlaying) {
          currentlyPlayingNotes.forEach(n => n.stop());
          currentlyPlayingNotes = [];
          return;
        }

        const currentAbsTime = audio.getCurrentTime();
        const elapsedAbsTime = currentAbsTime - previousAbsoluteTime;
        const currentPlayheadPos: number =
          previousPlayheadPos + absTimeToPlayhead(elapsedAbsTime);
        const scheduleUntil = currentAbsTime + LOOKAHEAD_TIME / 1000;

        const events = loopStorage.getEventsUntil(
          currentPlayheadPos + absTimeToPlayhead(LOOKAHEAD_TIME / 1000)
        );

        // console.log(`got ${events.length} events`);
        events.forEach(e => {
          if (e.type !== 'NOTE') return;
          const eventAbsTime =
            currentAbsTime +
            playheadPosToAbsTime(e.startTime - currentPlayheadPos);

          const note = instruments
            .get(e.instrument)
            .playNote(e.pitch, e.volume, eventAbsTime);

          currentlyPlayingNotes.push({
            ...note,
            noteOffPlayheadPos: e.startTime + 0.9 * e.duration,
          });
        });

        // Schedule stopping of notes
        for (let i = currentlyPlayingNotes.length - 1; i >= 0; i--) {
          const note = currentlyPlayingNotes[i];
          const noteOffAbsTime =
            currentAbsTime +
            playheadPosToAbsTime(note.noteOffPlayheadPos - currentPlayheadPos);
          if (noteOffAbsTime <= scheduleUntil) {
            note.stop(noteOffAbsTime);
            currentlyPlayingNotes.splice(i, 1);
          }
        }

        previousPlayheadPos = currentPlayheadPos;
        previousAbsoluteTime = currentAbsTime;

        setTimeout(schedule, SCHEDULER_INTERVAL);
      };

      schedule();
    },

    pause(): void {
      console.log('Paused playback');
    },

    stop(): void {
      console.log('Stopped playback');
      isPlaying = false;
      loopStorage.unsetAll();
    },

    setLoop(id: string, s: MusicalEventSource) {
      loopStorage.setLoop(id, s);
    },

    unsetLoop(id: string) {
      loopStorage.unsetLoop(id);
    },

    setTempo(bpm: number): void {
      beatsPerMinute = bpm;
    },
  };
};

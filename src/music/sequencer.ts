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

export type EventSourceSequence = {
  events: Sequence;
  currentPlayheadPos: number;
  done: boolean;
};

export type MusicalEventSource = {
  restart(): void;
  getEventsUntil(playheadPos: number): EventSourceSequence;
};

export const sequenceToEventSource: (
  seq: Sequence
) => MusicalEventSource = seq => {
  const minimumStep = 0.25;
  let pos = 0;
  let currentPlayHeadPos = 0;

  return {
    restart() {
      pos = 0;
      currentPlayHeadPos = 0;
    },

    getEventsUntil(playheadPos: number): EventSourceSequence {
      const events = [];
      let done = true;

      for (; pos < seq.length; pos++) {
        const event = seq[pos];
        const time = event.type === 'NOTE' ? event.startTime : event.time;
        currentPlayHeadPos =
          event.type === 'NOTE' ? event.startTime + event.duration : event.time;
        if (playheadPos < time) {
          done = false;
          break;
        }
        events.push(event);
      }

      const remainder = currentPlayHeadPos % minimumStep;
      const adjustment = remainder === 0 ? 0 : minimumStep - remainder;

      return {
        events: events,
        currentPlayheadPos: currentPlayHeadPos + adjustment,
        done: done,
      };
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
  getEventsUntil(playheadPosition: number): Sequence;
};

const createLoopStorage: () => LoopStorage = () => {
  type Loop = {
    startPlayheadPosition: number;
    eventSource: MusicalEventSource;
  };

  type LoopMap = {
    [id: string]: Loop;
  };

  let loops: LoopMap = {};

  return {
    setLoop(id: string, loop: MusicalEventSource) {
      loops[id] = {
        startPlayheadPosition: 0,
        eventSource: loop,
      };
    },

    unsetLoop(id: string) {
      delete loops[id];
    },

    unsetAll() {
      loops = {};
    },

    getEventsUntil(playheadPosition: number): Sequence {
      return Object.values(loops).flatMap(loop => {
        const loopStart = loop.startPlayheadPosition;
        const seq = loop.eventSource.getEventsUntil(
          playheadPosition - loopStart
        );
        if (seq.done) {
          loop.startPlayheadPosition += seq.currentPlayheadPos;
          loop.eventSource.restart();
        }
        return seq.events.map(e =>
          e.type === 'NOTE'
            ? {
                ...e,
                startTime: loopStart + e.startTime,
              }
            : {
                ...e,
                time: loopStart + e.time,
              }
        );
      });
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

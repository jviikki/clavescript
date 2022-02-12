import {AudioManager} from './audio';
import {NoteRef, ReadOnlyInstrumentLibrary} from './instrument';
import {Logger} from '../logger';
import {VariableNote} from '../interpreter/evaluator';
import {getMidiAccess} from './midi';

export const LOOKAHEAD_TIME = 100; // ms

export type MusicalEvent = Note | PitchBend;

export type Note = {
  type: 'NOTE';
  startTime: number; // 1 is one beat, i.e quarter note
  varNote: VariableNote;
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
          event.type === 'NOTE'
            ? event.startTime + event.varNote.duration
            : event.time;
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
  queueLoop(id: string, loop: MusicalEventSource): void;
  unsetLoop(id: string): void;
  unsetAll(): void;
  getEventsUntil(playheadPosition: number): Sequence;
};

const createLoopStorage: (logger: Logger) => LoopStorage = logger => {
  type Loop = {
    startPlayheadPosition: number;
    eventSource: MusicalEventSource;
  };

  type LoopMap = {
    [id: string]: Loop;
  };

  type QueuedLoopMap = {
    [id: string]: MusicalEventSource;
  };

  let loops: LoopMap = {};
  let queuedLoops: QueuedLoopMap = {};

  const adjustEventTime: (
    loopStart: number,
    e: MusicalEvent
  ) => MusicalEvent = (loopStart, e) => {
    switch (e.type) {
      case 'NOTE':
        return {...e, startTime: loopStart + e.startTime};
      default:
        return {...e, startTime: loopStart + e.time};
    }
  };

  const startQueuedLoops: (playheadPos: number) => void = playheadPos => {
    for (const [id, eventSource] of Object.entries(queuedLoops)) {
      loops[id] = {
        startPlayheadPosition: playheadPos,
        eventSource: eventSource,
      };
    }
    queuedLoops = {};
  };

  const getEventsFromLoop: (
    loop: Loop,
    playheadPosition: number
  ) => Sequence = (loop, playheadPosition) => {
    const loopStart = loop.startPlayheadPosition;
    const loopPlayheadPosition = playheadPosition - loopStart;
    const seq = loop.eventSource.getEventsUntil(loopPlayheadPosition);
    // Did loop reach the end? If it did, get events from the next loop(s).
    if (seq.done) {
      if (seq.currentPlayheadPos === 0) return []; // The loop is empty

      loop.startPlayheadPosition += seq.currentPlayheadPos; // new loop starts where the old left off
      loop.eventSource.restart();

      // TODO: move this to a more proper location.
      startQueuedLoops(loop.startPlayheadPosition);

      return [
        ...seq.events.map(e => adjustEventTime(loopStart, e)),
        ...getEventsFromLoop(loop, playheadPosition),
      ];
    }
    return seq.events.map(e => adjustEventTime(loopStart, e));
  };

  const unsetLoop: (id: string) => void = id => {
    delete loops[id];
  };

  return {
    setLoop(id: string, loop: MusicalEventSource) {
      loops[id] = {
        // Initially delay the start of the first loop so that the first notes
        // can be scheduled into the future
        startPlayheadPosition: 0.25,
        eventSource: loop,
      };
    },

    queueLoop(id: string, loop: MusicalEventSource) {
      queuedLoops[id] = loop;
    },

    unsetLoop: unsetLoop,

    unsetAll() {
      loops = {};
    },

    getEventsUntil(playheadPosition: number): Sequence {
      return Object.entries(loops).flatMap(([id, loop]) => {
        try {
          return getEventsFromLoop(loop, playheadPosition);
        } catch (e) {
          logger.e(
            `Playback of loop "${id}" was aborted due to an error. ${e.toString()}`
          );
          unsetLoop(id);
          return [];
        }
      });
    },
  };
};

export const createSequencer: (
  audio: AudioManager,
  instruments: ReadOnlyInstrumentLibrary,
  logger: Logger
) => Sequencer = (audio, instruments, logger) => {
  const SCHEDULER_INTERVAL = 25; // ms

  let beatsPerMinute = 120; // Beats (quarter notes) per minute
  let isPlaying = false;

  const loopStorage = createLoopStorage(logger);
  const midiAccess = getMidiAccess();

  const playNote: (note: Note, absTime: number) => NoteRef = (
    note,
    absTime
  ) => {
    switch (note.varNote.instrument.type) {
      case 'midi_instrument':
        // TODO: Add channel to MIDI note playback
        return midiAccess.playNote(
          note.varNote.instrument.output,
          note.varNote.pitch,
          note.varNote.volume,
          absTime
        );
      case 'audio_instrument':
        return instruments
          .get(note.varNote.instrument.id)
          .playNote(note.varNote.pitch, note.varNote.volume, absTime);
    }
  };

  return {
    play(): void {
      if (isPlaying) return;
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

          const note = playNote(e, eventAbsTime);

          currentlyPlayingNotes.push({
            ...note,
            noteOffPlayheadPos: e.startTime + e.varNote.duration, // * 0.9
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
      if (isPlaying) {
        loopStorage.queueLoop(id, s);
      } else {
        loopStorage.setLoop(id, s);
      }
    },

    unsetLoop(id: string) {
      loopStorage.unsetLoop(id);
    },

    setTempo(bpm: number): void {
      beatsPerMinute = bpm;
    },
  };
};

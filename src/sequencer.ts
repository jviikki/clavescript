import {AudioManager} from './audio';
import {getInstrument, NoteRef} from './instrument';

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

export type Sequencer = {
  play(): void;
  pause(): void;
  stop(): void;
  setSequence(s: Sequence): void;
  setTempo(beatsPerMinute: number): void;
};

type NoteOffEvent = NoteRef & {noteOffPlayheadPos: number};

export const createSequencer: (a: AudioManager, s?: Sequence) => Sequencer = (
  audioMan,
  s = []
) => {
  const SCHEDULER_INTERVAL = 25; // ms
  const LOOKAHEAD_TIME = 100; // ms

  let beatsPerMinute = 120; // Beats (quarter notes) per minute
  let isPlaying = false;

  let sequence: Sequence = s;
  const audio = audioMan;

  return {
    play(): void {
      console.log('Playing sequence:', sequence);

      isPlaying = true;
      let nextEventIndex = 0;
      let previousPlayheadPos = 0; // In beats, i.e. 1.0 = 1 quarter note
      let previousAbsoluteTime: number = audio.getCurrentTime();
      let currentlyPlayingNotes: Array<NoteOffEvent> = [];
      const playheadPosToAbsTime: (pos: number) => number = pos =>
        (pos * 60) / beatsPerMinute;
      const absTimeToPlayhead: (absTime: number) => number = absTime =>
        (absTime * beatsPerMinute) / 60;

      const schedule = () => {
        if (!isPlaying) {
          // TODO: schedule stop after the start event!
          currentlyPlayingNotes.forEach(n => n.stop());
          currentlyPlayingNotes = [];
          return;
        }

        const currentAbsTime = audio.getCurrentTime();
        const elapsedAbsTime = currentAbsTime - previousAbsoluteTime;
        const currentPlayheadPos: number =
          previousPlayheadPos + absTimeToPlayhead(elapsedAbsTime);
        const scheduleUntil = currentAbsTime + LOOKAHEAD_TIME / 1000;

        // Schedule playback of notes
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (nextEventIndex >= sequence.length) break;

          const event = sequence[nextEventIndex];
          if (event.type !== 'NOTE') {
            nextEventIndex++;
            continue;
          }

          const eventAbsTime =
            currentAbsTime +
            playheadPosToAbsTime(event.startTime - currentPlayheadPos);
          if (scheduleUntil < eventAbsTime) break;

          const note = getInstrument(event.instrument).playNote(
            event.pitch,
            event.volume,
            eventAbsTime
          );
          currentlyPlayingNotes.push({
            ...note,
            noteOffPlayheadPos: event.startTime + 0.9 * event.duration,
          });

          nextEventIndex++;
        }

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
    },

    setSequence(s: [MusicalEvent]): void {
      sequence = s;
    },

    setTempo(bpm: number): void {
      beatsPerMinute = bpm;
    },
  };
};

import {AbsPitch, absPitchToFrequency} from './music';
import {NoteRef} from './instrument';

export type AudioManager = {
  playNote(pitch: AbsPitch, velocity: number, time?: number): NoteRef;
  getCurrentTime(): number;
};

// This is just a hack because the DOM declarations do not have this non-standard field
type WebkitWindow = {
  webkitAudioContext: typeof AudioContext;
};

// These are here temporarily, move somewhere else (for example audio.ts) ASAP
const initializeWebAudioContext: () => AudioContext = () => {
  const AudioContext =
    window.AudioContext ||
    ((window as unknown) as WebkitWindow).webkitAudioContext;
  return new AudioContext();
};

export const createAudioManager: () => AudioManager = () => {
  const audioCtx = initializeWebAudioContext();

  return {
    playNote: (pitch, velocity = 64, time = undefined) => {
      const frequency = absPitchToFrequency(pitch);
      const osc = audioCtx.createOscillator();
      // osc.setPeriodicWave(wave);
      osc.type = 'sawtooth';
      osc.frequency.value = frequency;

      // envelope
      // const attackTime = 0.01;
      // const length = 1.0;
      // const releaseTime = 0.2;
      const maxGain = 0.2 * (velocity / 127);
      const env = audioCtx.createGain();
      env.gain.cancelScheduledValues(audioCtx.currentTime);
      env.gain.setValueAtTime(maxGain, audioCtx.currentTime);
      // set our attack
      //env.gain.linearRampToValueAtTime(maxGain, audioCtx.currentTime + attackTime);
      // set our release
      //env.gain.linearRampToValueAtTime(0, audioCtx.currentTime + length - releaseTime);

      osc.connect(env).connect(audioCtx.destination);
      if (time === undefined) {
        osc.start();
      } else {
        osc.start(time);
      }

      // if (time === undefined) {
      //     osc.stop(audioCtx.currentTime + length);
      // } else {
      //     osc.stop(time + length);
      // }

      return {
        stop: (time = undefined) => {
          if (time === undefined) {
            osc.stop(audioCtx.currentTime);
          } else {
            osc.stop(Math.max(time, audioCtx.currentTime));
          }
        },
      };
    },

    getCurrentTime: () => audioCtx.currentTime,
  };
};

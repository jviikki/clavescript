import {Sequence, createSequencer, Note, Sequencer} from './sequencer';
import {initializeMIDI, playMidiNote, updateAudioContextTime} from './midi';
import {createAudioManager} from './audio';
import {addInstrument} from './instrument';

const C = 60;
const D = C + 2;
const E = D + 2;
const F = E + 1;
const G = F + 2;
const A = G + 2;
const B = A + 2;

const baseNote: Note = {
  type: 'NOTE',
  startTime: 0,
  duration: 1,
  instrument: 'midi',
  pitch: 60,
  volume: 64,
};

const melodySequence: Sequence = [
  [C, 1],
  [C, 1],
  [C, 1],
  [E, 1],
  [D, 1],
  [D, 1],
  [D, 1],
  [F, 1],
  [E, 1],
  [E, 1],
  [D, 1],
  [D, 1],
  [C, 4],
  [E, 1],
  [E, 1],
  [E, 1],
  [E, 1],
  [G, 2],
  [F, 2],
  [D, 1],
  [D, 1],
  [D, 1],
  [D, 1],
  [F, 2],
  [E, 2],
  [C, 1],
  [C, 1],
  [C, 1],
  [E, 1],
  [D, 1],
  [D, 1],
  [D, 1],
  [F, 1],
  [E, 1],
  [E, 1],
  [D, 1],
  [D, 1],
  [C, 4],
].map((n, i, arr) => ({
  ...baseNote,
  pitch: n[0] + 12,
  duration: n[1] / 2,
  startTime: arr.slice(0, i).reduce((acc, cur) => acc + cur[1] / 2, 0),
}));

const bassSequence: Sequence = [
  [C, 2],
  [G - 12, 2],
  [G - 12, 2],
  [D, 2],
  [C, 2],
  [G - 12, 2],
  [C, 1],
  [G - 12, 1],
  [A - 12, 1],
  [B - 12, 1],
  [C, 2],
  [G - 12, 2],
  [G - 12, 2],
  [D, 2],
  [G - 12, 2],
  [D, 2],
  [C, 2],
  [G - 12, 2],
  [C, 2],
  [G - 12, 2],
  [G - 12, 2],
  [D, 2],
  [C, 2],
  [G - 12, 2],
  [C, 4],
].map((n, i, arr) => ({
  ...baseNote,
  instrument: 'audio',
  pitch: n[0] - 12,
  duration: n[1] / 2,
  startTime: arr.slice(0, i).reduce((acc, cur) => acc + cur[1] / 2, 0),
}));

const sequence = melodySequence
  .concat(bassSequence)
  .filter(e => e.type === 'NOTE')
  .sort((a, b) => {
    if (a.type === 'PITCH_BEND' || b.type === 'PITCH_BEND') return 0;
    return a.startTime - b.startTime;
  });

window.addEventListener('load', () => {
  const initButton = document.getElementById('init');
  if (initButton === null) return;
  const playButton = document.getElementById('play');
  if (playButton === null) return;
  const stopButton = document.getElementById('stop');
  if (stopButton === null) return;
  const tempoSlider = document.getElementById('tempo');
  if (tempoSlider === null) return;
  const tempoLabel = document.getElementById('tempo-label');
  if (tempoLabel === null) return;

  let sequencer: Sequencer = {
    play: () => undefined,
    stop: () => {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setTempo: (beatsPerMinute: number) => {},
    pause: () => {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setSequence: (s: Sequence) => {},
  };

  initButton.addEventListener('click', async () => {
    const audio = createAudioManager();
    await initializeMIDI(audio.getCurrentTime());
    setInterval(() => updateAudioContextTime(audio.getCurrentTime()), 10000);
    addInstrument('audio', {
      playNote: audio.playNote,
    });
    addInstrument('midi', {
      playNote: playMidiNote,
    });
    sequencer = createSequencer(audio, sequence);
  });

  playButton.addEventListener('click', () => {
    if (sequencer === null) return;
    sequencer.play();
  });

  stopButton.addEventListener('click', () => {
    if (sequencer === null) return;
    sequencer.stop();
  });

  tempoSlider.addEventListener('input', e => {
    if (sequencer === null) return;
    const beatsPerMinute: number = parseInt(
      (e.target as HTMLInputElement).value,
      10
    );
    sequencer.setTempo(beatsPerMinute);
    tempoLabel.innerHTML = beatsPerMinute.toString(10);
  });
});

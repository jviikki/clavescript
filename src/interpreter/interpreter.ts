import {createTokenizer} from './tokenizer';
import {createInputStream} from './input-stream';
import {parse} from './parser';
import {evaluate, printGlobalScope} from './evaluator';
import {createAudioManager} from '../audio';
import {initializeMIDI, playMidiNote, updateAudioContextTime} from '../midi';
import {addInstrument} from '../instrument';
import {createSequencer, Sequencer} from '../sequencer';

const execute: (input: string, sequencer: Sequencer) => void = (
  input,
  sequencer
) => {
  console.log('Code to evaluate: ', input);

  const tokenizer = createTokenizer(createInputStream(input));

  try {
    const program = parse(tokenizer);
    console.log(program);
    evaluate(program, sequencer);
    printGlobalScope();
  } catch (e) {
    console.log(e);
  }
};

const setupSequencer: () => Promise<Sequencer> = async () => {
  const audio = createAudioManager();
  await initializeMIDI(audio.getCurrentTime());
  setInterval(() => updateAudioContextTime(audio.getCurrentTime()), 10000);
  addInstrument('audio', {
    playNote: audio.playNote,
  });
  addInstrument('midi', {
    playNote: playMidiNote,
  });
  return createSequencer(audio, []);
};

window.addEventListener('load', async () => {
  const overlay = document.getElementsByClassName(
    'start-web-audio-overlay'
  )[0] as HTMLDivElement;

  const overlayClickHandler = async () => {
    overlay.removeEventListener('click', overlayClickHandler);
    overlay.style.display = 'none';
    await setupUI();
  };

  overlay.addEventListener('click', overlayClickHandler);
});

const setupUI = async () => {
  const sequencer = await setupSequencer();
  const codeArea = document.getElementById('code') as HTMLTextAreaElement;
  codeArea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();

      execute(codeArea.value, sequencer);
    }
  });

  const runButton = document.getElementsByClassName(
    'run-button'
  )[0] as HTMLButtonElement;
  runButton.addEventListener('click', () => {
    execute(codeArea.value, sequencer);
  });

  const clearLogButton = document.getElementsByClassName(
    'clear-log-button'
  )[0] as HTMLButtonElement;
  const logMessages = document.getElementsByClassName(
    'log-messages'
  )[0] as HTMLDivElement;
  clearLogButton.addEventListener('click', () => {
    logMessages.innerHTML = '';
  });
};

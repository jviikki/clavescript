import {createTokenizer} from './tokenizer';
import {createInputStream} from './input-stream';
import {parse} from './parser';
import {createEvaluator, Evaluator} from './evaluator';
import {createAudioManager} from '../audio';
import {initializeMIDI, playMidiNote, updateAudioContextTime} from '../midi';
import {addInstrument} from '../instrument';
import {createSequencer, Sequencer} from '../sequencer';
import {createLogger, LogMessage, Logger} from './logger';

const execute: (input: string, evaluator: Evaluator, log: Logger) => void = (
  input,
  evaluator,
  log
) => {
  console.log('Code to evaluate: ', input);
  log.i('Evaluating program...');

  const tokenizer = createTokenizer(createInputStream(input));

  try {
    const program = parse(tokenizer);
    console.log(program);
    evaluator.evaluate(program);
    log.i('Evaluation successful');
    evaluator.printGlobalScope();
  } catch (e) {
    console.log(e);
    log.e(e);
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
  const logMessages = document.getElementsByClassName(
    'log-messages'
  )[0] as HTMLDivElement;

  const logger = createLogger((msg: LogMessage) => {
    const elem = document.createElement('P');
    elem.appendChild(document.createTextNode(msg.msg));
    switch (msg.level) {
      case 'info':
        elem.className = 'log-message log-message-info';
        break;
      case 'error':
        elem.className = 'log-message log-message-error';
        break;
      case 'debug':
        elem.className = 'log-message log-message-debug';
        break;
    }
    logMessages.appendChild(elem);
  });

  const sequencer = await setupSequencer();
  const evaluator = createEvaluator(sequencer);
  const codeArea = document.getElementById('code') as HTMLTextAreaElement;
  codeArea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();

      execute(codeArea.value, evaluator, logger);
    }
  });

  const runButton = document.getElementsByClassName(
    'run-button'
  )[0] as HTMLButtonElement;
  runButton.addEventListener('click', () => {
    execute(codeArea.value, evaluator, logger);
  });

  const stopButton = document.getElementsByClassName('stop-button')[0];
  stopButton.addEventListener('click', () => sequencer.stop());

  const clearLogButton = document.getElementsByClassName(
    'clear-log-button'
  )[0] as HTMLButtonElement;
  clearLogButton.addEventListener('click', () => {
    logMessages.innerHTML = '';
  });
};

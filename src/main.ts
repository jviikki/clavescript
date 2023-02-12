import {createTokenizer} from './interpreter/tokenizer';
import {createInputStream} from './interpreter/input-stream';
import {parse} from './interpreter/parser';
import {createEvaluator, Evaluator} from './interpreter/evaluator';
import {createAudioManager} from './music/audio';
import {createInstrumentLibrary} from './music/instrument';
import {createSequencer, Sequencer} from './music/sequencer';
import {createLogger, LogMessage, Logger} from './logger';
import {initMIDIAccess, isWebMIDISupported} from './music/midi';
import getWabt from 'wabt';

const execute: (
  input: string,
  evaluator: Evaluator,
  log: Logger
) => void = async (input, evaluator, log) => {
  console.log('Code to evaluate: ', input);
  log.i('Evaluating program...');

  const tokenizer = createTokenizer(createInputStream(input));

  // while (!tokenizer.eof()) {
  //   const t = tokenizer.next();
  //   console.log(t);
  //   if (t.type === 'error') break;
  // }

  const wabt = await getWabt();
  const watInput =
    '(module (func (export "add") (param i32 i32) (result i32) (i32.add (local.get 0) (local.get 1))))';
  const module = wabt.parseWat('test.wat', watInput);
  const {buffer} = module.toBinary({});
  console.log(buffer);

  // run the WebAssembly module and call the add function
  const obj = await WebAssembly.instantiate(buffer);
  type AddModule = {
    add: (a: number, b: number) => number;
  };
  const exports = obj.instance.exports as AddModule;
  console.log(exports.add(1, 2)); // 3

  try {
    const program = parse(tokenizer);
    console.log(program);
    // evaluator.evaluate(program);

    log.i('Evaluation successful');
  } catch (e) {
    console.log(e);
    log.e(e);
  }
};

const setupSequencer: (logger: Logger) => Promise<Sequencer> = async logger => {
  const instruments = createInstrumentLibrary();

  const audio = createAudioManager();
  instruments.add('audio', {
    playNote: audio.playNote,
  });

  if (isWebMIDISupported()) {
    await initMIDIAccess(() => audio.getCurrentTime());
  }

  return createSequencer(audio, instruments, logger);
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

  const sequencer = await setupSequencer(logger);
  const evaluator = createEvaluator(sequencer, logger);

  if (!isWebMIDISupported()) {
    const notice = document.getElementsByClassName(
      'midi-disabled-notice'
    )[0] as HTMLUListElement;
    notice.style.display = 'list-item';
    logger.e(
      'MIDI support is disabled because Web MIDI API is not supported by your browser. ' +
        'Consider using Chrome.'
    );
  }

  const codeArea = document.getElementById('code') as HTMLTextAreaElement;
  codeArea.addEventListener('keydown', async e => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();

      await execute(codeArea.value, evaluator, logger);
    }
  });

  const runButton = document.getElementsByClassName(
    'run-button'
  )[0] as HTMLButtonElement;
  runButton.addEventListener('click', async () => {
    await execute(codeArea.value, evaluator, logger);
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

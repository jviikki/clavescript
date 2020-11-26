export type LogMessage = {
  level: 'info' | 'error' | 'debug';
  msg: string;
};

export type Logger = {
  i(msg: string): void; // info
  e(msg: string): void; // error
  d(msg: string): void; // debug
};

export const createLogger: (
  callback: (msg: LogMessage) => void
) => Logger = callback => ({
  i: (msg: string) => callback({level: 'info', msg: msg}),
  e: (msg: string) => callback({level: 'error', msg: msg}),
  d: (msg: string) => callback({level: 'debug', msg: msg}),
});

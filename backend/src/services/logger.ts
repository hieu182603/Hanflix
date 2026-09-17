type LogData = Record<string, unknown>;

function write(level: 'info' | 'error' | 'fatal', data: LogData, message: string) {
  const entry = JSON.stringify({ level, time: new Date().toISOString(), message, ...data });
  if (level === 'info') console.log(entry);
  else console.error(entry);
}

export const logger = {
  info: (data: LogData, message: string) => write('info', data, message),
  error: (data: LogData, message: string) => write('error', data, message),
  fatal: (data: LogData, message: string) => write('fatal', data, message),
};

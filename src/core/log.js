import { styleText } from 'node:util';

const LEVEL_RANK = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

/**
 * Colour helper that disables ANSI output when the target stream is not a TTY or
 * when NO_COLOR is set. FORCE_COLOR=1 forces colour, FORCE_COLOR=0 disables it.
 */
function paint(stream, format, text) {
  const forced = process.env.FORCE_COLOR;
  if (forced === '0') return text;
  const enabled = forced ? true : Boolean(stream.isTTY) && !process.env.NO_COLOR;
  if (!enabled) return text;
  return styleText(format, text);
}

/**
 * Progress logger for long prerender runs. Writes to stdout/stderr only; the tool
 * intentionally keeps no log files because it is a build step, not a service.
 */
export function createLogger(level = 'info') {
  const rank = LEVEL_RANK[level] ?? LEVEL_RANK.info;
  // Emits one coloured line to the requested stream.
  const write = (target, format, message) => {
    target.write(`${paint(target, format, message)}\n`);
  };
  return {
    level,
    debug(message) {
      if (rank >= LEVEL_RANK.debug) write(process.stdout, 'dim', message);
    },
    info(message) {
      if (rank >= LEVEL_RANK.info) write(process.stdout, 'cyan', message);
    },
    warn(message) {
      if (rank >= LEVEL_RANK.warn) write(process.stderr, 'yellow', message);
    },
    error(message) {
      if (rank >= LEVEL_RANK.error) write(process.stderr, 'red', message);
    },
    success(message) {
      if (rank >= LEVEL_RANK.info) write(process.stdout, 'green', message);
    },
  };
}

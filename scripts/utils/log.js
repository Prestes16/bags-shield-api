function ts() {
  return new Date().toISOString();
}

export const log = {
  info: (...args) => console.log(`[INFO ${ts()}]`, ...args),
  warn: (...args) => console.warn(`[WARN ${ts()}]`, ...args),
  error: (...args) => console.error(`[ERR  ${ts()}]`, ...args),
};

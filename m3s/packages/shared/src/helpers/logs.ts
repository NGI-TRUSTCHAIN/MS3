// packages/shared/src/helpers/logSetup.ts

const isServer = typeof process !== 'undefined' && process.versions?.node;
let currentLevel = 'info';

if (isServer) {
  try {
    // Dynamically import server-side modules
    const dotenv = require('dotenv');
    const path = require('path');
    const _path = path.resolve(process.cwd(), '../../', '.env');
    console.log('DIR FOR .ENV', _path)
    dotenv.config({ path: _path });
    currentLevel = process.env.LOG_LVL as string

  } catch (e) {
    // Fail silently if modules are not available (e.g., in a browser)
    console.error('Failed to load server-side logging configuration.');
  }
}

const originalConsole = { ...console };
const logLevelMap = {
  'debug': 4,
  'info': 3,
  'warn': 2,
  'error': 1,
  'off': 0,
};

const numericLevel = logLevelMap[currentLevel as keyof typeof logLevelMap] ?? logLevelMap['info'];
const logPrefix = '🤖 [MS3-PKG]';
console.log(`${logPrefix} Logging level set to: ${currentLevel.toUpperCase()}`);
const shouldLog = (level: number) => level <= numericLevel;

// Overwrite the native console methods
if (!shouldLog(logLevelMap.debug)) {
  console.debug = () => {};
} else {
  console.debug = (...args) => originalConsole.debug(`${logPrefix} [DEBUG]`, ...args);
}

if (!shouldLog(logLevelMap.info)) {
  console.info = () => {};
  console.log = () => {};
} else {
  console.info = (...args) => originalConsole.info(`${logPrefix} [INFO]`, ...args);
  console.log = (...args) => originalConsole.log(`${logPrefix} [INFO]`, ...args);
}

if (!shouldLog(logLevelMap.warn)) {
  console.warn = () => {};
} else {
  console.warn = (...args) => originalConsole.warn(`${logPrefix} [WARN]`, ...args);
}

if (!shouldLog(logLevelMap.error)) {
  console.error = () => {};
} else {
  console.error = (...args) => originalConsole.error(`${logPrefix} [ERROR]`, ...args);
}
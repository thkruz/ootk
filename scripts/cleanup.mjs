/* eslint-disable no-console */
import { rmSync } from 'fs';

console.log('Removing ./dist...');
try {
  rmSync('./dist', { recursive: true });
} catch (error) {
  // Intentionally left blank
}

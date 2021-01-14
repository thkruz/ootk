import { rimraf } from 'rimraf';

console.log(`Removing ./dist...`);
try {
  rimraf.sync('./dist');
} catch (error) {
  // Intentionally left blank
}

console.log(`Removing ./lib...`);
try {
  rimraf.sync('./lib');
} catch (error) {
  // Intentionally left blank
}

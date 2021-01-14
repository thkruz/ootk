import { sync } from 'rimraf';

console.log(`Removing ./dist...`);
try {
  sync('./dist');
} catch (error) {
  // Intentionally left blank
}

console.log(`Removing ./lib...`);
try {
  sync('./lib');
} catch (error) {
  // Intentionally left blank
}

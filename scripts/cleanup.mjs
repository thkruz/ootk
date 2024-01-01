import rimraf from 'rimraf';

// eslint-disable-next-line no-console
console.log('Removing ./lib...');
try {
  rimraf.sync('./lib');
} catch (error) {
  // Intentionally left blank
}

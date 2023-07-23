/* eslint-disable no-underscore-dangle */
import opener from 'opener';
import path from 'path';

const __dirname = path.resolve(path.dirname(''));
const filePath = path.join(__dirname, '/coverage/lcov-report/index.html');

opener(filePath);

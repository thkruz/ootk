/**
 * @file   Tests from Utils Module to ensure compatibility
 * @since  1.0.0-alpha3
 */

import { getDayOfYear, Utils } from 'ootk-core';

describe('Distance function', () => {
  test('if distance calculation is correct', () => {
    expect(Utils.distance({ x: 1000, y: 1000, z: 1000 }, { x: 1000, y: 1000, z: 1000 })).toEqual(0);
    expect(Utils.distance({ x: 1000, y: 1000, z: 1000 }, { x: 1000, y: 1000, z: 1100 })).toEqual(100);
  });
});

describe('Create Vector Function', () => {
  test('if vector creation is correct', () => {
    expect(Utils.createVec(1, 10, 2)).toEqual([1, 3, 5, 7, 9]);
  });
});

describe('doy Functions', () => {
  test('if doy is correct', () => {
    expect(getDayOfYear(new Date(2022, 0, 1))).toEqual(1);
    expect(getDayOfYear(new Date(2022, 1, 1))).toEqual(32);
    expect(getDayOfYear(new Date(2022, 2, 1))).toEqual(60);
    expect(getDayOfYear(new Date(2022, 3, 1))).toEqual(91);
    expect(getDayOfYear(new Date(2022, 4, 1))).toEqual(121);
    expect(getDayOfYear(new Date(2022, 5, 1))).toEqual(152);
    expect(getDayOfYear(new Date(2022, 6, 1))).toEqual(182);
    expect(getDayOfYear(new Date(2022, 7, 1))).toEqual(213);
    expect(getDayOfYear(new Date(2022, 8, 1))).toEqual(244);
    expect(getDayOfYear(new Date(2022, 9, 1))).toEqual(274);
    expect(getDayOfYear(new Date(2022, 10, 1))).toEqual(305);
    expect(getDayOfYear(new Date(2022, 11, 1))).toEqual(335);
  });

  test('if getDayOfYear is correct in leap year', () => {
    expect(getDayOfYear(new Date(2020, 0, 1, 0))).toEqual(1);
    expect(getDayOfYear(new Date(2020, 1, 1, 0))).toEqual(32);
    expect(getDayOfYear(new Date(2020, 2, 1, 0))).toEqual(61);
    expect(getDayOfYear(new Date(2020, 3, 1, 0))).toEqual(92);
    expect(getDayOfYear(new Date(2020, 4, 1, 0))).toEqual(122);
    expect(getDayOfYear(new Date(2020, 5, 1, 0))).toEqual(153);
    expect(getDayOfYear(new Date(2020, 6, 1, 0))).toEqual(183);
    expect(getDayOfYear(new Date(2020, 7, 1, 0))).toEqual(214);
    expect(getDayOfYear(new Date(2020, 8, 1, 0))).toEqual(245);
    expect(getDayOfYear(new Date(2020, 9, 1, 0))).toEqual(275);
    expect(getDayOfYear(new Date(2020, 10, 1, 0))).toEqual(306);
    expect(getDayOfYear(new Date(2020, 11, 1, 0))).toEqual(336);
  });
});

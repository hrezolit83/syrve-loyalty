import { randomInt } from 'node:crypto';

import { CARD_NUMBER_LENGTH } from '../constants/index.js';

/**
 * Номер картки: 10 цифр, перша — не нуль (узгоджено з роботодавцем;
 * track = number).
 *
 * randomInt із node:crypto, а не Math.random: номер картки бачить касир,
 * і передбачувані номери — зайвий ризик.
 */
export const generateCardNumber = () => {
  let number = String(randomInt(1, 10));

  for (let i = 1; i < CARD_NUMBER_LENGTH; i += 1) {
    number += String(randomInt(0, 10));
  }

  return number;
};

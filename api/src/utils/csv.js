/**
 * Збірка CSV для експорту.
 *
 * Дві речі, через які файл відкривається в Excel без танців:
 *
 * 1. BOM на початку. Без нього Excel на Windows читає файл у кодуванні
 *    системи й кирилиця перетворюється на «Ð†Ð²Ð°Ð½».
 * 2. Роздільник — крапка з комою. В українській локалі Excel саме його
 *    вважає роздільником полів, а кому — десятковим знаком.
 */

const BOM = '﻿';
const DELIMITER = ';';

/** Екранує одне значення за RFC 4180. */
const escapeCell = (value) => {
  if (value === null || value === undefined) return '';

  const text = String(value);

  // Лапки подвоюються, а значення з роздільником, лапками чи переносом
  // рядка береться в лапки — інакше рядок «з'їде» на сусідні колонки.
  if (/["\n\r;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;

  return text;
};

/**
 * @param {string[]} headers
 * @param {Array<Array<string|number|null>>} rows
 */
export const buildCsv = (headers, rows) => {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCell).join(DELIMITER),
  );

  // CRLF — те, чого чекає Excel.
  return BOM + lines.join('\r\n') + '\r\n';
};

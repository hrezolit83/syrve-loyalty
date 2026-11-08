/**
 * Склеювання класів CSS Modules без зовнішніх бібліотек.
 *
 * Дозволяє писати cx(styles.cell, right && styles.right): хибні значення
 * (false, null, undefined) просто відкидаються.
 */
export type ClassValue = string | false | null | undefined;

export const cx = (...values: ClassValue[]) => values.filter(Boolean).join(' ');

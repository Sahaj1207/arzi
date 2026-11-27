// Reads a rupee amount from what the citizen said.
// Rule from the brief: never guess. If we cannot be sure which number is the
// amount, return null so Arzi asks again.
import { extractNumbers } from './numbers.js';

export const MAX_AMOUNT = 10_000_000; // ₹1 crore: anything above is almost surely misheard

// Returns { value } or null.
export function parseAmount(text) {
  const numbers = extractNumbers(text).filter((n) => n > 0);
  if (numbers.length === 0) return null;

  const distinct = [...new Set(numbers)];
  let value;
  if (distinct.length === 1) {
    value = distinct[0];
  } else {
    // "20000 deposit tha, 3 mahine pehle" → only one number looks like money.
    const moneyLike = distinct.filter((n) => n >= 100);
    if (moneyLike.length !== 1) return null;
    value = moneyLike[0];
  }

  if (!Number.isInteger(value) || value < 100 || value > MAX_AMOUNT) return null;
  return { value };
}

/**
 * clock.js — time formatting ported from the Geocentric Chronometer № 13.
 * Shared between /chronometer and /box so both read from the same instrument.
 */

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
export const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export const p2 = n => String(n).padStart(2, '0');

/**
 * Format a timestamp (ms) into the box's central time readout.
 * Returns { isoDate, time, day, year, month, date }
 */
export function fmtBoxTime(ms) {
  const d   = new Date(ms);
  const hh  = d.getHours();
  const mm  = d.getMinutes();
  const ss  = d.getSeconds();
  const yr  = d.getFullYear();
  const mo  = p2(d.getMonth() + 1);
  const dy  = p2(d.getDate());
  return {
    isoDate : `${yr}.${mo}.${dy}`,
    time    : `${p2(hh)}:${p2(mm)}:${p2(ss)}`,
    day     : DAYS[d.getDay()],
    month   : MONTHS[d.getMonth()],
    year    : yr,
    date    : d.getDate(),
  };
}

/** True when a destination's era string is "the present". */
export function isPresent(era) {
  return /present/i.test(era);
}

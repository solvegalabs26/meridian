// Meeus algorithm — "Astronomical Algorithms" ch. 49
// Returns illumination (0–100), age in days (0–29.53), and phase name.

const SYNODIC_MONTH = 29.53058867;
// Known new moon: 2000-01-06 18:14 UTC
const KNOWN_NEW_MOON_JD = 2451550.1;

function julianDate(date: Date): number {
  let Y = date.getUTCFullYear();
  let M = date.getUTCMonth() + 1;
  const D =
    date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / 1440 +
    date.getUTCSeconds() / 86400;

  if (M <= 2) {
    Y -= 1;
    M += 12;
  }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + D + B - 1524.5;
}

export type MoonPhaseResult = {
  illumination: number;  // 0–100 percent
  ageDays: number;       // 0–29.53 days since last new moon
  phaseName: string;
};

function phaseName(ageDays: number): string {
  if (ageDays < 1.85)  return 'New Moon';
  if (ageDays < 7.38)  return 'Waxing Crescent';
  if (ageDays < 9.22)  return 'First Quarter';
  if (ageDays < 14.77) return 'Waxing Gibbous';
  if (ageDays < 16.61) return 'Full Moon';
  if (ageDays < 22.15) return 'Waning Gibbous';
  if (ageDays < 23.99) return 'Last Quarter';
  return 'Waning Crescent';
}

export function getMoonPhase(date: Date = new Date()): MoonPhaseResult {
  const jd = julianDate(date);
  const daysSinceNew = jd - KNOWN_NEW_MOON_JD;
  const ageDays = ((daysSinceNew % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const illumination = 50 * (1 - Math.cos((2 * Math.PI * ageDays) / SYNODIC_MONTH));

  return {
    illumination: Math.round(illumination * 10) / 10,
    ageDays: Math.round(ageDays * 1000) / 1000,
    phaseName: phaseName(ageDays),
  };
}

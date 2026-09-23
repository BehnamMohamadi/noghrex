// Iran Standard Time is UTC+03:30. Iran currently does not observe DST.
export function getIranBusinessDayUtcRange(date = new Date()) {
  const offsetMs = 210 * 60 * 1000;
  const local = new Date(date.getTime() + offsetMs);
  const startLocalAsUtc = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  return {
    start: new Date(startLocalAsUtc - offsetMs),
    end: new Date(startLocalAsUtc + 86400000 - offsetMs),
  };
}

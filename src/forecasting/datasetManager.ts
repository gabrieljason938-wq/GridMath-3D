export type TimezoneOption = 'Asia/Kolkata' | 'UTC' | 'Local';

export interface ForecastTimeRecord {
  index: number;
  epochMs: number;
  timestampIso: string;
  displayLabel: string;
  hour: number; // 0..23 in selected timezone
  dayOfWeek: number; // 0 (Sun) .. 6 (Sat)
  isWeekend: boolean;
  isHoliday: boolean;
  demandMW: number;
  temperatureDegC: number;
  humidityPct: number | null;
  weatherCondition: string;
  isSynthetic: boolean;
}

export interface DataQualityReport {
  totalRawRows: number;
  validRows: number;
  missingValueCount: number;
  duplicateTimestampCount: number;
  invalidValueCount: number;
  timezone: TimezoneOption;
  chronologicallySorted: boolean;
  issues: string[];
}

export interface ForecastDatasetBundle {
  datasetId: string;
  datasetName: string;
  isSynthetic: boolean;
  provenanceNotice: string;
  timezone: TimezoneOption;
  records: ForecastTimeRecord[];
  qualityReport: DataQualityReport;
}

const IST_OFFSET_MS = 5.5 * 3600 * 1000;

function extractTimeParts(
  epochMs: number,
  timezone: TimezoneOption,
): { hour: number; dayOfWeek: number; displayLabel: string; timestampIso: string } {
  if (timezone === 'UTC') {
    const d = new Date(epochMs);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = d.getUTCHours();
    return {
      hour: hh,
      dayOfWeek: d.getUTCDay(),
      displayLabel: `${mm}-${dd} ${String(hh).padStart(2, '0')}:00`,
      timestampIso: `${yyyy}-${mm}-${dd}T${String(hh).padStart(2, '0')}:00:00Z`,
    };
  }

  if (timezone === 'Asia/Kolkata') {
    const shifted = new Date(epochMs + IST_OFFSET_MS);
    const yyyy = shifted.getUTCFullYear();
    const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(shifted.getUTCDate()).padStart(2, '0');
    const hh = shifted.getUTCHours();
    return {
      hour: hh,
      dayOfWeek: shifted.getUTCDay(),
      displayLabel: `${mm}-${dd} ${String(hh).padStart(2, '0')}:00`,
      timestampIso: `${yyyy}-${mm}-${dd}T${String(hh).padStart(2, '0')}:00:00+05:30`,
    };
  }

  const d = new Date(epochMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = d.getHours();
  return {
    hour: hh,
    dayOfWeek: d.getDay(),
    displayLabel: `${mm}-${dd} ${String(hh).padStart(2, '0')}:00`,
    timestampIso: `${yyyy}-${mm}-${dd}T${String(hh).padStart(2, '0')}:00:00`,
  };
}

/**
 * Parses a timestamp string consistently under the chosen timezone.
 * If the string lacks an explicit offset (`Z` or `+/-HH:MM`), treats it as wall-clock
 * time in `timezone` so shifting browser locale never corrupts hour-of-day features.
 */
export function parseTimestampConsistent(
  raw: string,
  timezone: TimezoneOption,
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (hasExplicitZone) {
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Normalize space separator to 'T' for ISO parsing
  const normalized = trimmed.replace(' ', 'T');
  const match = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const hour = Number(match[4] ?? 0);
    const minute = Number(match[5] ?? 0);
    const second = Number(match[6] ?? 0);

    if (timezone === 'UTC') {
      return Date.UTC(year, month, day, hour, minute, second);
    }
    if (timezone === 'Asia/Kolkata') {
      return Date.UTC(year, month, day, hour, minute, second) - IST_OFFSET_MS;
    }
    return new Date(year, month, day, hour, minute, second).getTime();
  }

  const fallback = Date.parse(trimmed);
  return Number.isFinite(fallback) ? fallback : null;
}

/**
 * Generates a documented 14-day (336-hour) deterministic synthetic demonstration dataset.
 * Strictly labeled synthetic — never presented as measured real-world demand.
 */
export function generateSyntheticHistoryDataset(
  timezone: TimezoneOption = 'Asia/Kolkata',
  days = 14,
): ForecastDatasetBundle {
  const totalHours = Math.max(72, days * 24);
  // Deterministic start: 2026-10-01 00:00 in IST
  const startUtcMs = Date.UTC(2026, 9, 1, 0, 0, 0) - IST_OFFSET_MS;
  const records: ForecastTimeRecord[] = [];

  for (let i = 0; i < totalHours; i++) {
    const epochMs = startUtcMs + i * 3600 * 1000;
    const parts = extractTimeParts(epochMs, timezone);
    const h = parts.hour;
    const dow = parts.dayOfWeek;
    const isWeekend = dow === 0 || dow === 6;
    // Day 10 (Oct 11) flagged as synthetic public holiday example
    const dayIdx = Math.floor(i / 24);
    const isHoliday = dayIdx === 10;

    // Deterministic multi-day ambient temperature wave (22°C night -> 35°C afternoon + synoptic cycle)
    const synopticShift = 1.8 * Math.sin((2 * Math.PI * dayIdx) / 7) + 0.9 * Math.cos((2 * Math.PI * dayIdx) / 5);
    const temperatureDegC = Number(
      (28.4 - 5.6 * Math.cos((2 * Math.PI * (h - 2.5)) / 24) + synopticShift).toFixed(1),
    );
    const humidityPct = Number(
      Math.max(28, Math.min(92, 62 + 16 * Math.cos((2 * Math.PI * (h - 3)) / 24) - synopticShift * 2.2)).toFixed(0),
    );

    // Deterministic synthetic load curve driven by harmonics, thermal cooling, calendar & humidity
    const diurnalBase =
      305 -
      76 * Math.cos((2 * Math.PI * (h - 2)) / 24) +
      28 * Math.sin((4 * Math.PI * (h - 6)) / 24) +
      16 * Math.cos((2 * Math.PI * (h - 20)) / 24);
    const thermalEffect = Math.max(0, temperatureDegC - 24) * 5.4;
    const humidityEffect = Math.max(0, humidityPct - 60) * 0.28;
    const calendarOffset = isHoliday ? -42 : isWeekend ? -26 : 6;
    const smallHarmonicRipple = 4.5 * Math.sin((2 * Math.PI * i) / 37);

    const demandMW = Number(
      Math.max(120, diurnalBase + thermalEffect + humidityEffect + calendarOffset + smallHarmonicRipple).toFixed(2),
    );

    const weatherCondition =
      humidityPct > 74 ? 'Humid' : h >= 7 && h <= 17 ? 'Clear Sun' : 'Clear Night';

    records.push({
      index: i,
      epochMs,
      timestampIso: parts.timestampIso,
      displayLabel: parts.displayLabel,
      hour: h,
      dayOfWeek: dow,
      isWeekend,
      isHoliday,
      demandMW,
      temperatureDegC,
      humidityPct,
      weatherCondition,
      isSynthetic: true,
    });
  }

  return {
    datasetId: 'synthetic-14d-demo',
    datasetName: `Synthetic Urban Microgrid History (${totalHours}h / ${days} Days)`,
    isSynthetic: true,
    provenanceNotice:
      'Documented Synthetic Demonstration Dataset — generated deterministically from diurnal harmonics, temperature sensitivity, and weekend/holiday calendars. Not measured real-world utility data.',
    timezone,
    records,
    qualityReport: {
      totalRawRows: totalHours,
      validRows: totalHours,
      missingValueCount: 0,
      duplicateTimestampCount: 0,
      invalidValueCount: 0,
      timezone,
      chronologicallySorted: true,
      issues: [],
    },
  };
}

/**
 * Generates a downloadable CSV string matching the ingestion schema.
 */
export function buildSampleForecastCsv(bundle?: ForecastDatasetBundle): string {
  const source = bundle ?? generateSyntheticHistoryDataset('Asia/Kolkata', 5);
  const header = 'timestamp,demand_mw,temperature_c,humidity_pct,weather,is_holiday';
  const rows = source.records.map(
    (r) =>
      `${r.timestampIso},${r.demandMW.toFixed(2)},${r.temperatureDegC.toFixed(1)},${r.humidityPct ?? ''},${r.weatherCondition},${r.isHoliday ? 1 : 0}`,
  );
  return [header, ...rows].join('\n');
}

/**
 * Parses uploaded CSV data into validated ForecastTimeRecords with missing-value detection,
 * duplicate timestamp detection, invalid-value filtering, and consistent timezone normalization.
 */
export function parseForecastCsv(
  csvText: string,
  datasetName: string,
  timezone: TimezoneOption = 'Asia/Kolkata',
): ForecastDatasetBundle {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      datasetId: 'csv-empty',
      datasetName,
      isSynthetic: false,
      provenanceNotice: 'Uploaded CSV dataset (insufficient rows).',
      timezone,
      records: [],
      qualityReport: {
        totalRawRows: Math.max(0, lines.length - 1),
        validRows: 0,
        missingValueCount: 0,
        duplicateTimestampCount: 0,
        invalidValueCount: 0,
        timezone,
        chronologicallySorted: true,
        issues: ['CSV must include a header row and at least 1 data row.'],
      },
    };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const findCol = (candidates: string[]) =>
    headers.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  const invalidUnitHeaders = headers.filter(
    (h) =>
      /(?:_kw|_w|_gw|_kwh|watt|kilowatt|gigawatt)/.test(h) ||
      /(?:_f$|_fahrenheit|fahrenheit|_kelvin|kelvin)/.test(h),
  );

  const tsCol = findCol(['timestamp', 'datetime', 'time', 'date']);
  const mwCol = findCol(['demand_mw', 'demand', 'load_mw', 'load', 'mw']);
  const tempCol = findCol(['temperature_c', 'temperature', 'temp_c', 'temp']);
  const humCol = findCol(['humidity_pct', 'humidity', 'rh']);
  const weatherCol = findCol(['weather', 'condition']);
  const holidayCol = findCol(['is_holiday', 'holiday']);

  const issues: string[] = [];
  if (invalidUnitHeaders.length > 0) {
    issues.push(
      `Invalid unit detected in header (${invalidUnitHeaders.join(', ')}): GRIDMATH 3D requires canonical units demand_mw (MW) and temperature_c (°C).`,
    );
    return {
      datasetId: 'csv-invalid-units',
      datasetName,
      isSynthetic: false,
      provenanceNotice: 'Uploaded CSV dataset (invalid unit error).',
      timezone,
      records: [],
      qualityReport: {
        totalRawRows: lines.length - 1,
        validRows: 0,
        missingValueCount: 0,
        duplicateTimestampCount: 0,
        invalidValueCount: lines.length - 1,
        timezone,
        chronologicallySorted: true,
        issues,
      },
    };
  }

  if (tsCol === -1 || mwCol === -1 || tempCol === -1) {
    issues.push(
      'Required columns missing: expected timestamp, demand_mw (or demand), and temperature_c (or temp).',
    );
    return {
      datasetId: 'csv-invalid-schema',
      datasetName,
      isSynthetic: false,
      provenanceNotice: 'Uploaded CSV dataset (schema error).',
      timezone,
      records: [],
      qualityReport: {
        totalRawRows: lines.length - 1,
        validRows: 0,
        missingValueCount: 0,
        duplicateTimestampCount: 0,
        invalidValueCount: 0,
        timezone,
        chronologicallySorted: true,
        issues,
      },
    };
  }

  let missingValueCount = 0;
  let duplicateTimestampCount = 0;
  let invalidValueCount = 0;
  const seenEpochs = new Set<number>();
  const parsedRows: Omit<ForecastTimeRecord, 'index'>[] = [];

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cols = lines[rowIdx].split(',').map((c) => c.trim());
    const rawTs = cols[tsCol] ?? '';
    const rawMw = cols[mwCol] ?? '';
    const rawTemp = cols[tempCol] ?? '';

    if (!rawTs || !rawMw || !rawTemp) {
      missingValueCount++;
      if (issues.length < 8) {
        issues.push(`Row ${rowIdx + 1}: missing required timestamp, demand, or temperature cell.`);
      }
      continue;
    }

    const epochMs = parseTimestampConsistent(rawTs, timezone);
    const demandMW = Number(rawMw);
    const temperatureDegC = Number(rawTemp);

    if (
      epochMs === null ||
      !Number.isFinite(demandMW) ||
      demandMW < 0 ||
      !Number.isFinite(temperatureDegC) ||
      temperatureDegC < -45 ||
      temperatureDegC > 60
    ) {
      invalidValueCount++;
      if (issues.length < 8) {
        issues.push(
          `Row ${rowIdx + 1}: invalid timestamp or out-of-bounds numeric value (MW=${rawMw}, T=${rawTemp}).`,
        );
      }
      continue;
    }

    // Round epoch to nearest minute for duplicate detection
    const dedupKey = Math.round(epochMs / 60000);
    if (seenEpochs.has(dedupKey)) {
      duplicateTimestampCount++;
      if (issues.length < 8) {
        issues.push(`Row ${rowIdx + 1}: duplicate timestamp "${rawTs}" skipped.`);
      }
      continue;
    }
    seenEpochs.add(dedupKey);

    let humidityPct: number | null = null;
    if (humCol !== -1 && cols[humCol] !== undefined && cols[humCol] !== '') {
      const parsedHum = Number(cols[humCol]);
      if (Number.isFinite(parsedHum) && parsedHum >= 0 && parsedHum <= 100) {
        humidityPct = parsedHum;
      } else {
        invalidValueCount++;
        if (issues.length < 8) {
          issues.push(`Row ${rowIdx + 1}: invalid humidity "${cols[humCol]}"; ignored.`);
        }
      }
    }

    const rawHoliday = holidayCol !== -1 ? (cols[holidayCol] ?? '').toLowerCase() : '';
    const isHoliday =
      rawHoliday === '1' || rawHoliday === 'true' || rawHoliday === 'yes';

    const weatherCondition =
      weatherCol !== -1 && cols[weatherCol] ? cols[weatherCol] : 'Unspecified';

    const parts = extractTimeParts(epochMs, timezone);
    parsedRows.push({
      epochMs,
      timestampIso: parts.timestampIso,
      displayLabel: parts.displayLabel,
      hour: parts.hour,
      dayOfWeek: parts.dayOfWeek,
      isWeekend: parts.dayOfWeek === 0 || parts.dayOfWeek === 6,
      isHoliday,
      demandMW: Number(demandMW.toFixed(2)),
      temperatureDegC: Number(temperatureDegC.toFixed(2)),
      humidityPct,
      weatherCondition,
      isSynthetic: false,
    });
  }

  parsedRows.sort((a, b) => a.epochMs - b.epochMs);
  const records: ForecastTimeRecord[] = parsedRows.map((row, idx) => ({
    ...row,
    index: idx,
  }));

  return {
    datasetId: `csv-${Date.now()}`,
    datasetName,
    isSynthetic: false,
    provenanceNotice: `User-uploaded CSV dataset (${records.length} validated hourly records in ${timezone}).`,
    timezone,
    records,
    qualityReport: {
      totalRawRows: lines.length - 1,
      validRows: records.length,
      missingValueCount,
      duplicateTimestampCount,
      invalidValueCount,
      timezone,
      chronologicallySorted: true,
      issues,
    },
  };
}

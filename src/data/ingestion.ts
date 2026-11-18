import type {
  Battery,
  Generator,
  HourlyDemand,
  ScenarioValidationReport,
  SimulationScenario,
} from '../types/grid';

export function validateHourlyDemand(record: HourlyDemand): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(record.hour) || record.hour < 0 || record.hour > 23) {
    errors.push(`Invalid hour index ${record.hour}; expected integer in [0, 23].`);
  }
  if (record.totalMW < 0 || !Number.isFinite(record.totalMW)) {
    errors.push(`Hour ${record.hour}: totalMW must be a finite non-negative number.`);
  }
  if (
    !Number.isFinite(record.residentialMW) ||
    record.residentialMW < 0 ||
    !Number.isFinite(record.commercialMW) ||
    record.commercialMW < 0 ||
    !Number.isFinite(record.industrialMW) ||
    record.industrialMW < 0
  ) {
    errors.push(`Hour ${record.hour}: sector demands must be finite non-negative numbers.`);
  }
  const sectorSum = record.residentialMW + record.commercialMW + record.industrialMW;
  if (Math.abs(sectorSum - record.totalMW) > 0.05) {
    errors.push(
      `Hour ${record.hour}: sector demands (${sectorSum.toFixed(2)} MW) do not reconcile with totalMW (${record.totalMW.toFixed(2)} MW).`,
    );
  }
  if (
    !Number.isFinite(record.solarIrradianceWm2) ||
    record.solarIrradianceWm2 < 0 ||
    record.solarIrradianceWm2 > 1400
  ) {
    errors.push(
      `Hour ${record.hour}: solarIrradianceWm2 (${record.solarIrradianceWm2}) out of physical range [0, 1400] W/m2.`,
    );
  }
  if (
    !Number.isFinite(record.windCapacityFactor) ||
    record.windCapacityFactor < 0 ||
    record.windCapacityFactor > 1
  ) {
    errors.push(`Hour ${record.hour}: windCapacityFactor (${record.windCapacityFactor}) must be in [0, 1].`);
  }
  if (!Number.isFinite(record.temperatureDegC) || record.temperatureDegC < -45 || record.temperatureDegC > 60) {
    errors.push(`Hour ${record.hour}: temperatureDegC (${record.temperatureDegC}) out of physical range [-45, 60] °C.`);
  }
  if (!Number.isFinite(record.tariffInrPerMWh) || record.tariffInrPerMWh < 0) {
    errors.push(`Hour ${record.hour}: tariffInrPerMWh must be finite and non-negative.`);
  }

  return errors;
}

export function validateGenerator(gen: Generator): string[] {
  const errors: string[] = [];
  if (gen.minMW < 0 || gen.maxMW <= 0 || gen.minMW > gen.maxMW) {
    errors.push(`Generator ${gen.id}: invalid capacity bounds [${gen.minMW}, ${gen.maxMW}] MW.`);
  }
  if (gen.rampRateMWPerHour <= 0) {
    errors.push(`Generator ${gen.id}: rampRateMWPerHour must be positive.`);
  }
  if (gen.marginalCostInrPerMWh < 0) {
    errors.push(`Generator ${gen.id}: marginalCostInrPerMWh cannot be negative.`);
  }
  if (gen.carbonIntensityKgPerMWh < 0) {
    errors.push(`Generator ${gen.id}: carbonIntensityKgPerMWh cannot be negative.`);
  }
  return errors;
}

export function validateBattery(battery: Battery): string[] {
  const errors: string[] = [];
  if (battery.capacityMWh <= 0) {
    errors.push(`Battery ${battery.id}: capacityMWh must be positive.`);
  }
  if (battery.maxChargeMW < 0 || battery.maxDischargeMW < 0) {
    errors.push(`Battery ${battery.id}: charge/discharge power limits must be non-negative.`);
  }
  if (battery.roundTripEfficiency <= 0 || battery.roundTripEfficiency > 1) {
    errors.push(`Battery ${battery.id}: roundTripEfficiency must lie in (0, 1].`);
  }
  if (battery.minSocRatio < 0 || battery.maxSocRatio > 1 || battery.minSocRatio >= battery.maxSocRatio) {
    errors.push(`Battery ${battery.id}: invalid SoC bounds [${battery.minSocRatio}, ${battery.maxSocRatio}].`);
  }
  const minMWh = battery.capacityMWh * battery.minSocRatio;
  const maxMWh = battery.capacityMWh * battery.maxSocRatio;
  if (battery.initialSocMWh < minMWh - 1e-6 || battery.initialSocMWh > maxMWh + 1e-6) {
    errors.push(`Battery ${battery.id}: initialSocMWh (${battery.initialSocMWh} MWh) outside operating window [${minMWh}, ${maxMWh}] MWh.`);
  }
  return errors;
}

export function validateScenario(scenario: SimulationScenario): ScenarioValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (scenario.hourlyDemand.length !== 24) {
    errors.push(`Scenario ${scenario.id}: expected 24 hourly records, found ${scenario.hourlyDemand.length}.`);
  }

  const seenHours = new Set<number>();
  for (const record of scenario.hourlyDemand) {
    if (seenHours.has(record.hour)) {
      errors.push(`Scenario ${scenario.id}: duplicate hour index ${record.hour}.`);
    }
    seenHours.add(record.hour);
    errors.push(...validateHourlyDemand(record));
  }

  for (const gen of scenario.generators) {
    errors.push(...validateGenerator(gen));
  }

  errors.push(...validateBattery(scenario.battery));

  if (!scenario.isSynthetic) {
    warnings.push('Non-synthetic dataset detected; verify external telemetry calibration.');
  }

  const maxHourDemand = Math.max(...scenario.hourlyDemand.map((h) => h.totalMW));
  const totalNameplate = scenario.generators
    .filter((g) => g.available)
    .reduce((acc, g) => acc + g.maxMW, 0);

  if (maxHourDemand > totalNameplate) {
    warnings.push(
      `Peak demand (${maxHourDemand.toFixed(1)} MW) exceeds total nameplate capacity (${totalNameplate.toFixed(1)} MW); unserved energy risk.`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checkedRecords: scenario.hourlyDemand.length + scenario.generators.length + 1,
  };
}

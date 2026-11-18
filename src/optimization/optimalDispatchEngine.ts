import { solveLinearProgram, type LPResult, type LinearProgramSpec } from '../math/linearProgramming';
import type {
  DaySimulationSummary,
  DispatchResult,
  Generator,
  GeneratorSetpoint,
  GeneratorTechnology,
  GridBalanceStatus,
  HourlyDemand,
  SimulationScenario,
  SubsystemPhaseStatus,
} from '../types/grid';
import { solveBoundedLP, type BoundedLPRow } from './boundedSimplex';

export type DispatchStrategyId = 'lp-optimal' | 'renewable-heuristic' | 'thermal-first';

export interface EmissionFactorsConfig {
  solar: number;
  wind: number;
  hydro: number;
  gas: number;
  coal: number;
}

export interface DispatchOptimizationConfig {
  strategy: DispatchStrategyId;
  vollPenaltyInrPerMWh: number;
  carbonPriceInrPerTonne: number;
  enableCarbonCap: boolean;
  carbonCapTonnesCO2e: number;
  enforceTerminalSocTarget: boolean;
  terminalSocTargetMWh: number;
  renewableOmCostInrPerMWh: number;
  batteryCycleCostInrPerMWh: number;
  enforceUnitMinStable: boolean;
  emissionFactorsKgPerMWh: EmissionFactorsConfig;
}

export interface ConstraintResidualSummary {
  maxPowerBalanceResidualMW: number;
  maxBatterySocDynamicsErrorMWh: number;
  maxRampViolationMW: number;
  maxCapacityBoundViolationMW: number;
  terminalSocAchievedMWh: number;
  terminalSocViolationMWh: number;
  carbonCapViolationTonnes: number;
  simultaneousChargeDischargeHours: number;
  allConstraintsSatisfied: boolean;
}

export interface StrategyComparisonMetrics {
  strategy: DispatchStrategyId;
  label: string;
  totalCostInr: number;
  costSavingsVsThermalFirstPercent: number;
  costSavingsVsHeuristicPercent: number;
  renewableContributionPercent: number;
  totalEmissionsTonnesCO2e: number;
  unservedEnergyMWh: number;
  curtailedRenewableMWh: number;
  maxBalanceResidualMW: number;
  solverStatus: string;
}

export interface OptimalDispatchBundle {
  config: DispatchOptimizationConfig;
  solverStatus: 'optimal' | 'infeasible' | 'heuristic' | 'iteration_limit';
  feasible: boolean;
  objectiveValueInr: number;
  operationalCostInr: number;
  carbonPenaltyCostInr: number;
  vollPenaltyCostInr: number;
  numVariables: number;
  numConstraints: number;
  simplexIterations: number;
  branchAndBoundNodes: number;
  lpRelaxationNote: string;
  residualSummary: ConstraintResidualSummary;
  summary: DaySimulationSummary;
  comparisons: StrategyComparisonMetrics[];
  comparisonSummaries: Record<DispatchStrategyId, DaySimulationSummary>;
}

export interface HourTwoVarSlice {
  hour: number;
  timestampLabel: string;
  spec: LinearProgramSpec;
  lpResult: LPResult;
  netResidualDemandMW: number;
}

export const DEFAULT_EMISSION_FACTORS: EmissionFactorsConfig = {
  solar: 0,
  wind: 0,
  hydro: 24,
  gas: 410,
  coal: 820,
};

export function createDefaultDispatchConfig(
  scenario: SimulationScenario,
): DispatchOptimizationConfig {
  return {
    strategy: 'lp-optimal',
    vollPenaltyInrPerMWh: 25000,
    carbonPriceInrPerTonne: 0,
    enableCarbonCap: false,
    carbonCapTonnesCO2e: 2200,
    enforceTerminalSocTarget: true,
    terminalSocTargetMWh: scenario.battery.initialSocMWh,
    renewableOmCostInrPerMWh: 0,
    batteryCycleCostInrPerMWh: scenario.battery.degradationCostInrPerMWh,
    enforceUnitMinStable: true,
    emissionFactorsKgPerMWh: { ...DEFAULT_EMISSION_FACTORS },
  };
}

function getAvailMaxMW(gen: Generator, hourData: HourlyDemand): number {
  if (!gen.available) return 0;
  if (gen.technology === 'solar') {
    const ratio = Math.min(1, Math.max(0, hourData.solarIrradianceWm2 / 1000));
    return Number((gen.maxMW * ratio).toFixed(2));
  }
  if (gen.technology === 'wind') {
    return Number((gen.maxMW * hourData.windCapacityFactor).toFixed(2));
  }
  return gen.maxMW;
}

function getEmissionFactor(
  tech: GeneratorTechnology,
  factors: EmissionFactorsConfig,
): number {
  return factors[tech];
}

function assembleDispatchSummary(params: {
  scenario: SimulationScenario;
  config: DispatchOptimizationConfig;
  hourlyGenDispatches: Map<string, number>[];
  hourlyBatteryChargeMW: number[];
  hourlyBatteryDischargeMW: number[];
  hourlyBatterySocMWh: number[];
  hourlyUnservedMW: number[];
  solverName: string;
  solverStatusLabel: SubsystemPhaseStatus;
}): {
  summary: DaySimulationSummary;
  residualSummary: ConstraintResidualSummary;
  operationalCostInr: number;
  carbonPenaltyCostInr: number;
  vollPenaltyCostInr: number;
} {
  const {
    scenario,
    config,
    hourlyGenDispatches,
    hourlyBatteryChargeMW,
    hourlyBatteryDischargeMW,
    hourlyBatterySocMWh,
    hourlyUnservedMW,
    solverName,
    solverStatusLabel,
  } = params;

  const battery = scenario.battery;
  const sqrtEta = Math.sqrt(battery.roundTripEfficiency);
  const minSocMWh = battery.capacityMWh * battery.minSocRatio;
  const maxSocMWh = battery.capacityMWh * battery.maxSocRatio;

  let maxPowerBalanceResidualMW = 0;
  let maxBatterySocDynamicsErrorMWh = 0;
  let maxRampViolationMW = 0;
  let maxCapacityBoundViolationMW = 0;
  let simultaneousChargeDischargeHours = 0;

  let operationalCostInr = 0;
  let carbonPenaltyCostInr = 0;
  let vollPenaltyCostInr = 0;

  const hourlyDispatches: DispatchResult[] = [];

  for (let t = 0; t < 24; t++) {
    const hourData = scenario.hourlyDemand[t];
    const demandMW = hourData.totalMW;
    const genMap = hourlyGenDispatches[t];
    const chMW = hourlyBatteryChargeMW[t];
    const disMW = hourlyBatteryDischargeMW[t];
    const socMWh = hourlyBatterySocMWh[t];
    const unservedMW = hourlyUnservedMW[t];
    const netBessMW = Number((disMW - chMW).toFixed(4));

    if (chMW > 1e-3 && disMW > 1e-3) {
      simultaneousChargeDischargeHours++;
    }

    const prevSoc = t === 0 ? battery.initialSocMWh : hourlyBatterySocMWh[t - 1];
    const expectedSoc = prevSoc + sqrtEta * chMW - disMW / sqrtEta;
    maxBatterySocDynamicsErrorMWh = Math.max(
      maxBatterySocDynamicsErrorMWh,
      Math.abs(socMWh - expectedSoc),
    );
    maxCapacityBoundViolationMW = Math.max(
      maxCapacityBoundViolationMW,
      Math.max(0, minSocMWh - socMWh),
      Math.max(0, socMWh - maxSocMWh),
      Math.max(0, chMW - battery.maxChargeMW),
      Math.max(0, disMW - battery.maxDischargeMW),
    );

    let totalAvailMW = 0;
    let totalDispatchedMW = 0;
    let renewableGenMW = 0;
    let renewableAvailMW = 0;
    let hourOpCostInr = (chMW + disMW) * config.batteryCycleCostInrPerMWh;
    let hourEmissionsKg = 0;

    const generatorSetpoints: GeneratorSetpoint[] = scenario.generators.map((gen) => {
      const availMax = getAvailMaxMW(gen, hourData);
      const dispatched = Number((genMap.get(gen.id) ?? 0).toFixed(3));
      const minBound =
        gen.dispatchable && gen.available && config.enforceUnitMinStable
          ? Math.min(gen.minMW, availMax)
          : 0;

      maxCapacityBoundViolationMW = Math.max(
        maxCapacityBoundViolationMW,
        Math.max(0, minBound - dispatched),
        Math.max(0, dispatched - availMax),
      );

      if (t > 0 && gen.dispatchable) {
        const prevDisp = hourlyGenDispatches[t - 1].get(gen.id) ?? 0;
        const rampDelta = Math.abs(dispatched - prevDisp);
        maxRampViolationMW = Math.max(
          maxRampViolationMW,
          Math.max(0, rampDelta - gen.rampRateMWPerHour),
        );
      }

      totalAvailMW += availMax;
      totalDispatchedMW += dispatched;
      if (gen.technology === 'solar' || gen.technology === 'wind' || gen.technology === 'hydro') {
        renewableGenMW += dispatched;
      }
      if (gen.technology === 'solar' || gen.technology === 'wind') {
        renewableAvailMW += availMax;
      }

      const unitPrice =
        gen.technology === 'solar' || gen.technology === 'wind'
          ? config.renewableOmCostInrPerMWh
          : gen.marginalCostInrPerMWh;
      const unitCost = dispatched * unitPrice;
      const ef = getEmissionFactor(gen.technology, config.emissionFactorsKgPerMWh);
      const unitEmissionsKg = dispatched * ef;

      hourOpCostInr += unitCost;
      hourEmissionsKg += unitEmissionsKg;

      return {
        generatorId: gen.id,
        name: gen.name,
        technology: gen.technology,
        availableMaxMW: availMax,
        dispatchedMW: Number(dispatched.toFixed(2)),
        utilizationPercent: availMax > 0 ? Number(((dispatched / availMax) * 100).toFixed(1)) : 0,
        hourlyCostInr: Math.round(unitCost),
        hourlyEmissionsKgCO2e: Number(unitEmissionsKg.toFixed(1)),
      };
    });

    const dispatchedNonDispRe = generatorSetpoints
      .filter((s) => s.technology === 'solar' || s.technology === 'wind')
      .reduce((acc, s) => acc + s.dispatchedMW, 0);
    const curtailmentMW = Number(Math.max(0, renewableAvailMW - dispatchedNonDispRe).toFixed(2));

    const balanceResidual = Math.abs(totalDispatchedMW + netBessMW + unservedMW - demandMW);
    maxPowerBalanceResidualMW = Math.max(maxPowerBalanceResidualMW, balanceResidual);

    const hourCarbonCost = (hourEmissionsKg / 1000) * config.carbonPriceInrPerTonne;
    const hourVollCost = unservedMW * config.vollPenaltyInrPerMWh;
    const hourTotalCost = hourOpCostInr + hourCarbonCost + hourVollCost;

    operationalCostInr += hourOpCostInr;
    carbonPenaltyCostInr += hourCarbonCost;
    vollPenaltyCostInr += hourVollCost;

    const supplyTotalMW = totalDispatchedMW + netBessMW;
    const reserveMarginMW = Number((totalAvailMW - demandMW).toFixed(2));
    let balanceStatus: GridBalanceStatus = 'Balanced';
    if (unservedMW > 0.5) balanceStatus = 'Deficit';
    else if (curtailmentMW > 1 || reserveMarginMW > 180) balanceStatus = 'Surplus';

    const renewableContributionPercent =
      supplyTotalMW > 0
        ? Number(Math.min(100, (renewableGenMW / supplyTotalMW) * 100).toFixed(1))
        : 0;

    hourlyDispatches.push({
      hour: hourData.hour,
      timestampLabel: hourData.timestampLabel,
      totalDemandMW: demandMW,
      totalAvailableGenerationMW: Number(totalAvailMW.toFixed(2)),
      totalDispatchedGenerationMW: Number(totalDispatchedMW.toFixed(2)),
      renewableGenerationMW: Number(renewableGenMW.toFixed(2)),
      renewableContributionPercent,
      batteryNetPowerMW: Number(netBessMW.toFixed(2)),
      batterySocMWh: Number(socMWh.toFixed(2)),
      batterySocPercent: Number(((socMWh / battery.capacityMWh) * 100).toFixed(1)),
      unservedEnergyMW: Number(unservedMW.toFixed(2)),
      curtailmentMW,
      dispatchCostInr: Math.round(hourTotalCost),
      averageCostInrPerMWh: demandMW > 0 ? Math.round(hourTotalCost / demandMW) : 0,
      emissionsKgCO2e: Number(hourEmissionsKg.toFixed(1)),
      emissionsTonnesCO2e: Number((hourEmissionsKg / 1000).toFixed(2)),
      balanceStatus,
      reserveMarginMW,
      generatorSetpoints,
      solverName,
      solverStatus: solverStatusLabel,
    });
  }

  let peakDemandMW = 0;
  let peakDemandHour = 0;
  let totalDailyEnergyMWh = 0;
  let totalDailyCostInr = 0;
  let totalDailyEmissionsKg = 0;
  let renewableSumPercent = 0;

  for (const h of hourlyDispatches) {
    if (h.totalDemandMW > peakDemandMW) {
      peakDemandMW = h.totalDemandMW;
      peakDemandHour = h.hour;
    }
    totalDailyEnergyMWh += h.totalDemandMW;
    totalDailyCostInr += h.dispatchCostInr;
    totalDailyEmissionsKg += h.emissionsKgCO2e;
    renewableSumPercent += h.renewableContributionPercent;
  }

  const totalTonnes = Number((totalDailyEmissionsKg / 1000).toFixed(2));
  const terminalSocAchievedMWh = hourlyBatterySocMWh[23] ?? battery.initialSocMWh;
  const terminalSocViolationMWh = config.enforceTerminalSocTarget
    ? Math.max(0, config.terminalSocTargetMWh - terminalSocAchievedMWh)
    : 0;
  const carbonCapViolationTonnes = config.enableCarbonCap
    ? Math.max(0, totalTonnes - config.carbonCapTonnesCO2e)
    : 0;

  const allConstraintsSatisfied =
    maxPowerBalanceResidualMW < 1e-2 &&
    maxBatterySocDynamicsErrorMWh < 1e-2 &&
    maxRampViolationMW < 1e-2 &&
    maxCapacityBoundViolationMW < 1e-2 &&
    terminalSocViolationMWh < 1e-2 &&
    carbonCapViolationTonnes < 1e-2;

  return {
    summary: {
      scenarioId: scenario.id,
      predictedPeakDemandMW: Number(peakDemandMW.toFixed(2)),
      peakDemandHour,
      totalDailyEnergyMWh: Number(totalDailyEnergyMWh.toFixed(1)),
      totalDailyCostInr: Math.round(totalDailyCostInr),
      totalDailyEmissionsTonnesCO2e: totalTonnes,
      averageRenewableSharePercent: Number((renewableSumPercent / 24).toFixed(1)),
      hourlyDispatches,
    },
    residualSummary: {
      maxPowerBalanceResidualMW: Number(maxPowerBalanceResidualMW.toFixed(6)),
      maxBatterySocDynamicsErrorMWh: Number(maxBatterySocDynamicsErrorMWh.toFixed(6)),
      maxRampViolationMW: Number(maxRampViolationMW.toFixed(6)),
      maxCapacityBoundViolationMW: Number(maxCapacityBoundViolationMW.toFixed(6)),
      terminalSocAchievedMWh: Number(terminalSocAchievedMWh.toFixed(2)),
      terminalSocViolationMWh: Number(terminalSocViolationMWh.toFixed(4)),
      carbonCapViolationTonnes: Number(carbonCapViolationTonnes.toFixed(4)),
      simultaneousChargeDischargeHours,
      allConstraintsSatisfied,
    },
    operationalCostInr: Math.round(operationalCostInr),
    carbonPenaltyCostInr: Math.round(carbonPenaltyCostInr),
    vollPenaltyCostInr: Math.round(vollPenaltyCostInr),
  };
}

/**
 * Strategy 1 & 2: Ramp-aware deterministic heuristic dispatchers
 * (Thermal-First Baseline vs Renewable-Priority Heuristic) using identical constraints.
 */
function runConstrainedHeuristicStrategy(
  scenario: SimulationScenario,
  config: DispatchOptimizationConfig,
  mode: 'thermal-first' | 'renewable-heuristic',
) {
  const gens = scenario.generators;
  const battery = scenario.battery;
  const sqrtEta = Math.sqrt(battery.roundTripEfficiency);
  const minSocMWh = battery.capacityMWh * battery.minSocRatio;
  const maxSocMWh = battery.capacityMWh * battery.maxSocRatio;

  let socMWh = battery.initialSocMWh;
  const prevGenMW = new Map<string, number>();

  const hourlyGenDispatches: Map<string, number>[] = [];
  const hourlyCh: number[] = [];
  const hourlyDis: number[] = [];
  const hourlySoc: number[] = [];
  const hourlyUnserved: number[] = [];

  for (let t = 0; t < 24; t++) {
    const h = scenario.hourlyDemand[t];
    const demandMW = h.totalMW;
    const gMap = new Map<string, number>();

    // Compute per-unit min/max bounds including ramp window from t - 1
    const bounds = new Map<string, { lo: number; hi: number; avail: number }>();
    for (const g of gens) {
      const avail = getAvailMaxMW(g, h);
      let lo = g.dispatchable && g.available && config.enforceUnitMinStable ? Math.min(g.minMW, avail) : 0;
      let hi = avail;
      if (t > 0 && g.dispatchable) {
        const prev = prevGenMW.get(g.id) ?? lo;
        lo = Math.max(lo, prev - g.rampRateMWPerHour);
        hi = Math.min(hi, prev + g.rampRateMWPerHour);
        if (lo > hi) lo = hi;
      }
      bounds.set(g.id, { lo, hi, avail });
      gMap.set(g.id, lo);
    }

    // Priority order differs strictly by strategy:
    // Thermal-First commits Coal -> Gas -> Hydro -> Wind -> Solar
    // Renewable-Priority commits Solar -> Wind -> Hydro -> Gas -> Coal
    const priorityRank = (tech: GeneratorTechnology) => {
      if (mode === 'thermal-first') {
        const order: Record<GeneratorTechnology, number> = {
          coal: 0,
          gas: 1,
          hydro: 2,
          wind: 3,
          solar: 4,
        };
        return order[tech];
      }
      const order: Record<GeneratorTechnology, number> = {
        solar: 0,
        wind: 1,
        hydro: 2,
        gas: 3,
        coal: 4,
      };
      return order[tech];
    };

    const sortedGens = [...gens].sort((a, b) => priorityRank(a.technology) - priorityRank(b.technology));

    let chMW = 0;
    let disMW = 0;

    // Enforce terminal SoC target parity across all strategies when active
    const terminalTarget = config.enforceTerminalSocTarget
      ? Math.max(minSocMWh, Math.min(maxSocMWh, config.terminalSocTargetMWh))
      : minSocMWh;
    const remHoursAfterThis = 23 - t;
    const minEndOfHourSoc = Math.max(
      minSocMWh,
      terminalTarget - remHoursAfterThis * battery.maxChargeMW * sqrtEta,
    );
    const maxAllowedDischarge = Math.max(0, (socMWh - minEndOfHourSoc) * sqrtEta);
    const minRequiredCharge = Math.min(
      battery.maxChargeMW,
      Math.max(0, (minEndOfHourSoc - socMWh) / sqrtEta),
    );

    if (mode === 'renewable-heuristic') {
      // Heuristic BESS: charge on solar excess or off-peak, discharge during high tariff/peak
      const solarWindMax = gens
        .filter((g) => !g.dispatchable)
        .reduce((acc, g) => acc + (bounds.get(g.id)?.hi ?? 0), 0);
      const minDispSum = gens
        .filter((g) => g.dispatchable)
        .reduce((acc, g) => acc + (bounds.get(g.id)?.lo ?? 0), 0);

      const excessRe = solarWindMax + minDispSum - demandMW;
      if (excessRe > 0 && socMWh < maxSocMWh) {
        const room = (maxSocMWh - socMWh) / sqrtEta;
        chMW = Math.min(excessRe, battery.maxChargeMW, room);
      } else if (
        (h.tariffInrPerMWh >= 6400 || demandMW - solarWindMax > 305) &&
        maxAllowedDischarge > 0
      ) {
        disMW = Math.min(
          Math.max(0, demandMW - solarWindMax - minDispSum),
          battery.maxDischargeMW,
          maxAllowedDischarge,
        );
      } else if (h.tariffInrPerMWh <= 4100 && socMWh < maxSocMWh * 0.85) {
        const room = (maxSocMWh - socMWh) / sqrtEta;
        chMW = Math.min(battery.maxChargeMW * 0.5, room);
      }
    }

    if (minRequiredCharge > chMW) {
      chMW = minRequiredCharge;
      disMW = 0;
    }

    const baseCommitted = gens.reduce((acc, g) => acc + (gMap.get(g.id) ?? 0), 0);
    let remainingNeed = demandMW + chMW - disMW - baseCommitted;

    // If remainingNeed < 0 (e.g., thermal-first or ramp floors exceed demand), try absorbing via BESS charge
    if (remainingNeed < 0 && socMWh < maxSocMWh) {
      const extraCharge = Math.min(
        -remainingNeed,
        battery.maxChargeMW - chMW,
        (maxSocMWh - socMWh) / sqrtEta - chMW,
      );
      if (extraCharge > 0) {
        chMW += extraCharge;
        remainingNeed += extraCharge;
      }
    }

    for (const g of sortedGens) {
      if (remainingNeed <= 1e-6) break;
      const bnd = bounds.get(g.id)!;
      const current = gMap.get(g.id) ?? 0;
      const headroom = Math.max(0, bnd.hi - current);
      const add = Math.min(headroom, remainingNeed);
      gMap.set(g.id, current + add);
      remainingNeed -= add;
    }

    // If still unserved, discharge battery within terminal-safe headroom
    if (remainingNeed > 1e-4 && maxAllowedDischarge > disMW && chMW < 1e-6) {
      const emergencyDis = Math.min(
        remainingNeed,
        battery.maxDischargeMW - disMW,
        maxAllowedDischarge - disMW,
      );
      if (emergencyDis > 0) {
        disMW += emergencyDis;
        remainingNeed -= emergencyDis;
      }
    }

    const unserved = Math.max(0, remainingNeed);
    socMWh = Number(
      Math.max(minSocMWh, Math.min(maxSocMWh, socMWh + sqrtEta * chMW - disMW / sqrtEta)).toFixed(4),
    );

    gens.forEach((g) => prevGenMW.set(g.id, gMap.get(g.id) ?? 0));
    hourlyGenDispatches.push(gMap);
    hourlyCh.push(chMW);
    hourlyDis.push(disMW);
    hourlySoc.push(socMWh);
    hourlyUnserved.push(unserved);
  }

  return assembleDispatchSummary({
    scenario,
    config,
    hourlyGenDispatches,
    hourlyBatteryChargeMW: hourlyCh,
    hourlyBatteryDischargeMW: hourlyDis,
    hourlyBatterySocMWh: hourlySoc,
    hourlyUnservedMW: hourlyUnserved,
    solverName:
      mode === 'thermal-first'
        ? 'Thermal-First Baseline (Constrained)'
        : 'Renewable-Priority Merit Heuristic',
    solverStatusLabel: 'Heuristic Active',
  });
}

/**
 * Strategy 3: Global 24-Hour Multi-Period Optimal Dispatch via Two-Phase Bounded Simplex LP
 * plus Branch-and-Bound Binary Complementarity check on Battery Charge/Discharge.
 */
function runMultiPeriodLPSolver(
  scenario: SimulationScenario,
  config: DispatchOptimizationConfig,
) {
  const gens = scenario.generators;
  const battery = scenario.battery;
  const sqrtEta = Math.sqrt(battery.roundTripEfficiency);
  const minSocMWh = battery.capacityMWh * battery.minSocRatio;
  const maxSocMWh = battery.capacityMWh * battery.maxSocRatio;

  // Variables per hour t (9 vars per hour):
  // 0..4: generators in order of scenario.generators (5 units: solar, wind, hydro, gas, coal)
  // 5: pCh_t (battery charge MW)
  // 6: pDis_t (battery discharge MW)
  // 7: soc_t (battery SoC MWh)
  // 8: unserved_t (unserved load MW)
  const gCount = gens.length;
  const varsPerHour = gCount + 4;
  const numVars = 24 * varsPerHour;

  const colIdx = (t: number, offset: number) => t * varsPerHour + offset;
  const chOffset = gCount;
  const disOffset = gCount + 1;
  const socOffset = gCount + 2;
  const unservedOffset = gCount + 3;

  const varNames: string[] = [];
  const objective = Array<number>(numVars).fill(0);
  const lowerBounds = Array<number>(numVars).fill(0);
  const upperBounds = Array<number>(numVars).fill(0);

  for (let t = 0; t < 24; t++) {
    const h = scenario.hourlyDemand[t];
    gens.forEach((g, gi) => {
      const idx = colIdx(t, gi);
      varNames[idx] = `${g.technology}_t${t}`;
      const avail = getAvailMaxMW(g, h);
      const minB =
        g.dispatchable && g.available && config.enforceUnitMinStable
          ? Math.min(g.minMW, avail)
          : 0;
      lowerBounds[idx] = minB;
      upperBounds[idx] = avail;

      const baseCost =
        g.technology === 'solar' || g.technology === 'wind'
          ? config.renewableOmCostInrPerMWh
          : g.marginalCostInrPerMWh;
      const efTonnes = getEmissionFactor(g.technology, config.emissionFactorsKgPerMWh) / 1000;
      objective[idx] = baseCost + efTonnes * config.carbonPriceInrPerTonne;
    });

    const iCh = colIdx(t, chOffset);
    varNames[iCh] = `P_ch_t${t}`;
    lowerBounds[iCh] = 0;
    upperBounds[iCh] = battery.maxChargeMW;
    objective[iCh] = config.batteryCycleCostInrPerMWh;

    const iDis = colIdx(t, disOffset);
    varNames[iDis] = `P_dis_t${t}`;
    lowerBounds[iDis] = 0;
    upperBounds[iDis] = battery.maxDischargeMW;
    objective[iDis] = config.batteryCycleCostInrPerMWh;

    const iSoc = colIdx(t, socOffset);
    varNames[iSoc] = `SoC_t${t}`;
    lowerBounds[iSoc] = minSocMWh;
    upperBounds[iSoc] = maxSocMWh;
    objective[iSoc] = 0;

    if (t === 23 && config.enforceTerminalSocTarget) {
      lowerBounds[iSoc] = Math.max(
        minSocMWh,
        Math.min(maxSocMWh, config.terminalSocTargetMWh),
      );
    }

    const iUns = colIdx(t, unservedOffset);
    varNames[iUns] = `U_t${t}`;
    lowerBounds[iUns] = 0;
    upperBounds[iUns] = h.totalMW;
    objective[iUns] = config.vollPenaltyInrPerMWh;
  }

  const rows: BoundedLPRow[] = [];

  // 1. Hourly Power Balance Equations (24 equality rows)
  for (let t = 0; t < 24; t++) {
    const terms: { col: number; coeff: number }[] = [];
    for (let gi = 0; gi < gCount; gi++) {
      terms.push({ col: colIdx(t, gi), coeff: 1 });
    }
    terms.push({ col: colIdx(t, disOffset), coeff: 1 });
    terms.push({ col: colIdx(t, chOffset), coeff: -1 });
    terms.push({ col: colIdx(t, unservedOffset), coeff: 1 });

    rows.push({
      name: `balance_t${t}`,
      terms,
      op: '=',
      rhs: scenario.hourlyDemand[t].totalMW,
    });
  }

  // 2. Battery State-of-Charge Dynamics (24 equality rows)
  for (let t = 0; t < 24; t++) {
    const terms: { col: number; coeff: number }[] = [
      { col: colIdx(t, socOffset), coeff: 1 },
      { col: colIdx(t, chOffset), coeff: -sqrtEta },
      { col: colIdx(t, disOffset), coeff: 1 / sqrtEta },
    ];
    if (t > 0) {
      terms.push({ col: colIdx(t - 1, socOffset), coeff: -1 });
    }
    rows.push({
      name: `soc_t${t}`,
      terms,
      op: '=',
      rhs: t === 0 ? battery.initialSocMWh : 0,
    });
  }

  // 3. Dispatchable Thermal Ramp-Up & Ramp-Down Constraints (2 * 23 per thermal unit)
  gens.forEach((g, gi) => {
    if (!g.dispatchable || !g.available) return;
    // Skip if rampRate >= maxMW (non-binding by construction, keeps tableau lean)
    if (g.rampRateMWPerHour >= g.maxMW) return;
    for (let t = 1; t < 24; t++) {
      rows.push({
        name: `ramp_up_${g.id}_t${t}`,
        terms: [
          { col: colIdx(t, gi), coeff: 1 },
          { col: colIdx(t - 1, gi), coeff: -1 },
        ],
        op: '<=',
        rhs: g.rampRateMWPerHour,
      });
      rows.push({
        name: `ramp_dn_${g.id}_t${t}`,
        terms: [
          { col: colIdx(t - 1, gi), coeff: 1 },
          { col: colIdx(t, gi), coeff: -1 },
        ],
        op: '<=',
        rhs: g.rampRateMWPerHour,
      });
    }
  });

  // 4. Optional Daily Carbon Emissions Cap (tCO2e)
  if (config.enableCarbonCap) {
    const carbonTerms: { col: number; coeff: number }[] = [];
    for (let t = 0; t < 24; t++) {
      gens.forEach((g, gi) => {
        const efTonnes = getEmissionFactor(g.technology, config.emissionFactorsKgPerMWh) / 1000;
        if (efTonnes > 0) {
          carbonTerms.push({ col: colIdx(t, gi), coeff: efTonnes });
        }
      });
    }
    if (carbonTerms.length > 0) {
      rows.push({
        name: 'daily_carbon_cap_tCO2e',
        terms: carbonTerms,
        op: '<=',
        rhs: config.carbonCapTonnesCO2e,
      });
    }
  }

  // Solve LP relaxation, then enforce binary complementarity via Branch-and-Bound
  // on any hour exhibiting simultaneous charging & discharging (pCh > 1e-3 && pDis > 1e-3)
  let totalIters = 0;
  let bnbNodes = 0;

  const solveWithBounds = (ubOverride: number[]) => {
    bnbNodes++;
    const res = solveBoundedLP({
      sense: 'min',
      numVars,
      varNames,
      objective,
      lowerBounds,
      upperBounds: ubOverride,
      rows,
    });
    totalIters += res.iterations;
    return res;
  };

  let bestRes = solveWithBounds([...upperBounds]);

  // Lightweight Branch-and-Bound complementarity tightening (max depth 6)
  if (bestRes.feasible && bestRes.status === 'optimal') {
    const findSimultaneousHour = (primal: number[]) => {
      for (let t = 0; t < 24; t++) {
        if (primal[colIdx(t, chOffset)] > 1e-2 && primal[colIdx(t, disOffset)] > 1e-2) {
          return t;
        }
      }
      return -1;
    };

    const simHour = findSimultaneousHour(bestRes.primal);
    if (simHour !== -1) {
      let bestFeasible = bestRes;
      let bestObj = Infinity;
      const queue: { ub: number[]; depth: number }[] = [{ ub: [...upperBounds], depth: 0 }];

      while (queue.length > 0 && bnbNodes < 18) {
        const node = queue.shift()!;
        const res = solveWithBounds(node.ub);
        if (!res.feasible || res.status !== 'optimal') continue;
        if (res.objectiveValue >= bestObj - 1e-3) continue;

        const violT = findSimultaneousHour(res.primal);
        if (violT === -1) {
          bestObj = res.objectiveValue;
          bestFeasible = res;
        } else if (node.depth < 6) {
          const ubNoCh = [...node.ub];
          ubNoCh[colIdx(violT, chOffset)] = 0;
          const ubNoDis = [...node.ub];
          ubNoDis[colIdx(violT, disOffset)] = 0;
          queue.push({ ub: ubNoCh, depth: node.depth + 1 });
          queue.push({ ub: ubNoDis, depth: node.depth + 1 });
        }
      }
      if (Number.isFinite(bestObj)) {
        bestRes = bestFeasible;
      }
    }
  }

  // Extract 24h trajectories (if infeasible, fallback values cleanly marked infeasible)
  const hourlyGenDispatches: Map<string, number>[] = [];
  const hourlyCh: number[] = [];
  const hourlyDis: number[] = [];
  const hourlySoc: number[] = [];
  const hourlyUnserved: number[] = [];

  for (let t = 0; t < 24; t++) {
    const gMap = new Map<string, number>();
    if (bestRes.feasible) {
      gens.forEach((g, gi) => gMap.set(g.id, bestRes.primal[colIdx(t, gi)]));
      hourlyCh.push(bestRes.primal[colIdx(t, chOffset)]);
      hourlyDis.push(bestRes.primal[colIdx(t, disOffset)]);
      hourlySoc.push(bestRes.primal[colIdx(t, socOffset)]);
      hourlyUnserved.push(bestRes.primal[colIdx(t, unservedOffset)]);
    } else {
      gens.forEach((g) => gMap.set(g.id, 0));
      hourlyCh.push(0);
      hourlyDis.push(0);
      hourlySoc.push(battery.initialSocMWh);
      hourlyUnserved.push(scenario.hourlyDemand[t].totalMW);
    }
    hourlyGenDispatches.push(gMap);
  }

  const assembled = assembleDispatchSummary({
    scenario,
    config,
    hourlyGenDispatches,
    hourlyBatteryChargeMW: hourlyCh,
    hourlyBatteryDischargeMW: hourlyDis,
    hourlyBatterySocMWh: hourlySoc,
    hourlyUnservedMW: hourlyUnserved,
    solverName:
      config.carbonPriceInrPerTonne > 0 || config.enableCarbonCap
        ? 'Multi-Objective LP Optimal Dispatch (Simplex)'
        : 'Least-Cost LP Optimal Dispatch (Simplex)',
    solverStatusLabel: bestRes.feasible && bestRes.status === 'optimal' ? 'Optimal LP Active' : 'Constraint Infeasible',
  });

  return {
    lpResult: bestRes,
    numVars,
    numRows: rows.length,
    totalIters,
    bnbNodes,
    ...assembled,
  };
}

/**
 * Executes all three strategies on identical constraints & demand,
 * returning the active strategy's full dispatch bundle and side-by-side comparison.
 */
export function runOptimalEnergyDispatch(
  scenario: SimulationScenario,
  config: DispatchOptimizationConfig,
): OptimalDispatchBundle {
  const thermalFirst = runConstrainedHeuristicStrategy(scenario, config, 'thermal-first');
  const renewableHeur = runConstrainedHeuristicStrategy(scenario, config, 'renewable-heuristic');
  const lpOpt = runMultiPeriodLPSolver(scenario, config);

  const baseCostTF = Math.max(1, thermalFirst.summary.totalDailyCostInr);
  const baseCostHeur = Math.max(1, renewableHeur.summary.totalDailyCostInr);

  const buildComp = (
    strategy: DispatchStrategyId,
    label: string,
    pack: ReturnType<typeof assembleDispatchSummary>,
    solverStatus: string,
  ): StrategyComparisonMetrics => {
    const cost = pack.summary.totalDailyCostInr;
    const unservedMWh = pack.summary.hourlyDispatches.reduce(
      (a, h) => a + h.unservedEnergyMW,
      0,
    );
    const curtailedMWh = pack.summary.hourlyDispatches.reduce(
      (a, h) => a + h.curtailmentMW,
      0,
    );
    return {
      strategy,
      label,
      totalCostInr: cost,
      costSavingsVsThermalFirstPercent: Number((((baseCostTF - cost) / baseCostTF) * 100).toFixed(2)),
      costSavingsVsHeuristicPercent: Number((((baseCostHeur - cost) / baseCostHeur) * 100).toFixed(2)),
      renewableContributionPercent: pack.summary.averageRenewableSharePercent,
      totalEmissionsTonnesCO2e: pack.summary.totalDailyEmissionsTonnesCO2e,
      unservedEnergyMWh: Number(unservedMWh.toFixed(2)),
      curtailedRenewableMWh: Number(curtailedMWh.toFixed(2)),
      maxBalanceResidualMW: pack.residualSummary.maxPowerBalanceResidualMW,
      solverStatus,
    };
  };

  const comparisons: StrategyComparisonMetrics[] = [
    buildComp('thermal-first', '1. Thermal-First Baseline', thermalFirst, 'Heuristic'),
    buildComp('renewable-heuristic', '2. Renewable-Priority Heuristic', renewableHeur, 'Heuristic'),
    buildComp(
      'lp-optimal',
      '3. Numerical Cost Optimization (LP)',
      lpOpt,
      lpOpt.lpResult.status === 'optimal' ? 'Optimal' : lpOpt.lpResult.status,
    ),
  ];

  const activePack =
    config.strategy === 'thermal-first'
      ? thermalFirst
      : config.strategy === 'renewable-heuristic'
        ? renewableHeur
        : lpOpt;

  const lpRelaxationNote =
    activePack.residualSummary.simultaneousChargeDischargeHours === 0
      ? 'BESS complementarity verified: 0 hours with simultaneous charging & discharging (enforced via positive cycling cost + Branch-and-Bound binary exclusion).'
      : `LP relaxation flagged ${activePack.residualSummary.simultaneousChargeDischargeHours} hour(s) with overlapping charge/discharge.`;

  return {
    config,
    solverStatus:
      config.strategy === 'lp-optimal' ? (lpOpt.lpResult.status === 'unbounded' ? 'iteration_limit' : lpOpt.lpResult.status) : 'heuristic',
    feasible:
      config.strategy === 'lp-optimal'
        ? lpOpt.lpResult.feasible && activePack.residualSummary.allConstraintsSatisfied
        : activePack.residualSummary.allConstraintsSatisfied,
    objectiveValueInr:
      config.strategy === 'lp-optimal'
        ? lpOpt.lpResult.objectiveValue
        : activePack.summary.totalDailyCostInr,
    operationalCostInr: activePack.operationalCostInr,
    carbonPenaltyCostInr: activePack.carbonPenaltyCostInr,
    vollPenaltyCostInr: activePack.vollPenaltyCostInr,
    numVariables: lpOpt.numVars,
    numConstraints: lpOpt.numRows,
    simplexIterations: lpOpt.totalIters,
    branchAndBoundNodes: lpOpt.bnbNodes,
    lpRelaxationNote,
    residualSummary: activePack.residualSummary,
    summary: activePack.summary,
    comparisons,
    comparisonSummaries: {
      'thermal-first': thermalFirst.summary,
      'renewable-heuristic': renewableHeur.summary,
      'lp-optimal': lpOpt.summary,
    },
  };
}

/**
 * Builds an exact 2-variable single-hour dispatch LP slice (CCGT Gas x1 vs Coal Peaker x2)
 * so the 3D Mathematical Workspace can show the literal 2D feasible region, constraint boundaries,
 * and cost objective plane without misrepresenting the 216-variable 24-hour LP.
 */
export function buildHourTwoVarDispatchSlice(
  scenario: SimulationScenario,
  config: DispatchOptimizationConfig,
  hour: number,
  activeDispatch: DispatchResult,
): HourTwoVarSlice {
  const safeHour = Math.max(0, Math.min(23, Math.round(hour)));
  const gas = scenario.generators.find((g) => g.technology === 'gas');
  const coal = scenario.generators.find((g) => g.technology === 'coal');

  const solarWindHydroMW = activeDispatch.generatorSetpoints
    .filter((s) => s.technology === 'solar' || s.technology === 'wind' || s.technology === 'hydro')
    .reduce((acc, s) => acc + s.dispatchedMW, 0);

  const netResidualDemandMW = Number(
    Math.max(
      10,
      activeDispatch.totalDemandMW - solarWindHydroMW - activeDispatch.batteryNetPowerMW,
    ).toFixed(2),
  );

  const cGas =
    (gas?.marginalCostInrPerMWh ?? 4650) +
    (config.emissionFactorsKgPerMWh.gas / 1000) * config.carbonPriceInrPerTonne;
  const cCoal =
    (coal?.marginalCostInrPerMWh ?? 5850) +
    (config.emissionFactorsKgPerMWh.coal / 1000) * config.carbonPriceInrPerTonne;

  const gasMax = gas?.maxMW ?? 150;
  const coalMax = coal?.maxMW ?? 140;
  const gasMin = config.enforceUnitMinStable ? (gas?.minMW ?? 25) : 0;
  const coalMin = config.enforceUnitMinStable ? (coal?.minMW ?? 30) : 0;

  const efGas = config.emissionFactorsKgPerMWh.gas / 1000;
  const efCoal = config.emissionFactorsKgPerMWh.coal / 1000;
  const hourlyCo2Cap = config.enableCarbonCap
    ? config.carbonCapTonnesCO2e / 24
    : efGas * gasMax + efCoal * coalMax;

  const spec: LinearProgramSpec = {
    sense: 'min',
    variableNames: ['x₁ (CCGT Gas MW)', 'x₂ (Coal Peaker MW)'],
    objectiveCoeffs: [cGas, cCoal],
    constraints: [
      {
        id: 'net-balance',
        label: `Thermal Balance x₁ + x₂ ≥ ${netResidualDemandMW.toFixed(1)} MW`,
        coeffs: [1, 1],
        op: '>=',
        rhs: netResidualDemandMW,
      },
      {
        id: 'gas-max',
        label: `CCGT Max Capacity x₁ ≤ ${gasMax} MW`,
        coeffs: [1, 0],
        op: '<=',
        rhs: gasMax,
      },
      {
        id: 'coal-max',
        label: `Coal Max Capacity x₂ ≤ ${coalMax} MW`,
        coeffs: [0, 1],
        op: '<=',
        rhs: coalMax,
      },
      {
        id: 'gas-min',
        label: `CCGT Min Stable x₁ ≥ ${gasMin} MW`,
        coeffs: [1, 0],
        op: '>=',
        rhs: gasMin,
      },
      {
        id: 'coal-min',
        label: `Coal Min Stable x₂ ≥ ${coalMin} MW`,
        coeffs: [0, 1],
        op: '>=',
        rhs: coalMin,
      },
      {
        id: 'hourly-co2',
        label: `Hourly CO₂ Bound ${efGas.toFixed(2)}x₁ + ${efCoal.toFixed(2)}x₂ ≤ ${hourlyCo2Cap.toFixed(1)} t`,
        coeffs: [efGas, efCoal],
        op: '<=',
        rhs: Number(hourlyCo2Cap.toFixed(2)),
      },
    ],
  };

  return {
    hour: safeHour,
    timestampLabel: activeDispatch.timestampLabel,
    spec,
    lpResult: solveLinearProgram(spec),
    netResidualDemandMW,
  };
}

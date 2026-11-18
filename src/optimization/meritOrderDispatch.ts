import type {
  Battery,
  DaySimulationSummary,
  DispatchResult,
  Generator,
  GeneratorSetpoint,
  GridBalanceStatus,
  HourlyDemand,
  SimulationScenario,
} from '../types/grid';

function getHourlyAvailableMaxMW(generator: Generator, hourData: HourlyDemand): number {
  if (!generator.available) return 0;

  if (generator.technology === 'solar') {
    const irradianceRatio = Math.min(1, Math.max(0, hourData.solarIrradianceWm2 / 1000));
    return Number((generator.maxMW * irradianceRatio).toFixed(2));
  }

  if (generator.technology === 'wind') {
    return Number((generator.maxMW * hourData.windCapacityFactor).toFixed(2));
  }

  return generator.maxMW;
}

/**
 * Phase 1 Deterministic Merit-Order Economic Dispatch Baseline.
 *
 * Computes hourly generator commitment by ascending marginal cost (INR/MWh),
 * tracks battery State-of-Charge (MWh) using peak-shaving / surplus-charging rules,
 * and enforces explicit unit accounting across MW, MWh, INR, and kgCO2e.
 */
export function runMeritOrderBaselineDispatch(scenario: SimulationScenario): DaySimulationSummary {
  const hourlyDispatches: DispatchResult[] = [];
  const battery: Battery = { ...scenario.battery };
  let socMWh = battery.initialSocMWh;

  const minSocMWh = battery.capacityMWh * battery.minSocRatio;
  const maxSocMWh = battery.capacityMWh * battery.maxSocRatio;
  const sqrtEta = Math.sqrt(battery.roundTripEfficiency);

  for (const hourData of scenario.hourlyDemand) {
    const demandMW = hourData.totalMW;

    // 1. Compute available capacity per generator for this hour
    const availabilityMap = new Map<string, number>();
    let totalAvailableGenerationMW = 0;

    for (const gen of scenario.generators) {
      const avail = getHourlyAvailableMaxMW(gen, hourData);
      availabilityMap.set(gen.id, avail);
      totalAvailableGenerationMW += avail;
    }

    // 2. Non-dispatchable renewables (must-take before curtailment)
    const renewables = scenario.generators.filter((g) => !g.dispatchable);
    let renewableTakenMW = 0;
    const setpointsMap = new Map<string, number>();

    for (const ren of renewables) {
      const avail = availabilityMap.get(ren.id) ?? 0;
      renewableTakenMW += avail;
      setpointsMap.set(ren.id, avail);
    }

    // 3. Simple deterministic BESS heuristic: charge during solar surplus or off-peak (< 4200 INR/MWh),
    // discharge during evening peak (>= 6500 INR/MWh or net load > 320 MW).
    let batteryNetPowerMW = 0;
    const netLoadAfterRenewables = demandMW - renewableTakenMW;

    if (netLoadAfterRenewables < 0) {
      // Absorb excess renewable energy
      const excessMW = -netLoadAfterRenewables;
      const roomMWh = Math.max(0, maxSocMWh - socMWh);
      const maxChargePossibleMW = Math.min(battery.maxChargeMW, roomMWh / sqrtEta);
      const chargeMW = Math.min(excessMW, maxChargePossibleMW);
      batteryNetPowerMW = -chargeMW;
      socMWh += chargeMW * sqrtEta;
    } else if (
      (hourData.tariffInrPerMWh >= 6500 || netLoadAfterRenewables > 315) &&
      socMWh > minSocMWh + 1e-6
    ) {
      // Peak shaving discharge
      const availableEnergyMWh = Math.max(0, socMWh - minSocMWh);
      const maxDischargePossibleMW = Math.min(
        battery.maxDischargeMW,
        availableEnergyMWh * sqrtEta,
      );
      const dischargeMW = Math.min(netLoadAfterRenewables, maxDischargePossibleMW);
      batteryNetPowerMW = dischargeMW;
      socMWh -= dischargeMW / sqrtEta;
    } else if (hourData.tariffInrPerMWh <= 4100 && socMWh < maxSocMWh - 1e-6) {
      // Off-peak valley charging
      const roomMWh = Math.max(0, maxSocMWh - socMWh);
      const chargeMW = Math.min(battery.maxChargeMW * 0.65, roomMWh / sqrtEta);
      batteryNetPowerMW = -chargeMW;
      socMWh += chargeMW * sqrtEta;
    }

    socMWh = Number(Math.min(maxSocMWh, Math.max(minSocMWh, socMWh)).toFixed(2));
    batteryNetPowerMW = Number(batteryNetPowerMW.toFixed(2));

    // 4. Residual load served by dispatchable units in ascending marginal cost order
    let residualDemandMW = Math.max(0, demandMW - renewableTakenMW - batteryNetPowerMW);
    let curtailmentMW = 0;

    if (renewableTakenMW - batteryNetPowerMW > demandMW) {
      // Curtail excess non-dispatchable renewables if battery could not absorb all surplus
      curtailmentMW = Number((renewableTakenMW - batteryNetPowerMW - demandMW).toFixed(2));
    }

    const dispatchableUnits = [...scenario.generators]
      .filter((g) => g.dispatchable && g.available)
      .sort((a, b) => a.marginalCostInrPerMWh - b.marginalCostInrPerMWh);

    for (const unit of dispatchableUnits) {
      const availMax = availabilityMap.get(unit.id) ?? 0;
      if (residualDemandMW <= 0) {
        setpointsMap.set(unit.id, 0);
        continue;
      }
      const dispatchMW = Math.min(availMax, Math.max(0, residualDemandMW));
      setpointsMap.set(unit.id, Number(dispatchMW.toFixed(2)));
      residualDemandMW = Math.max(0, residualDemandMW - dispatchMW);
    }

    const unservedEnergyMW = Number(residualDemandMW.toFixed(2));

    // 5. Assemble setpoints, costs (INR), and emissions (kgCO2e / tCO2e)
    let totalDispatchedGenerationMW = 0;
    let renewableGenerationMW = 0;
    let dispatchCostInr = Math.abs(batteryNetPowerMW) * battery.degradationCostInrPerMWh;
    let emissionsKgCO2e = 0;

    const generatorSetpoints: GeneratorSetpoint[] = scenario.generators.map((gen) => {
      const availMax = availabilityMap.get(gen.id) ?? 0;
      let dispatched = setpointsMap.get(gen.id) ?? 0;

      // Apply curtailment proportionally to solar/wind if surplus remained
      if (curtailmentMW > 0 && !gen.dispatchable && renewableTakenMW > 0) {
        const share = availMax / renewableTakenMW;
        dispatched = Math.max(0, dispatched - curtailmentMW * share);
      }

      dispatched = Number(dispatched.toFixed(2));
      const hourlyCostInr = Number((dispatched * gen.marginalCostInrPerMWh).toFixed(0));
      const hourlyEmissionsKgCO2e = Number((dispatched * gen.carbonIntensityKgPerMWh).toFixed(1));

      totalDispatchedGenerationMW += dispatched;
      if (gen.technology === 'solar' || gen.technology === 'wind' || gen.technology === 'hydro') {
        renewableGenerationMW += dispatched;
      }
      dispatchCostInr += hourlyCostInr;
      emissionsKgCO2e += hourlyEmissionsKgCO2e;

      return {
        generatorId: gen.id,
        name: gen.name,
        technology: gen.technology,
        availableMaxMW: availMax,
        dispatchedMW: dispatched,
        utilizationPercent: availMax > 0 ? Number(((dispatched / availMax) * 100).toFixed(1)) : 0,
        hourlyCostInr,
        hourlyEmissionsKgCO2e,
      };
    });

    totalDispatchedGenerationMW = Number(totalDispatchedGenerationMW.toFixed(2));
    renewableGenerationMW = Number(renewableGenerationMW.toFixed(2));
    const supplyTotalMW = totalDispatchedGenerationMW + batteryNetPowerMW;
    const reserveMarginMW = Number((totalAvailableGenerationMW - demandMW).toFixed(2));

    let balanceStatus: GridBalanceStatus = 'Balanced';
    if (unservedEnergyMW > 0.5 || reserveMarginMW < 25) {
      balanceStatus = unservedEnergyMW > 0.5 ? 'Deficit' : 'Balanced';
    } else if (curtailmentMW > 1 || reserveMarginMW > 180) {
      balanceStatus = 'Surplus';
    }

    const renewableContributionPercent =
      supplyTotalMW > 0
        ? Number(Math.min(100, (renewableGenerationMW / supplyTotalMW) * 100).toFixed(1))
        : 0;

    hourlyDispatches.push({
      hour: hourData.hour,
      timestampLabel: hourData.timestampLabel,
      totalDemandMW: demandMW,
      totalAvailableGenerationMW: Number(totalAvailableGenerationMW.toFixed(2)),
      totalDispatchedGenerationMW,
      renewableGenerationMW,
      renewableContributionPercent,
      batteryNetPowerMW,
      batterySocMWh: socMWh,
      batterySocPercent: Number(((socMWh / battery.capacityMWh) * 100).toFixed(1)),
      unservedEnergyMW,
      curtailmentMW,
      dispatchCostInr: Math.round(dispatchCostInr),
      averageCostInrPerMWh:
        demandMW > 0 ? Math.round(dispatchCostInr / demandMW) : 0,
      emissionsKgCO2e: Number(emissionsKgCO2e.toFixed(1)),
      emissionsTonnesCO2e: Number((emissionsKgCO2e / 1000).toFixed(2)),
      balanceStatus,
      reserveMarginMW,
      generatorSetpoints,
      solverName: 'Merit-Order Economic Dispatch Baseline',
      solverStatus: 'Phase 1 Merit-Order Baseline',
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

  return {
    scenarioId: scenario.id,
    predictedPeakDemandMW: Number(peakDemandMW.toFixed(2)),
    peakDemandHour,
    totalDailyEnergyMWh: Number(totalDailyEnergyMWh.toFixed(1)),
    totalDailyCostInr: Math.round(totalDailyCostInr),
    totalDailyEmissionsTonnesCO2e: Number((totalDailyEmissionsKg / 1000).toFixed(2)),
    averageRenewableSharePercent: Number((renewableSumPercent / hourlyDispatches.length).toFixed(1)),
    hourlyDispatches,
  };
}

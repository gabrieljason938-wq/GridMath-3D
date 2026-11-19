import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSimulationStore } from '../store/useSimulationStore';
import {
  UI_THEME_STORAGE_KEY,
  resolveUiTheme,
  useThemeStore,
} from '../store/useThemeStore';

describe('GRIDMATH 3D — Isolated Light/Dark Theme, Logout Reset & Static Landing Verification', () => {
  beforeEach(() => {
    useThemeStore.getState().setUiTheme('light');
    useSimulationStore.getState().resetSimulation();
  });

  it('switches cleanly between Light, Dark, and System Default UI themes', () => {
    const store = useThemeStore.getState();

    store.setUiTheme('dark');
    expect(useThemeStore.getState().uiTheme).toBe('dark');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(resolveUiTheme('dark')).toBe('dark');

    store.setUiTheme('light');
    expect(useThemeStore.getState().uiTheme).toBe('light');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
    expect(resolveUiTheme('light')).toBe('light');

    store.setUiTheme('system');
    expect(useThemeStore.getState().uiTheme).toBe('system');
    expect(['light', 'dark']).toContain(useThemeStore.getState().resolvedTheme);
    expect(UI_THEME_STORAGE_KEY).toBe('gridmath-ui-theme');
  });

  it('keeps UI theme completely isolated from 3D Smart City environmentMode across all 4 combinations', () => {
    // 1. Light UI + Day City
    useThemeStore.getState().setUiTheme('light');
    useSimulationStore.getState().setEnvironmentMode('day');
    expect(useThemeStore.getState().uiTheme).toBe('light');
    expect(useSimulationStore.getState().environmentMode).toBe('day');

    // 2. Dark UI + Day City (switching UI theme must NOT alter 3D city environment)
    useThemeStore.getState().setUiTheme('dark');
    expect(useThemeStore.getState().uiTheme).toBe('dark');
    expect(useSimulationStore.getState().environmentMode).toBe('day');

    // 3. Light UI + Night City (switching 3D environment must NOT alter UI theme)
    useThemeStore.getState().setUiTheme('light');
    useSimulationStore.getState().setEnvironmentMode('night');
    expect(useThemeStore.getState().uiTheme).toBe('light');
    expect(useSimulationStore.getState().environmentMode).toBe('night');

    // 4. Dark UI + Rainy City
    useThemeStore.getState().setUiTheme('dark');
    useSimulationStore.getState().setEnvironmentMode('rainy');
    expect(useThemeStore.getState().uiTheme).toBe('dark');
    expect(useSimulationStore.getState().environmentMode).toBe('rainy');

    // Switching back to Light UI leaves Rainy 3D city untouched
    useThemeStore.getState().setUiTheme('light');
    expect(useSimulationStore.getState().environmentMode).toBe('rainy');
  });

  it('resets active scenario overrides on exitSessionToLanding while preserving pinnedExperiments', () => {
    const sim = useSimulationStore.getState();

    // Pin experiments and apply scenario overrides
    const pinned = sim.runAndPinAllExperiments();
    expect(Object.keys(pinned).length).toBeGreaterThanOrEqual(8);

    sim.playSimulation();
    sim.setSelectedNode('solar');
    sim.setEnvironmentMode('rainy');
    sim.updateWeatherControls({ temperatureDeltaDegC: 5, solarIrradianceScale: 0.6 });
    sim.setUseForecastDrivenDemand(true);

    // Execute logout reset
    useSimulationStore.getState().exitSessionToLanding();

    const after = useSimulationStore.getState();
    expect(after.isPlaying).toBe(false);
    expect(after.activeHour).toBe(14);
    expect(after.selectedNodeId).toBeNull();
    expect(after.environmentMode).toBe('day');
    expect(after.weatherControls.temperatureDeltaDegC).toBe(0);
    expect(after.weatherControls.solarIrradianceScale).toBe(1);
    expect(after.useForecastDrivenDemand).toBe(false);
    expect(after.appliedForecastLabel).toBeNull();

    // Pinned scientific experiments must remain preserved
    expect(Object.keys(after.pinnedExperiments).length).toBe(Object.keys(pinned).length);
  });

  it('contains zero Three.js / WebGL / 3D viewport imports on the pre-login landing page and renders the uploaded static city image', () => {
    const landingPagePath = path.resolve(process.cwd(), 'src/pages/LandingPage.tsx');
    const landingDir = path.resolve(process.cwd(), 'src/components/landing');
    const landingFiles = [
      landingPagePath,
      ...fs
        .readdirSync(landingDir)
        .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
        .map((f) => path.join(landingDir, f)),
    ];

    const forbiddenPatterns = [
      /@react-three\/fiber/,
      /@react-three\/drei/,
      /from\s+['"]three['"]/,
      /SmartCityViewport/,
      /SmartCityScene/,
      /MathLabViewport/,
    ];

    for (const file of landingFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content), `Unexpected 3D reference ${pattern} in ${file}`).toBe(false);
      }
    }

    const heroContent = fs.readFileSync(path.join(landingDir, 'HeroCityShowcase.tsx'), 'utf8');
    expect(heroContent).toContain('/assets/aistudio/image_25e9d109.png');
  });

  it('renders the complete premium landing sections without academic labels or duplicated dashboard/math widgets', () => {
    const landingPagePath = path.resolve(process.cwd(), 'src/pages/LandingPage.tsx');
    const landingDir = path.resolve(process.cwd(), 'src/components/landing');
    const landingFiles = [
      landingPagePath,
      ...fs
        .readdirSync(landingDir)
        .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
        .map((f) => path.join(landingDir, f)),
    ];

    const forbiddenLandingPatterns = [
      /capstone/i,
      /final[- ]year/i,
      /student project/i,
      /academic/i,
      /useSimulationStore/,
      /KaTeXFormula/,
      /optimalDispatchEngine/,
      /from\s+['"].*\/math\//,
    ];

    for (const file of landingFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of forbiddenLandingPatterns) {
        expect(pattern.test(content), `Unexpected forbidden pattern ${pattern} in ${file}`).toBe(
          false,
        );
      }
    }

    const landingSource = fs.readFileSync(landingPagePath, 'utf8');
    const visionSource = fs.readFileSync(path.join(landingDir, 'VisionSection.tsx'), 'utf8');
    const techSource = fs.readFileSync(path.join(landingDir, 'CoreTechnologySection.tsx'), 'utf8');
    const ecosystemSource = fs.readFileSync(
      path.join(landingDir, 'EnergyEcosystemSection.tsx'),
      'utf8',
    );
    const processSource = fs.readFileSync(path.join(landingDir, 'HowItWorksProcess.tsx'), 'utf8');
    const cityExpSource = fs.readFileSync(
      path.join(landingDir, 'SmartCityExperienceSection.tsx'),
      'utf8',
    );
    const faqSource = fs.readFileSync(path.join(landingDir, 'LandingFaqSection.tsx'), 'utf8');
    const ctaSource = fs.readFileSync(path.join(landingDir, 'FinalCtaSection.tsx'), 'utf8');
    const footerSource = fs.readFileSync(path.join(landingDir, 'LandingFooter.tsx'), 'utf8');

    // Hero
    expect(landingSource).toContain('Powering Smarter Cities Through Numerical Intelligence');
    expect(landingSource).toContain('Launch Application');
    expect(landingSource).toContain('Explore Technology');
    expect(landingSource).toContain('to="/dashboard"');

    // Vision
    expect(visionSource).toContain('Engineering a Smarter Energy Future');

    // Core Technology
    expect(techSource).toContain('The Intelligence Behind the Grid');
    expect(techSource).toContain('Numerical Intelligence');
    expect(techSource).toContain('Optimal Energy Dispatch');
    expect(techSource).toContain('Interactive 3D Smart City');
    expect(techSource).toContain("to: '/mathematics'");
    expect(techSource).toContain("to: '/dispatch'");
    expect(techSource).toContain("to: '/smart-city'");

    // Sustainable Energy Ecosystem
    expect(ecosystemSource).toContain('One City. Multiple Energy Sources.');
    expect(ecosystemSource).toContain('Solar Energy');
    expect(ecosystemSource).toContain('Wind Energy');
    expect(ecosystemSource).toContain('Thermal Generation');
    expect(ecosystemSource).toContain('Battery Energy Storage');

    // How GRIDMATH Works (4 steps)
    expect(processSource).toContain('From Mathematical Intelligence to Smart Energy Decisions');
    expect(processSource).toContain('Data Input');
    expect(processSource).toContain('Numerical Forecasting');
    expect(processSource).toContain('Optimal Dispatch');
    expect(processSource).toContain('Digital Twin Visualization');

    // Smart City Experience
    expect(cityExpSource).toContain('Experience Energy Intelligence in a Living City');
    expect(cityExpSource).toContain('/assets/aistudio/image_25e9d109.png');
    expect(cityExpSource).toContain('Explore the 3D City');
    expect(cityExpSource).toContain('to="/smart-city"');

    // FAQ
    expect(faqSource).toContain('What is GRIDMATH 3D?');
    expect(faqSource).toContain('How are numerical methods used?');
    expect(faqSource).toContain('What does the 3D smart city simulate?');
    expect(faqSource).toContain('How does optimal energy dispatch work?');
    expect(faqSource).toContain('Does the system use real or demonstration data?');

    // Final CTA & Footer
    expect(ctaSource).toContain('Explore the Future of Smart Grid Intelligence');
    expect(ctaSource).toContain('Launch GRIDMATH 3D');
    expect(ctaSource).toContain('to="/dashboard"');
    expect(footerSource).toContain('GRIDMATH 3D');
    expect(footerSource).toContain('getFullYear()');
  });
});




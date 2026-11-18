import { useEffect, useState } from 'react';
import * as THREE from 'three';

let cachedSoftwareGl: boolean | null = null;
let cachedWebGLSupported: boolean | null = null;

export function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => getPrefersReducedMotion());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Checks whether the browser provides a usable WebGL1/WebGL2 rendering context.
 */
export function isWebGLSupported(): boolean {
  if (cachedWebGLSupported !== null) return cachedWebGLSupported;
  if (typeof document === 'undefined') {
    cachedWebGLSupported = false;
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const supported = Boolean(gl);
    if (gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    cachedWebGLSupported = supported;
    return supported;
  } catch {
    cachedWebGLSupported = false;
    return false;
  }
}

/**
 * Probes the WebGL2 renderer string once to detect software rasterizers
 * (SwiftShader, llvmpipe, WARP). Used strictly for rendering cost adaptation
 * (pixel ratio, shadow map size, antialias) without altering scene geometry or layout.
 */
export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  if (typeof document === 'undefined') {
    cachedSoftwareGl = false;
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = true;
    return true;
  }
}

/**
 * Generates a crisp procedural architectural baseplate grid texture in sRGB space
 * with zero external asset dependencies.
 */
export function createArchitecturalGridTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#F5F8FC';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#E6EDF5';
    ctx.lineWidth = 1;
    const minorStep = size / 16;
    for (let i = 0; i <= 16; i++) {
      const p = i * minorStep;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

    ctx.strokeStyle = '#D1DCE9';
    ctx.lineWidth = 1.6;
    const majorStep = size / 4;
    for (let i = 0; i <= 4; i++) {
      const p = i * majorStep;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

    ctx.strokeStyle = '#BDCADA';
    ctx.lineWidth = 1.5;
    for (let gx = 0; gx <= 4; gx++) {
      for (let gy = 0; gy <= 4; gy++) {
        const cx = gx * majorStep;
        const cy = gy * majorStep;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy);
        ctx.lineTo(cx + 5, cy);
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx, cy + 5);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(22, 22);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural curtain-wall skyscraper facade texture (sRGB) with floor spandrels,
 * vertical anodized mullions, and subtle interior luminance variation.
 */
export function createCurtainWallTexture(
  baseHex = '#60A5FA',
  spandrelHex = '#1E3A5F',
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);

    const cols = 8;
    const rows = 12;
    const cw = size / cols;
    const rh = size / rows;

    for (let r = 0; r < rows; r++) {
      // Spandrel floor slab band
      ctx.fillStyle = spandrelHex;
      ctx.fillRect(0, r * rh, size, rh * 0.24);

      for (let c = 0; c < cols; c++) {
        const hash = ((r * 17 + c * 31) % 7) / 7;
        ctx.fillStyle =
          hash > 0.65
            ? '#E0F2FE'
            : hash > 0.35
              ? '#93C5FD'
              : baseHex;
        ctx.fillRect(c * cw + 2, r * rh + rh * 0.26, cw - 4, rh * 0.68);
      }
    }

    // Crisp aluminum vertical mullions
    ctx.fillStyle = '#334155';
    for (let c = 0; c <= cols; c++) {
      ctx.fillRect(c * cw - 1, 0, 2, size);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural residential apartment block facade texture (sRGB) with stucco piers & window bays.
 */
export function createApartmentFacadeTexture(
  wallHex = '#FAF5EE',
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = wallHex;
    ctx.fillRect(0, 0, size, size);

    const cols = 6;
    const rows = 8;
    const cw = size / cols;
    const rh = size / rows;

    for (let r = 0; r < rows; r++) {
      // Subtle floor cornice line
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(0, r * rh, size, 3);

      for (let c = 0; c < cols; c++) {
        const lit = (r * 13 + c * 7) % 5 !== 0;
        ctx.fillStyle = lit ? '#7DD3FC' : '#334155';
        ctx.fillRect(c * cw + 6, r * rh + 7, cw - 12, rh - 14);

        // Window mullion bar
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(c * cw + cw / 2 - 1, r * rh + 7, 2, rh - 14);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural corrugated steel industrial siding texture (sRGB).
 */
export function createIndustrialCladdingTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#DCE4EE';
    ctx.fillRect(0, 0, size, size);

    for (let x = 0; x < size; x += 8) {
      ctx.fillStyle = x % 16 === 0 ? '#CBD5E1' : '#EEF2F6';
      ctx.fillRect(x, 0, 4, size);
    }

    // Horizontal structural seam & clerestory glazing band
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 32, size, 24);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(0, 36, size, 16);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(0, 148, size, 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural monocrystalline solar PV cell grid texture (sRGB) with silver busbars.
 */
export function createSolarPanelTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#0F4C81';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#0B3B66';
    const cols = 6;
    const rows = 4;
    const cw = size / cols;
    const rh = size / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillRect(c * cw + 3, r * rh + 3, cw - 6, rh - 6);
      }
    }

    ctx.strokeStyle = '#7DD3FC';
    ctx.lineWidth = 1.4;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cw, 0);
      ctx.lineTo(c * cw, size);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * rh);
      ctx.lineTo(size, r * rh);
      ctx.stroke();
    }

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, size - 6, size - 6);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural hospital rooftop helipad marking texture (sRGB).
 */
export function createHelipadTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 92, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(80, 68, 22, 120);
    ctx.fillRect(154, 68, 22, 120);
    ctx.fillRect(80, 117, 96, 22);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural lush eco-parkland meadow terrain texture (sRGB) with organic grass tufts
 * and subtle architectural contour bands.
 */
export function createMeadowTerrainTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#5F9E59';
    ctx.fillRect(0, 0, size, size);

    // Subtle organic lawn bands & meadow variation
    for (let y = 0; y < size; y += 32) {
      ctx.fillStyle = (y / 32) % 2 === 0 ? 'rgba(134, 239, 172, 0.14)' : 'rgba(21, 128, 61, 0.12)';
      ctx.fillRect(0, y, size, 16);
    }

    // Deterministic botanical texture speckles
    for (let i = 0; i < 420; i++) {
      const s1 = Math.sin(i * 12.9898) * 43758.5453;
      const s2 = Math.sin(i * 78.233) * 24634.6345;
      const x = (s1 - Math.floor(s1)) * size;
      const y = (s2 - Math.floor(s2)) * size;
      const r = 2 + ((i * 7) % 5);
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(167, 243, 208, 0.16)'
          : i % 3 === 1
            ? 'rgba(34, 197, 94, 0.16)'
            : 'rgba(22, 101, 52, 0.14)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a tileable tangent-space normal map in linear space for animated
 * pond ripples and rainy pavement puddle sheen without external image assets.
 */
export function createWaterNormalTexture(maxAnisotropy = 4): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const twoPi = Math.PI * 2;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Superposition of periodic ripples (exact integer harmonics so texture tiles seamlessly)
      const dx =
        0.35 * Math.cos(twoPi * (u * 3 + v * 1)) +
        0.25 * Math.cos(twoPi * (u * 5 - v * 3)) +
        0.18 * Math.cos(twoPi * (u * 8 + v * 6));
      const dy =
        0.35 * Math.sin(twoPi * (u * 2 - v * 4)) +
        0.25 * Math.sin(twoPi * (u * 6 + v * 5)) +
        0.18 * Math.sin(twoPi * (u * 9 - v * 7));

      const nx = -dx * 0.42;
      const ny = -dy * 0.42;
      const nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);

      const idx = (y * size + x) * 4;
      data[idx] = Math.round(((nx * invLen) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((ny * invLen) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((nz * invLen) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = maxAnisotropy;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export interface SkyboxEnvironmentParams {
  skyTopHex: string;
  skyHorizonHex: string;
  sunGlowHex: string;
  groundHex: string;
  sunPosition: [number, number, number];
  sunIntensity?: number;
}

const _envTop = new THREE.Color();
const _envHorizon = new THREE.Color();
const _envSun = new THREE.Color();
const _envGround = new THREE.Color();
const _envPixel = new THREE.Color();
const _envSunDir = new THREE.Vector3();

/**
 * Generates an equirectangular procedural skybox DataTexture in sRGB space
 * matching the current sky zenith, horizon, directional sun/moon glow, and
 * ground bounce so PMREM environment reflections react dynamically to time of day.
 */
export function createSkyboxEnvironmentTexture(
  params: SkyboxEnvironmentParams,
): THREE.DataTexture {
  const width = 64;
  const height = 32;
  const data = new Uint8Array(width * height * 4);

  _envTop.set(params.skyTopHex);
  _envHorizon.set(params.skyHorizonHex);
  _envSun.set(params.sunGlowHex);
  _envGround.set(params.groundHex);
  _envSunDir.set(...params.sunPosition);
  if (_envSunDir.lengthSq() < 1e-6) {
    _envSunDir.set(0, 1, 0);
  } else {
    _envSunDir.normalize();
  }
  const sunStrength = params.sunIntensity ?? 0.75;

  for (let y = 0; y < height; y++) {
    // Three.js DataTexture has flipY=false: y=0 is nadir (-Y), y=height-1 is zenith (+Y)
    const v = (y + 0.5) / height;
    const theta = (1 - v) * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const phi = u * Math.PI * 2;
      const dx = sinTheta * Math.cos(phi);
      const dy = cosTheta;
      const dz = sinTheta * Math.sin(phi);

      if (dy >= 0) {
        const tZenith = Math.pow(Math.min(1, dy), 0.58);
        _envPixel.copy(_envHorizon).lerp(_envTop, tZenith);

        const sunDot = Math.max(0, dx * _envSunDir.x + dy * _envSunDir.y + dz * _envSunDir.z);
        const halo = Math.pow(sunDot, 7) * 0.62 * sunStrength;
        const core = Math.pow(sunDot, 36) * 0.85 * sunStrength;
        const sunMix = Math.min(0.95, halo + core);
        _envPixel.lerp(_envSun, sunMix);
      } else {
        const tNadir = Math.pow(Math.min(1, -dy), 0.45);
        _envPixel.copy(_envHorizon).lerp(_envGround, tNadir);
      }

      const idx = (y * width + x) * 4;
      data[idx] = Math.round(Math.min(1, Math.max(0, _envPixel.r)) * 255);
      data[idx + 1] = Math.round(Math.min(1, Math.max(0, _envPixel.g)) * 255);
      data[idx + 2] = Math.round(Math.min(1, Math.max(0, _envPixel.b)) * 255);
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}



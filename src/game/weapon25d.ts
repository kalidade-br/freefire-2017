import * as THREE from 'three';
import { WeaponId } from './types';

export interface WeaponImageSpec {
  file: string;
  imgW: number;
  imgH: number;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
  length: number;
  thickness: number;
  // Normalized grip pivot inside [-0.5..0.5] bbox space (placed at 0,0,0 hand origin)
  gripZNorm: number;
  gripYNorm: number;
  uiScale: number;
  hasCheckerBg?: boolean;
  barrel: {
    z0: number;
    z1: number;
    yNorm: number;
    radius: number;
    underTube?: { z0: number; z1: number; yNorm: number; radius: number };
    scope?: { z0: number; z1: number; yNorm: number; radius: number; hasLens?: boolean };
  };
  // Small geometric 3D cubes for sights, magazines, rails & details (normalized Z/Y, size in meters)
  details: Array<{
    zNorm: number;
    yNorm: number;
    sx: number;
    sy: number;
    sz: number;
    tone: 'dark' | 'metal' | 'accent';
  }>;
  // Pre-sampled 20-slice opaque contour intervals: [z0, z1, yBot, yTop] in [-0.5..0.5]
  contourBlocks: Array<[number, number, number, number]>;
}

const SITE_ARMAS_BASE = 'https://freefire-soms.netlify.app/armas/';
const CORS_ARMAS_BASE = 'https://raw.githubusercontent.com/kalidade-br/freefire-soms/main/armas/';

export const WEAPON_IMAGE_SPECS: Record<WeaponId, WeaponImageSpec> = {
  g18: {
    file: 'G18.png',
    imgW: 535,
    imgH: 160,
    bbox: [200, 34, 333, 127],
    length: 0.29,
    thickness: 0.036,
    gripZNorm: -0.3,
    gripYNorm: -0.06,
    uiScale: 1.82,
    barrel: { z0: -0.1, z1: 0.515, yNorm: 0.33, radius: 0.011 },
    details: [
      { zNorm: 0.43, yNorm: 0.49, sx: 0.011, sy: 0.011, sz: 0.014, tone: 'accent' }, // front sight
      { zNorm: -0.37, yNorm: 0.49, sx: 0.015, sy: 0.011, sz: 0.016, tone: 'metal' }, // rear sight
      { zNorm: -0.34, yNorm: -0.45, sx: 0.04, sy: 0.022, sz: 0.046, tone: 'dark' }, // mag baseplate
      { zNorm: 0.02, yNorm: -0.01, sx: 0.014, sy: 0.014, sz: 0.03, tone: 'dark' }, // trigger guard cube
    ],
    contourBlocks: [
      [0.45, 0.5, 0.191, 0.468], [0.4, 0.45, 0.181, 0.479], [0.35, 0.4, 0.17, 0.468],
      [0.3, 0.35, 0.17, 0.468], [0.25, 0.3, 0.17, 0.468], [0.2, 0.25, 0.17, 0.468],
      [0.15, 0.2, 0.17, 0.468], [0.1, 0.15, -0.011, 0.468], [0.05, 0.1, 0.17, 0.468],
      [0.05, 0.1, -0.021, 0.021], [0, 0.05, 0.17, 0.468], [0, 0.05, -0.021, 0.021],
      [-0.05, 0, 0.16, 0.468], [-0.05, 0, -0.021, 0.021], [-0.1, -0.05, 0.096, 0.468],
      [-0.1, -0.05, -0.011, 0.043], [-0.15, -0.1, -0.011, 0.468], [-0.2, -0.15, -0.17, 0.468],
      [-0.25, -0.2, -0.394, 0.468], [-0.3, -0.25, -0.489, 0.468], [-0.35, -0.3, -0.489, 0.468],
      [-0.4, -0.35, 0.191, 0.49], [-0.4, -0.35, -0.489, 0.053], [-0.45, -0.4, 0.266, 0.468],
      [-0.45, -0.4, -0.489, -0.117], [-0.5, -0.45, -0.447, -0.245],
    ],
  },

  deagle: {
    file: 'EAGLE.png',
    imgW: 535,
    imgH: 160,
    bbox: [196, 34, 359, 126],
    length: 0.35,
    thickness: 0.044,
    gripZNorm: -0.28,
    gripYNorm: -0.05,
    uiScale: 1.72,
    barrel: { z0: -0.05, z1: 0.515, yNorm: 0.34, radius: 0.013 },
    details: [
      { zNorm: 0.44, yNorm: 0.48, sx: 0.013, sy: 0.013, sz: 0.018, tone: 'accent' }, // front sight
      { zNorm: -0.33, yNorm: 0.49, sx: 0.018, sy: 0.012, sz: 0.02, tone: 'metal' }, // rear sight
      { zNorm: 0.16, yNorm: 0.48, sx: 0.022, sy: 0.008, sz: 0.11, tone: 'metal' }, // top rib rail
      { zNorm: -0.31, yNorm: -0.45, sx: 0.046, sy: 0.022, sz: 0.054, tone: 'dark' }, // heavy mag plate
    ],
    contourBlocks: [
      [0.45, 0.5, 0.22, 0.457], [0.4, 0.45, 0.188, 0.468], [0.35, 0.4, 0.188, 0.457],
      [0.3, 0.35, 0.188, 0.446], [0.25, 0.3, 0.188, 0.457], [0.2, 0.25, 0.188, 0.457],
      [0.15, 0.2, 0.188, 0.457], [0.1, 0.15, 0.188, 0.457], [0.05, 0.1, 0.167, 0.468],
      [0, 0.05, -0.059, 0.468], [-0.05, 0, 0.113, 0.468], [-0.05, 0, -0.07, -0.027],
      [-0.1, -0.05, 0.113, 0.478], [-0.1, -0.05, -0.07, 0.027], [-0.15, -0.1, 0.07, 0.478],
      [-0.15, -0.1, -0.048, 0.027], [-0.2, -0.15, -0.188, 0.478], [-0.25, -0.2, -0.489, 0.478],
      [-0.3, -0.25, -0.489, 0.457], [-0.35, -0.3, -0.489, 0.489], [-0.4, -0.35, 0.081, 0.457],
      [-0.4, -0.35, -0.489, -0.005], [-0.45, -0.4, 0.134, 0.371], [-0.45, -0.4, -0.478, -0.274],
      [-0.5, -0.45, 0.134, 0.167],
    ],
  },

  ump45: {
    file: 'UMPSG.png',
    imgW: 535,
    imgH: 160,
    bbox: [133, 16, 409, 149],
    length: 0.58,
    thickness: 0.048,
    gripZNorm: -0.1,
    gripYNorm: 0.06,
    uiScale: 1.38,
    barrel: { z0: 0.2, z1: 0.52, yNorm: 0.25, radius: 0.014 },
    details: [
      { zNorm: 0.35, yNorm: 0.46, sx: 0.018, sy: 0.016, sz: 0.024, tone: 'dark' }, // front sight
      { zNorm: -0.09, yNorm: 0.46, sx: 0.022, sy: 0.016, sz: 0.028, tone: 'dark' }, // rear sight
      { zNorm: 0.1, yNorm: 0.45, sx: 0.028, sy: 0.01, sz: 0.14, tone: 'metal' }, // top Picatinny rail
      { zNorm: 0.15, yNorm: -0.28, sx: 0.036, sy: 0.08, sz: 0.042, tone: 'dark' }, // stick mag cube
    ],
    contourBlocks: [
      [0.45, 0.5, 0.209, 0.306], [0.4, 0.45, 0.201, 0.306], [0.35, 0.4, 0.157, 0.47],
      [0.3, 0.35, 0.164, 0.41], [0.25, 0.3, 0.164, 0.41], [0.2, 0.25, 0.172, 0.41],
      [0.15, 0.2, 0.164, 0.433], [0.15, 0.2, -0.478, -0.097], [0.1, 0.15, -0.209, 0.433],
      [0.05, 0.1, 0.045, 0.433], [0, 0.05, 0.104, 0.433], [-0.05, 0, 0.052, 0.425],
      [-0.1, -0.05, -0.052, 0.44], [-0.15, -0.1, 0.157, 0.455], [-0.15, -0.1, -0.134, 0.045],
      [-0.2, -0.15, 0.187, 0.396], [-0.25, -0.2, 0.179, 0.343], [-0.3, -0.25, 0.157, 0.328],
      [-0.35, -0.3, 0.276, 0.328], [-0.35, -0.3, 0.119, 0.209], [-0.4, -0.35, 0.284, 0.328],
      [-0.4, -0.35, 0.097, 0.127], [-0.45, -0.4, 0.291, 0.328], [-0.45, -0.4, 0.06, 0.09],
      [-0.5, -0.45, 0.015, 0.328],
    ],
  },

  m4a1: {
    file: 'M4A1.png',
    imgW: 535,
    imgH: 160,
    bbox: [89, 18, 443, 140],
    length: 0.78,
    thickness: 0.05,
    gripZNorm: -0.14,
    gripYNorm: 0.06,
    uiScale: 1.24,
    barrel: { z0: 0.18, z1: 0.518, yNorm: 0.215, radius: 0.013 },
    details: [
      { zNorm: 0.27, yNorm: 0.41, sx: 0.018, sy: 0.025, sz: 0.03, tone: 'metal' }, // A2 front sight post
      { zNorm: -0.15, yNorm: 0.47, sx: 0.026, sy: 0.02, sz: 0.095, tone: 'dark' }, // carry handle / rear sight
      { zNorm: -0.05, yNorm: -0.31, sx: 0.036, sy: 0.075, sz: 0.054, tone: 'metal' }, // curved STANAG mag cube
      { zNorm: 0.12, yNorm: 0.21, sx: 0.054, sy: 0.05, sz: 0.14, tone: 'dark' }, // handguard thickness cube
      { zNorm: -0.47, yNorm: 0.1, sx: 0.046, sy: 0.085, sz: 0.025, tone: 'dark' }, // stock buttpad
    ],
    contourBlocks: [
      [0.45, 0.5, 0.175, 0.256], [0.4, 0.45, 0.183, 0.248], [0.35, 0.4, 0.183, 0.248],
      [0.3, 0.35, 0.175, 0.256], [0.25, 0.3, 0.11, 0.467], [0.2, 0.25, 0.037, 0.337],
      [0.15, 0.2, 0.093, 0.337], [0.1, 0.15, 0.093, 0.337], [0.05, 0.1, 0.093, 0.337],
      [0, 0.05, 0.093, 0.337], [-0.05, 0, 0.102, 0.443], [-0.05, 0, -0.435, -0.321],
      [-0.1, -0.05, 0.419, 0.467], [-0.1, -0.05, -0.484, 0.362], [-0.15, -0.1, 0.419, 0.476],
      [-0.15, -0.1, -0.102, 0.362], [-0.2, -0.15, 0.419, 0.492], [-0.2, -0.15, -0.037, 0.362],
      [-0.25, -0.2, -0.256, 0.5], [-0.3, -0.25, 0.093, 0.289], [-0.3, -0.25, -0.329, -0.175],
      [-0.35, -0.3, 0.061, 0.297], [-0.4, -0.35, 0.004, 0.297], [-0.45, -0.4, -0.045, 0.297],
      [-0.5, -0.45, -0.118, 0.297],
    ],
  },

  xm8: {
    file: 'xm8.png',
    imgW: 840,
    imgH: 339,
    bbox: [24, 44, 816, 321],
    length: 0.82,
    thickness: 0.052,
    gripZNorm: -0.17,
    gripYNorm: 0.02,
    uiScale: 1.18,
    hasCheckerBg: true,
    barrel: {
      z0: 0.2,
      z1: 0.515,
      yNorm: 0.058,
      radius: 0.013,
      scope: { z0: -0.22, z1: -0.04, yNorm: 0.36, radius: 0.017, hasLens: true },
    },
    details: [
      { zNorm: -0.13, yNorm: 0.43, sx: 0.028, sy: 0.022, sz: 0.14, tone: 'dark' }, // carry handle arch
      { zNorm: 0.01, yNorm: -0.29, sx: 0.036, sy: 0.075, sz: 0.052, tone: 'dark' }, // curved 5.56 mag
      { zNorm: 0.25, yNorm: 0.16, sx: 0.054, sy: 0.055, sz: 0.15, tone: 'dark' }, // vented forend
      { zNorm: -0.47, yNorm: 0.04, sx: 0.048, sy: 0.088, sz: 0.028, tone: 'dark' }, // stock pad
    ],
    contourBlocks: [
      [0.45, 0.5, 0.047, 0.065], [0.4, 0.45, 0.011, 0.108], [0.35, 0.4, 0.0, 0.234],
      [0.3, 0.35, -0.004, 0.273], [0.25, 0.3, -0.004, 0.302], [0.2, 0.25, -0.004, 0.324],
      [0.15, 0.2, -0.004, 0.209], [0.1, 0.15, 0.227, 0.255], [0.1, 0.15, 0.0, 0.209],
      [0.05, 0.1, 0.23, 0.248], [0.05, 0.1, 0.201, 0.212], [0.05, 0.1, 0.162, 0.183],
      [0.05, 0.1, 0.007, 0.112], [0.0, 0.05, 0.23, 0.248], [0.0, 0.05, 0.187, 0.216],
      [0.0, 0.05, -0.478, 0.108], [-0.05, 0.0, 0.23, 0.252], [-0.05, 0.0, 0.187, 0.219],
      [-0.05, 0.0, -0.194, 0.115], [-0.1, -0.05, 0.237, 0.41], [-0.1, -0.05, 0.187, 0.219],
      [-0.1, -0.05, -0.011, 0.104], [-0.15, -0.1, 0.295, 0.435], [-0.15, -0.1, 0.133, 0.219],
      [-0.15, -0.1, -0.115, 0.126], [-0.2, -0.15, 0.414, 0.464], [-0.2, -0.15, 0.324, 0.385],
      [-0.2, -0.15, 0.032, 0.237], [-0.2, -0.15, -0.327, -0.036], [-0.25, -0.2, 0.058, 0.273],
      [-0.25, -0.2, -0.349, -0.273], [-0.3, -0.25, 0.061, 0.237], [-0.35, -0.3, 0.061, 0.219],
      [-0.4, -0.35, 0.076, 0.209], [-0.45, -0.4, 0.072, 0.212], [-0.5, -0.45, -0.183, 0.227],
    ],
  },

  scar: {
    file: 'SCAR.png',
    imgW: 535,
    imgH: 160,
    bbox: [75, 20, 460, 141],
    length: 0.8,
    thickness: 0.052,
    gripZNorm: -0.16,
    gripYNorm: 0.04,
    uiScale: 1.2,
    barrel: {
      z0: 0.24,
      z1: 0.518,
      yNorm: 0.162,
      radius: 0.013,
      scope: { z0: -0.08, z1: 0.08, yNorm: 0.35, radius: 0.016, hasLens: true },
    },
    details: [
      { zNorm: 0.27, yNorm: 0.39, sx: 0.02, sy: 0.022, sz: 0.028, tone: 'metal' }, // flip front sight
      { zNorm: -0.16, yNorm: 0.37, sx: 0.024, sy: 0.016, sz: 0.034, tone: 'dark' }, // rear sight
      { zNorm: 0.03, yNorm: 0.345, sx: 0.032, sy: 0.01, sz: 0.24, tone: 'metal' }, // full top rail
      { zNorm: 0.02, yNorm: -0.28, sx: 0.038, sy: 0.078, sz: 0.054, tone: 'dark' }, // mag cube
      { zNorm: -0.47, yNorm: -0.02, sx: 0.048, sy: 0.09, sz: 0.032, tone: 'dark' }, // boot stock pad
    ],
    contourBlocks: [
      [0.45, 0.5, 0.115, 0.205], [0.4, 0.45, 0.131, 0.189], [0.35, 0.4, 0.131, 0.189],
      [0.3, 0.35, 0.131, 0.189], [0.25, 0.3, 0.418, 0.492], [0.25, 0.3, 0.107, 0.352],
      [0.2, 0.25, 0.049, 0.336], [0.15, 0.2, 0.049, 0.336], [0.1, 0.15, 0.049, 0.336],
      [0.05, 0.1, 0.057, 0.336], [0.0, 0.05, -0.475, 0.336], [-0.05, 0.0, -0.385, 0.336],
      [-0.1, -0.05, -0.066, 0.336], [-0.1, -0.05, -0.156, -0.131], [-0.15, -0.1, -0.246, 0.336],
      [-0.2, -0.15, -0.008, 0.336], [-0.2, -0.15, -0.377, -0.205], [-0.25, -0.2, -0.008, 0.303],
      [-0.3, -0.25, 0.0, 0.287], [-0.35, -0.3, 0.0, 0.27], [-0.4, -0.35, 0.0, 0.23],
      [-0.45, -0.4, -0.131, 0.23], [-0.5, -0.45, -0.287, 0.246],
    ],
  },

  ak47: {
    file: 'AK.png',
    imgW: 535,
    imgH: 160,
    bbox: [93, 26, 448, 137],
    length: 0.84,
    thickness: 0.052,
    gripZNorm: -0.21,
    gripYNorm: 0.06,
    uiScale: 1.24,
    barrel: { z0: 0.15, z1: 0.518, yNorm: 0.275, radius: 0.013 },
    details: [
      { zNorm: 0.47, yNorm: 0.43, sx: 0.018, sy: 0.024, sz: 0.024, tone: 'metal' }, // hooded front sight post
      { zNorm: 0.07, yNorm: 0.45, sx: 0.026, sy: 0.016, sz: 0.042, tone: 'metal' }, // tangent rear sight
      { zNorm: 0.02, yNorm: -0.27, sx: 0.036, sy: 0.082, sz: 0.056, tone: 'dark' }, // curved banana mag
      { zNorm: 0.18, yNorm: 0.29, sx: 0.054, sy: 0.05, sz: 0.14, tone: 'dark' }, // wood/polymer handguard
      { zNorm: -0.47, yNorm: 0.08, sx: 0.046, sy: 0.082, sz: 0.028, tone: 'dark' }, // AK buttpad
    ],
    contourBlocks: [
      [0.45, 0.5, 0.232, 0.49], [0.4, 0.45, 0.232, 0.321], [0.35, 0.4, 0.232, 0.357],
      [0.3, 0.35, 0.357, 0.42], [0.3, 0.35, 0.232, 0.33], [0.25, 0.3, 0.357, 0.42],
      [0.25, 0.3, 0.232, 0.33], [0.2, 0.25, 0.196, 0.446], [0.15, 0.2, 0.188, 0.446],
      [0.1, 0.15, 0.179, 0.455], [0.05, 0.1, 0.179, 0.482], [0.05, 0.1, -0.411, -0.241],
      [0.0, 0.05, 0.179, 0.438], [0.0, 0.05, -0.429, -0.054], [-0.05, 0.0, -0.241, 0.438],
      [-0.1, -0.05, 0.08, 0.438], [-0.15, -0.1, 0.152, 0.438], [-0.2, -0.15, 0.062, 0.438],
      [-0.25, -0.2, -0.17, 0.429], [-0.3, -0.25, 0.143, 0.295], [-0.35, -0.3, 0.089, 0.286],
      [-0.4, -0.35, 0.027, 0.304], [-0.45, -0.4, -0.045, 0.286], [-0.5, -0.45, -0.089, 0.259],
    ],
  },

  m1014: {
    file: 'M1014.png',
    imgW: 535,
    imgH: 160,
    bbox: [70, 47, 471, 125],
    length: 0.88,
    thickness: 0.048,
    gripZNorm: -0.21,
    gripYNorm: 0.04,
    uiScale: 1.18,
    barrel: {
      z0: 0.08,
      z1: 0.515,
      yNorm: 0.315,
      radius: 0.015,
      underTube: { z0: 0.08, z1: 0.495, yNorm: 0.165, radius: 0.012 },
    },
    details: [
      { zNorm: 0.47, yNorm: 0.42, sx: 0.014, sy: 0.012, sz: 0.02, tone: 'accent' }, // front bead sight
      { zNorm: -0.12, yNorm: 0.46, sx: 0.022, sy: 0.014, sz: 0.036, tone: 'metal' }, // ghost ring sight
      { zNorm: 0.12, yNorm: 0.14, sx: 0.054, sy: 0.045, sz: 0.18, tone: 'dark' }, // ribbed forend
      { zNorm: -0.47, yNorm: -0.14, sx: 0.044, sy: 0.078, sz: 0.028, tone: 'dark' }, // recoil buttpad
    ],
    contourBlocks: [
      [0.45, 0.5, 0.07, 0.411], [0.4, 0.45, 0.259, 0.373], [0.4, 0.45, 0.095, 0.234],
      [0.35, 0.4, 0.259, 0.373], [0.35, 0.4, 0.095, 0.234], [0.3, 0.35, 0.259, 0.373],
      [0.3, 0.35, 0.095, 0.234], [0.25, 0.3, 0.259, 0.373], [0.25, 0.3, 0.095, 0.234],
      [0.2, 0.25, 0.057, 0.373], [0.15, 0.2, 0.044, 0.373], [0.1, 0.15, 0.044, 0.386],
      [0.05, 0.1, 0.044, 0.386], [0, 0.05, 0.07, 0.424], [-0.05, 0, 0.082, 0.437],
      [-0.1, -0.05, 0.082, 0.437], [-0.15, -0.1, 0.082, 0.487], [-0.2, -0.15, -0.297, 0.31],
      [-0.25, -0.2, -0.006, 0.184], [-0.25, -0.2, -0.424, -0.222], [-0.3, -0.25, 0.006, 0.12],
      [-0.35, -0.3, -0.082, 0.222], [-0.4, -0.35, -0.146, 0.196], [-0.45, -0.4, -0.209, 0.171],
      [-0.5, -0.45, -0.462, 0.146],
    ],
  },

  awm: {
    file: 'AWM.png',
    imgW: 535,
    imgH: 160,
    bbox: [48, 25, 497, 116],
    length: 1.12,
    thickness: 0.052,
    gripZNorm: -0.18,
    gripYNorm: -0.04,
    uiScale: 1.12,
    barrel: {
      z0: 0.08,
      z1: 0.515,
      yNorm: 0.105,
      radius: 0.014,
      scope: { z0: -0.21, z1: 0.05, yNorm: 0.305, radius: 0.022, hasLens: true },
    },
    details: [
      { zNorm: 0.47, yNorm: 0.105, sx: 0.036, sy: 0.034, sz: 0.055, tone: 'metal' }, // muzzle brake
      { zNorm: -0.14, yNorm: -0.26, sx: 0.038, sy: 0.042, sz: 0.068, tone: 'dark' }, // sniper magazine cube
      { zNorm: -0.15, yNorm: 0.19, sx: 0.026, sy: 0.024, sz: 0.032, tone: 'metal' }, // scope mount ring 1
      { zNorm: -0.01, yNorm: 0.19, sx: 0.026, sy: 0.024, sz: 0.032, tone: 'metal' }, // scope mount ring 2
      { zNorm: -0.47, yNorm: -0.16, sx: 0.046, sy: 0.082, sz: 0.026, tone: 'dark' }, // buttpad
    ],
    contourBlocks: [
      [0.45, 0.5, 0.043, 0.163], [0.4, 0.45, 0.054, 0.152], [0.35, 0.4, 0.054, 0.152],
      [0.3, 0.35, 0.054, 0.152], [0.25, 0.3, 0.054, 0.152], [0.2, 0.25, 0.043, 0.152],
      [0.15, 0.2, 0.043, 0.152], [0.1, 0.15, -0.12, 0.152], [0.05, 0.1, -0.12, 0.152],
      [0, 0.05, 0.196, 0.402], [0, 0.05, -0.12, 0.163], [-0.05, 0, 0.239, 0.37],
      [-0.05, 0, -0.141, 0.196], [-0.1, -0.05, 0.239, 0.359], [-0.1, -0.05, -0.315, 0.196],
      [-0.15, -0.1, 0.239, 0.359], [-0.15, -0.1, -0.337, 0.196], [-0.2, -0.15, 0.239, 0.359],
      [-0.2, -0.15, -0.13, 0.185], [-0.2, -0.15, -0.283, -0.228], [-0.25, -0.2, -0.489, 0.033],
      [-0.3, -0.25, -0.13, 0.033], [-0.3, -0.25, -0.446, -0.261], [-0.35, -0.3, -0.337, 0.098],
      [-0.4, -0.35, -0.304, 0.098], [-0.45, -0.4, -0.424, 0.065], [-0.5, -0.45, -0.435, 0.065],
    ],
  },
};

export function getWeaponSiteImageUrl(weaponId: WeaponId): string {
  const file = WEAPON_IMAGE_SPECS[weaponId].file;
  return `${SITE_ARMAS_BASE}${encodeURIComponent(file)}`;
}

export function getWeaponCorsImageUrl(weaponId: WeaponId): string {
  const file = WEAPON_IMAGE_SPECS[weaponId].file;
  return `${CORS_ARMAS_BASE}${encodeURIComponent(file)}`;
}

/**
 * Strips checkerboard white/gray JPEG background via edge-seeded floodfill so images like xm8.png
 * become true transparent cutouts for both WebGL 2.5D planes and React UI WeaponIcon.
 */
function removeCheckerboardBackgroundCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const px = imgData.data;
  const total = w * h;
  const bg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isNeutralBg = (idx: number): boolean => {
    const p = idx * 4;
    const r = px[p];
    const g = px[p + 1];
    const b = px[p + 2];
    const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
    const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
    return mx >= 165 && mx - mn <= 24;
  };

  const pushSeed = (x: number, y: number) => {
    const idx = y * w + x;
    if (!bg[idx] && isNeutralBg(idx)) {
      bg[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    pushSeed(x, 0);
    pushSeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushSeed(0, y);
    pushSeed(w - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx - x) / w;
    if (x + 1 < w) {
      const ni = idx + 1;
      if (!bg[ni] && isNeutralBg(ni)) {
        bg[ni] = 1;
        queue[tail++] = ni;
      }
    }
    if (x - 1 >= 0) {
      const ni = idx - 1;
      if (!bg[ni] && isNeutralBg(ni)) {
        bg[ni] = 1;
        queue[tail++] = ni;
      }
    }
    if (y + 1 < h) {
      const ni = idx + w;
      if (!bg[ni] && isNeutralBg(ni)) {
        bg[ni] = 1;
        queue[tail++] = ni;
      }
    }
    if (y - 1 >= 0) {
      const ni = idx - w;
      if (!bg[ni] && isNeutralBg(ni)) {
        bg[ni] = 1;
        queue[tail++] = ni;
      }
    }
  }

  for (let i = 0; i < total; i++) {
    if (bg[i]) {
      px[i * 4 + 3] = 0;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

const cleanIconDataUrlCache: Partial<Record<WeaponId, string>> = {};
const cleanIconSubscribers: Partial<Record<WeaponId, Array<(dataUrl: string) => void>>> = {};
const cleanIconLoading: Partial<Record<WeaponId, boolean>> = {};

export function getCachedCleanWeaponIconUrl(weaponId: WeaponId): string | null {
  return cleanIconDataUrlCache[weaponId] ?? null;
}

export function subscribeCleanWeaponIconUrl(
  weaponId: WeaponId,
  onReady: (dataUrl: string) => void,
): void {
  const existing = cleanIconDataUrlCache[weaponId];
  if (existing) {
    onReady(existing);
    return;
  }
  if (!cleanIconSubscribers[weaponId]) cleanIconSubscribers[weaponId] = [];
  cleanIconSubscribers[weaponId]!.push(onReady);

  if (cleanIconLoading[weaponId]) return;
  cleanIconLoading[weaponId] = true;

  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = removeCheckerboardBackgroundCanvas(img);
    const dataUrl = canvas.toDataURL('image/png');
    cleanIconDataUrlCache[weaponId] = dataUrl;
    const subs = cleanIconSubscribers[weaponId] ?? [];
    cleanIconSubscribers[weaponId] = [];
    for (let i = 0; i < subs.length; i++) subs[i](dataUrl);
  };
  img.onerror = () => {
    cleanIconLoading[weaponId] = false;
  };
  img.src = getWeaponCorsImageUrl(weaponId);
}

// --- Shared Cached Textures, Geometries & Materials (Zero per-entity allocation) ---

interface CachedWeaponAssets {
  rightPlaneGeo: THREE.BufferGeometry;
  leftPlaneGeo: THREE.BufferGeometry;
  coreGeo: THREE.BufferGeometry;
  planeMat: THREE.MeshStandardMaterial;
  barrelParts: Array<{
    geo: THREE.BufferGeometry;
    mat: THREE.Material;
    pos: [number, number, number];
    rotX?: number;
  }>;
  detailParts: Array<{
    geo: THREE.BufferGeometry;
    mat: THREE.Material;
    pos: [number, number, number];
  }>;
}

const DARK_CORE_MAT = new THREE.MeshStandardMaterial({
  color: 0x16191f,
  roughness: 0.72,
  metalness: 0.34,
});
const GUN_METAL_MAT = new THREE.MeshStandardMaterial({
  color: 0x262b33,
  roughness: 0.38,
  metalness: 0.82,
});
const SIGHT_ACCENT_MAT = new THREE.MeshStandardMaterial({
  color: 0xef4444,
  emissive: 0x7f1d1d,
  emissiveIntensity: 0.45,
  roughness: 0.3,
  metalness: 0.4,
});
const LENS_BLUE_MAT = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  emissive: 0x0284c7,
  emissiveIntensity: 0.4,
  roughness: 0.15,
  metalness: 0.9,
});

function createFallbackWeaponTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 4;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#2b3038';
    ctx.fillRect(0, 0, 4, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const assetCache: Partial<Record<WeaponId, CachedWeaponAssets>> = {};

function createParallelSidePlaneGeometry(
  side: 'right' | 'left',
  halfT: number,
  L: number,
  H: number,
  offZ: number,
  offY: number,
  uMin: number,
  uMax: number,
  vBot: number,
  vTop: number,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const x = side === 'right' ? halfT : -halfT;
  const zFront = L * 0.5 + offZ;
  const zRear = -L * 0.5 + offZ;
  const yTop = H * 0.5 + offY;
  const yBot = -H * 0.5 + offY;

  const positions = new Float32Array([
    x, yTop, zFront, // 0: FrontTop
    x, yTop, zRear,  // 1: RearTop
    x, yBot, zFront, // 2: FrontBot
    x, yBot, zRear,  // 3: RearBot
  ]);

  const nx = side === 'right' ? 1 : -1;
  const normals = new Float32Array([
    nx, 0, 0,
    nx, 0, 0,
    nx, 0, 0,
    nx, 0, 0,
  ]);

  const uvs = new Float32Array([
    uMin, vTop, // FrontTop
    uMax, vTop, // RearTop
    uMin, vBot, // FrontBot
    uMax, vBot, // RearBot
  ]);

  const indices =
    side === 'right'
      ? [1, 0, 3, 3, 0, 2]
      : [0, 1, 3, 0, 3, 2];

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

function buildMergedBoxesGeometry(
  boxes: Array<{ cx: number; cy: number; cz: number; sx: number; sy: number; sz: number }>,
): THREE.BufferGeometry {
  const boxProto = new THREE.BoxGeometry(1, 1, 1);
  const protoPos = boxProto.attributes.position.array as Float32Array;
  const protoNorm = boxProto.attributes.normal.array as Float32Array;
  const protoIdx = boxProto.index!.array;

  const vPerBox = protoPos.length / 3;
  const iPerBox = protoIdx.length;
  const positions = new Float32Array(boxes.length * protoPos.length);
  const normals = new Float32Array(boxes.length * protoNorm.length);
  const indices = new Uint16Array(boxes.length * iPerBox);

  for (let b = 0; b < boxes.length; b++) {
    const { cx, cy, cz, sx, sy, sz } = boxes[b];
    const vOff = b * protoPos.length;
    for (let i = 0; i < protoPos.length; i += 3) {
      positions[vOff + i] = protoPos[i] * sx + cx;
      positions[vOff + i + 1] = protoPos[i + 1] * sy + cy;
      positions[vOff + i + 2] = protoPos[i + 2] * sz + cz;
      normals[vOff + i] = protoNorm[i];
      normals[vOff + i + 1] = protoNorm[i + 1];
      normals[vOff + i + 2] = protoNorm[i + 2];
    }
    const iOff = b * iPerBox;
    const baseVertex = b * vPerBox;
    for (let i = 0; i < iPerBox; i++) {
      indices[iOff + i] = protoIdx[i] + baseVertex;
    }
  }

  boxProto.dispose();
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  return merged;
}

function getOrCreateCachedWeaponAssets(weaponId: WeaponId): CachedWeaponAssets {
  const existing = assetCache[weaponId];
  if (existing) return existing;

  const spec = WEAPON_IMAGE_SPECS[weaponId];
  const [minX, minY, maxX, maxY] = spec.bbox;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const L = spec.length;
  const H = L * (bh / bw);
  const T = spec.thickness;
  const halfT = T * 0.5;

  const offZ = -spec.gripZNorm * L;
  const offY = -spec.gripYNorm * H;

  const uMin = minX / spec.imgW;
  const uMax = (maxX + 1) / spec.imgW;
  const vTop = 1 - minY / spec.imgH;
  const vBot = 1 - (maxY + 1) / spec.imgH;

  const rightPlaneGeo = createParallelSidePlaneGeometry(
    'right',
    halfT,
    L,
    H,
    offZ,
    offY,
    uMin,
    uMax,
    vBot,
    vTop,
  );
  const leftPlaneGeo = createParallelSidePlaneGeometry(
    'left',
    halfT,
    L,
    H,
    offZ,
    offY,
    uMin,
    uMax,
    vBot,
    vTop,
  );

  const fallbackTex = createFallbackWeaponTexture();
  const planeMat = new THREE.MeshStandardMaterial({
    map: fallbackTex,
    emissiveMap: fallbackTex,
    emissive: new THREE.Color(0x2a2d34),
    emissiveIntensity: 0.45,
    alphaTest: 0.35,
    transparent: false,
    side: THREE.DoubleSide,
    roughness: 0.48,
    metalness: 0.22,
  });

  if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
    const loadImg = (url: string, onFail?: () => void) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const texSource = spec.hasCheckerBg
          ? removeCheckerboardBackgroundCanvas(img)
          : img;
        if (spec.hasCheckerBg && texSource instanceof HTMLCanvasElement && !cleanIconDataUrlCache[weaponId]) {
          cleanIconDataUrlCache[weaponId] = texSource.toDataURL('image/png');
          const subs = cleanIconSubscribers[weaponId] ?? [];
          cleanIconSubscribers[weaponId] = [];
          for (let i = 0; i < subs.length; i++) subs[i](cleanIconDataUrlCache[weaponId]!);
        }
        const tex = new THREE.Texture(texSource);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        const isMobile =
          typeof navigator !== 'undefined' &&
          (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints ?? 0) > 0);
        tex.anisotropy = isMobile ? 1 : 2;
        tex.needsUpdate = true;
        planeMat.map = tex;
        planeMat.emissiveMap = tex;
        planeMat.needsUpdate = true;
        fallbackTex.dispose();
      };
      img.onerror = () => {
        if (onFail) onFail();
      };
      img.src = url;
    };
    loadImg(getWeaponCorsImageUrl(weaponId), () => {
      loadImg(getWeaponSiteImageUrl(weaponId));
    });
  }

  const coreThick = Math.max(0.012, T - 0.005);
  const coreBoxes = spec.contourBlocks.map(([z0, z1, yBot, yTop]) => {
    const rawH = Math.max(0.006, (yTop - yBot) * H);
    const insetH = Math.max(0.005, rawH * 0.92);
    return {
      cx: 0,
      cy: ((yBot + yTop) * 0.5) * H + offY,
      cz: ((z0 + z1) * 0.5) * L + offZ,
      sx: coreThick,
      sy: insetH,
      sz: (z1 - z0) * L * 1.03,
    };
  });
  const coreGeo = buildMergedBoxesGeometry(coreBoxes);

  const barrelParts: CachedWeaponAssets['barrelParts'] = [];
  const bSpec = spec.barrel;
  const barrelLen = Math.max(0.06, (bSpec.z1 - bSpec.z0) * L);
  const barrelMidZ = ((bSpec.z0 + bSpec.z1) * 0.5) * L + offZ;
  const barrelY = bSpec.yNorm * H + offY;
  barrelParts.push({
    geo: new THREE.CylinderGeometry(bSpec.radius, bSpec.radius, barrelLen, 6),
    mat: GUN_METAL_MAT,
    pos: [0, barrelY, barrelMidZ],
    rotX: Math.PI / 2,
  });
  barrelParts.push({
    geo: new THREE.CylinderGeometry(bSpec.radius * 0.62, bSpec.radius * 0.62, 0.008, 6),
    mat: DARK_CORE_MAT,
    pos: [0, barrelY, bSpec.z1 * L + offZ + 0.002],
    rotX: Math.PI / 2,
  });

  if (bSpec.underTube) {
    const ut = bSpec.underTube;
    const utLen = Math.max(0.05, (ut.z1 - ut.z0) * L);
    barrelParts.push({
      geo: new THREE.CylinderGeometry(ut.radius, ut.radius, utLen, 6),
      mat: DARK_CORE_MAT,
      pos: [0, ut.yNorm * H + offY, ((ut.z0 + ut.z1) * 0.5) * L + offZ],
      rotX: Math.PI / 2,
    });
  }

  if (bSpec.scope) {
    const sc = bSpec.scope;
    const scLen = Math.max(0.06, (sc.z1 - sc.z0) * L);
    const scZ = ((sc.z0 + sc.z1) * 0.5) * L + offZ;
    const scY = sc.yNorm * H + offY;
    barrelParts.push({
      geo: new THREE.CylinderGeometry(sc.radius, sc.radius * 0.9, scLen, 8),
      mat: GUN_METAL_MAT,
      pos: [0, scY, scZ],
      rotX: Math.PI / 2,
    });
    if (sc.hasLens) {
      barrelParts.push({
        geo: new THREE.CylinderGeometry(sc.radius * 1.15, sc.radius * 0.98, 0.036, 8),
        mat: LENS_BLUE_MAT,
        pos: [0, scY, sc.z1 * L + offZ + 0.012],
        rotX: Math.PI / 2,
      });
    }
  }

  const detailParts: CachedWeaponAssets['detailParts'] = spec.details.map((d) => ({
    geo: new THREE.BoxGeometry(d.sx, d.sy, d.sz),
    mat:
      d.tone === 'accent'
        ? SIGHT_ACCENT_MAT
        : d.tone === 'metal'
          ? GUN_METAL_MAT
          : DARK_CORE_MAT,
    pos: [0, d.yNorm * H + offY, d.zNorm * L + offZ],
  }));

  const created: CachedWeaponAssets = {
    rightPlaneGeo,
    leftPlaneGeo,
    coreGeo,
    planeMat,
    barrelParts,
    detailParts,
  };
  assetCache[weaponId] = created;
  return created;
}

export function buildHybridWeaponModel(weaponId: WeaponId): THREE.Group {
  const assets = getOrCreateCachedWeaponAssets(weaponId);
  const group = new THREE.Group();
  group.name = `weapon_25d_${weaponId}`;

  const markMesh = (m: THREE.Mesh) => {
    m.castShadow = false;
    m.receiveShadow = false;
    m.userData.sharedWeaponAsset = true;
    return m;
  };

  const rightPlane = markMesh(new THREE.Mesh(assets.rightPlaneGeo, assets.planeMat));
  const leftPlane = markMesh(new THREE.Mesh(assets.leftPlaneGeo, assets.planeMat));
  const coreMesh = markMesh(new THREE.Mesh(assets.coreGeo, DARK_CORE_MAT));
  group.add(rightPlane, leftPlane, coreMesh);

  for (let i = 0; i < assets.barrelParts.length; i++) {
    const bp = assets.barrelParts[i];
    const m = markMesh(new THREE.Mesh(bp.geo, bp.mat));
    m.position.set(bp.pos[0], bp.pos[1], bp.pos[2]);
    if (bp.rotX !== undefined) m.rotation.x = bp.rotX;
    group.add(m);
  }

  for (let i = 0; i < assets.detailParts.length; i++) {
    const dp = assets.detailParts[i];
    const m = markMesh(new THREE.Mesh(dp.geo, dp.mat));
    m.position.set(dp.pos[0], dp.pos[1], dp.pos[2]);
    group.add(m);
  }

  return group;
}

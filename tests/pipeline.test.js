import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeBbox,
  districtCodeFromHdxPcode,
  foldTurkishToAscii,
  plateCodeFromHdxPcode,
  rewindGeometry,
  runPipelineStep,
  toSlug,
} from '../scripts/lib/pipeline.js';

function ringOrientationScore(ring) {
  let sum = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    sum += (x2 - x1) * (y2 + y1);
  }

  return sum;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pipeline text helpers', () => {
  it('folds Turkish characters deterministically', () => {
    expect(foldTurkishToAscii('ÇğİıÖŞÜ')).toBe('CgiiOSU');
    expect(foldTurkishToAscii('İstanbul')).toBe('istanbul');
  });

  it('normalizes slug output', () => {
    expect(toSlug('Çankırı Merkez')).toBe('cankiri-merkez');
    expect(toSlug('  İzmir   / Konak  ')).toBe('izmir-konak');
  });
});

describe('pipeline code helpers', () => {
  it('derives plate and district codes from HDX pcode', () => {
    expect(plateCodeFromHdxPcode('TUR034')).toBe('34');
    expect(districtCodeFromHdxPcode('TUR034012')).toBe('012');
  });
});

describe('pipeline geometry helpers', () => {
  it('computes bbox in GeoJSON order', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[
        [32.5, 39.8],
        [33.1, 39.8],
        [33.1, 40.2],
        [32.5, 40.2],
        [32.5, 39.8],
      ]],
    };

    expect(computeBbox(geometry)).toEqual([32.5, 39.8, 33.1, 40.2]);
  });

  it('throws when geometry has no coordinates', () => {
    expect(() => computeBbox({ type: 'Polygon', coordinates: [] })).toThrow('Geometry has no coordinates');
  });

  it('normalizes polygon ring orientation to the exporter contract', () => {
    const clockwiseOuter = [
      [0, 0],
      [0, 3],
      [3, 3],
      [3, 0],
      [0, 0],
    ];
    const counterClockwiseHole = [
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 2],
      [1, 1],
    ];

    const rewound = rewindGeometry({
      type: 'Polygon',
      coordinates: [clockwiseOuter, counterClockwiseHole],
    });

    expect(ringOrientationScore(rewound.coordinates[0])).toBeGreaterThan(0);
    expect(ringOrientationScore(rewound.coordinates[1])).toBeLessThan(0);
  });
});

describe('runPipelineStep', () => {
  it('executes successful steps without exiting', () => {
    const step = vi.fn();

    expect(() => runPipelineStep('unit-success', step)).not.toThrow();
    expect(step).toHaveBeenCalledTimes(1);
  });

  it('logs and exits on failure', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });

    expect(() => runPipelineStep('unit-failure', () => {
      throw new Error('boom');
    })).toThrow('process.exit:1');

    expect(consoleError).toHaveBeenCalledWith('[pipeline:unit-failure] failed');
    expect(consoleError.mock.calls[1][0]).toContain('boom');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

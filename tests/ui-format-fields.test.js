import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = fs.readFileSync(path.resolve('D:/turkiye_map/app.js'), 'utf8');

describe('UI format alanlari', () => {
  it('PNG ve PDF icin alan secimi panelini acik tutar', () => {
    expect(appSource).toContain("const isRasterVisual = state.format === 'png' || state.format === 'pdf';");
    expect(appSource).toContain('toggleField(els.fieldsField, isStructuredData || isVisual);');
  });

  it('PNG ve PDF icin alan seceneklerini uretir', () => {
    const structuredFormatsLine = appSource
      .split('\n')
      .find((line) => line.includes('const structuredFormats = new Set'));

    expect(structuredFormatsLine).toContain("'png'");
    expect(structuredFormatsLine).toContain("'pdf'");
  });
});

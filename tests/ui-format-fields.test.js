import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appSource = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app.js'),
  'utf8',
);

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

  it('DXF icin alan secimi yerine aciklama notu gosterir', () => {
    expect(appSource).toContain("dxfFieldsNote: document.querySelector('#dxfFieldsNote')");
    expect(appSource).toContain("toggleField(els.dxfFieldsNote, state.format === 'dxf');");
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('viewport', () => {
  it('zoom allowed', () => {
    const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
    const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]*)"/);

    expect(viewport?.[1]).toContain('width=device-width');
    expect(viewport?.[1]).not.toContain('user-scalable=no');
    expect(viewport?.[1]).not.toContain('maximum-scale=1');
  });
});

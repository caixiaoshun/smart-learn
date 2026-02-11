import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { ensureFixtures } from './helpers/generate-fixtures';

// Generate test fixtures before all tests
let fixtures: { pdf: string; notebook: string };

test.beforeAll(() => {
  fixtures = ensureFixtures();
});

// ═════════════════════════════════════════════════════════════
// TEST FIXTURES VALIDATION
// ═════════════════════════════════════════════════════════════

test.describe('Test Fixtures', () => {
  test('should generate valid PDF fixture', async () => {
    expect(fs.existsSync(fixtures.pdf)).toBe(true);

    const content = fs.readFileSync(fixtures.pdf, 'utf-8');
    expect(content).toContain('%PDF-1.4');
    expect(content).toContain('%%EOF');
  });

  test('should generate valid Jupyter Notebook fixture', async () => {
    expect(fs.existsSync(fixtures.notebook)).toBe(true);

    const content = JSON.parse(fs.readFileSync(fixtures.notebook, 'utf-8'));
    expect(content.nbformat).toBe(4);
    expect(content.cells).toHaveLength(3);
    expect(content.cells[0].cell_type).toBe('markdown');
    expect(content.cells[1].cell_type).toBe('code');
  });
});

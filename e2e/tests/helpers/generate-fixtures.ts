import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');

/**
 * Generate a minimal valid PDF file for testing upload functionality.
 */
export function generateTestPDF(filename = 'test-homework.pdf'): string {
  const filePath = path.join(FIXTURES_DIR, filename);
  if (fs.existsSync(filePath)) return filePath;

  // Minimal valid PDF structure
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Test Homework) Tj ET
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000360 00000 n 

trailer
<< /Size 6 /Root 1 0 R >>
startxref
441
%%EOF`;

  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  fs.writeFileSync(filePath, pdfContent);
  return filePath;
}

/**
 * Generate a minimal valid Jupyter Notebook (.ipynb) for testing.
 */
export function generateTestNotebook(filename = 'test-experiment.ipynb'): string {
  const filePath = path.join(FIXTURES_DIR, filename);
  if (fs.existsSync(filePath)) return filePath;

  const notebook = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
        version: '3.10.0',
      },
    },
    cells: [
      {
        cell_type: 'markdown',
        metadata: {},
        source: ['# Test Experiment\n', '\n', 'This is a test notebook for the smart-learn platform.'],
      },
      {
        cell_type: 'code',
        execution_count: 1,
        metadata: {},
        outputs: [
          {
            name: 'stdout',
            output_type: 'stream',
            text: ['Hello, Smart Learn!\n'],
          },
        ],
        source: ['print("Hello, Smart Learn!")'],
      },
      {
        cell_type: 'code',
        execution_count: 2,
        metadata: {},
        outputs: [
          {
            data: { 'text/plain': ['15'] },
            execution_count: 2,
            metadata: {},
            output_type: 'execute_result',
          },
        ],
        source: ['# Simple calculation\n', 'result = sum(range(1, 6))\n', 'result'],
      },
    ],
  };

  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(notebook, null, 2));
  return filePath;
}

/**
 * Ensure all test fixtures exist. Call before running tests.
 */
export function ensureFixtures(): { pdf: string; notebook: string } {
  return {
    pdf: generateTestPDF(),
    notebook: generateTestNotebook(),
  };
}

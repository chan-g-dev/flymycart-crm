import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import * as fs from 'node:fs';
XLSX.set_fs(fs);
import { exportToExcel } from './excelExport.js';

test('Excel export preserves negative monetary amounts and treats formula-like names as text', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fmc-export-test-'));
    const filename = join(directory, 'report.xlsx');
    try {
        exportToExcel(['Amount', 'Customer'], [[-125.5, '=1+1'], [200, '+Customer']], filename);
        const workbook = XLSX.read(readFileSync(filename));
        const sheet = workbook.Sheets.Report;
        assert.equal(sheet.A2.t, 'n');
        assert.equal(sheet.A2.v, -125.5);
        assert.equal(sheet.A3.v, 200);
        assert.equal(sheet.B2.t, 's');
        assert.equal(sheet.B2.f, undefined);
        assert.equal(sheet.B3.f, undefined);
    } finally {
        try { if (fs.existsSync(filename)) unlinkSync(filename); } finally { rmdirSync(directory); }
    }
});

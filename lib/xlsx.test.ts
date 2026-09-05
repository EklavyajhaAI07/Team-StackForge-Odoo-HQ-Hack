// Tests for the dependency-free .xlsx writer.
//
// The last test writes a real workbook to a temp file and asks the operating system's own
// `unzip -t` to verify every CRC. If our ZIP framing were wrong, Excel would reject the file
// and so does unzip — which makes this a genuine check rather than us grading our own homework.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildXlsx, columnLetter, type Sheet } from "./xlsx";

const SHEET: Sheet = {
  name: "Quotations",
  columns: [
    { header: "Quotation", format: "text" },
    { header: "Customer", format: "text" },
    { header: "Units", format: "number" },
    { header: "Total", format: "money" },
    { header: "Margin", format: "percent" },
  ],
  rows: [
    ["Q-1007", "Acme Industries & Co", 9, 1_23_456.78, 19.6],
    ["Q-1008", 'Beta "Traders"', 4, 45_000, 22.1],
    ["Q-1009", "Nimbus <Retail>", 1, -900.5, 0],
  ],
  totals: ["Total", null, 14, 1_67_556.28, 20.4],
};

const utf8 = new TextDecoder();

/** Pull one stored (uncompressed) file out of our own archive, by scanning local headers. */
function readEntry(bytes: Uint8Array, wanted: string): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 0;
  while (at + 30 <= bytes.length && view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLen = view.getUint16(at + 26, true);
    const extraLen = view.getUint16(at + 28, true);
    const name = utf8.decode(bytes.subarray(at + 30, at + 30 + nameLen));
    const start = at + 30 + nameLen + extraLen;
    if (name === wanted) return utf8.decode(bytes.subarray(start, start + size));
    at = start + size;
  }
  return null;
}

test("columnLetter spans past Z the way a spreadsheet does", () => {
  assert.equal(columnLetter(0), "A");
  assert.equal(columnLetter(25), "Z");
  assert.equal(columnLetter(26), "AA");
  assert.equal(columnLetter(51), "AZ");
  assert.equal(columnLetter(701), "ZZ");
});

test("the workbook carries every part Excel requires", () => {
  const bytes = buildXlsx(SHEET);
  assert.equal(bytes[0], 0x50, "starts with the PK signature");
  assert.equal(bytes[1], 0x4b);
  for (const part of [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml",
  ]) {
    assert.ok(readEntry(bytes, part) !== null, `missing ${part}`);
  }
});

test("numeric columns are written as numbers, not text", () => {
  const xml = readEntry(buildXlsx(SHEET), "xl/worksheets/sheet1.xml")!;
  // Excel can only sum a cell that has a bare <v>. A t="inlineStr" total is a string that
  // merely looks like money, which is exactly the failure this export exists to avoid.
  assert.match(xml, /<c r="D2" s="3"><v>123456.78<\/v><\/c>/);
  assert.match(xml, /<c r="C2" s="2"><v>9<\/v><\/c>/);
  assert.match(xml, /<c r="E2" s="4"><v>19.6<\/v><\/c>/);
  // ...and the totals row uses the bold variants of the same formats.
  assert.match(xml, /<c r="D5" s="8"><v>167556.28<\/v><\/c>/);
  assert.ok(!/<c r="D2"[^>]*t="inlineStr"/.test(xml), "money must not be written as a string");
});

test("markup in customer names is escaped rather than breaking the sheet", () => {
  const xml = readEntry(buildXlsx(SHEET), "xl/worksheets/sheet1.xml")!;
  assert.match(xml, /Acme Industries &amp; Co/);
  assert.match(xml, /Beta &quot;Traders&quot;/);
  assert.match(xml, /Nimbus &lt;Retail&gt;/);
  assert.ok(!xml.includes("<Retail>"), "a raw angle bracket would corrupt the XML");
});

test("a sheet name Excel would reject is repaired", () => {
  const xml = readEntry(buildXlsx({ ...SHEET, name: "Period: 2026/01 [draft] — a very long tab name" }), "xl/workbook.xml")!;
  const name = /name="([^"]*)"/.exec(xml)![1];
  assert.ok(name.length <= 31, `sheet name too long: ${name}`);
  assert.ok(!/[:\\/?*[\]]/.test(name), `illegal character in sheet name: ${name}`);
});

test("an empty report still produces a workbook that opens", () => {
  const xml = readEntry(buildXlsx({ ...SHEET, rows: [], totals: undefined }), "xl/worksheets/sheet1.xml")!;
  assert.match(xml, /<dimension ref="A1:E1"\/>/);
  assert.match(xml, /<row r="1"/);
});

test("unzip -t accepts the archive, so every CRC and offset is correct", () => {
  const dir = mkdtempSync(join(tmpdir(), "dealflow-xlsx-"));
  const file = join(dir, "report.xlsx");
  try {
    writeFileSync(file, buildXlsx(SHEET));
    // Throws on a bad CRC, a bad offset or a truncated central directory.
    const out = execFileSync("unzip", ["-t", file], { encoding: "utf8" });
    assert.match(out, /No errors detected/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A minimal, dependency-free .xlsx writer.
//
// An xlsx file is a ZIP of XML parts. We write the ZIP with the STORE method (no compression),
// which is a fully valid ZIP that Excel, Numbers and LibreOffice all open — it avoids pulling in
// a deflate implementation for what are, at report sizes, a few dozen kilobytes.
//
// Pure: sheet in, bytes out. No DOM, no Node APIs, so it runs in the browser and under node:test.

// ── ZIP primitives ─────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time, the only timestamp format a ZIP local header carries. */
function dosStamp(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

class ByteWriter {
  private parts: Uint8Array[] = [];
  private size = 0;

  get length(): number {
    return this.size;
  }

  push(bytes: Uint8Array): void {
    this.parts.push(bytes);
    this.size += bytes.length;
  }

  u16(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]));
  }

  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.size);
    let at = 0;
    for (const part of this.parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }
}

const utf8 = new TextEncoder();

export type ZipEntry = { name: string; data: Uint8Array };

/** Build a STORE-method ZIP archive. Exported so the xlsx structure can be asserted in tests. */
export function zip(entries: ZipEntry[], now = new Date()): Uint8Array {
  const { time, date } = dosStamp(now);
  const body = new ByteWriter();
  const central = new ByteWriter();

  for (const entry of entries) {
    const name = utf8.encode(entry.name);
    const crc = crc32(entry.data);
    const offset = body.length;

    body.u32(0x04034b50); // local file header
    body.u16(20); // version needed
    body.u16(0x0800); // UTF-8 filenames
    body.u16(0); // method: store
    body.u16(time);
    body.u16(date);
    body.u32(crc);
    body.u32(entry.data.length); // compressed == uncompressed under STORE
    body.u32(entry.data.length);
    body.u16(name.length);
    body.u16(0); // no extra field
    body.push(name);
    body.push(entry.data);

    central.u32(0x02014b50); // central directory header
    central.u16(20); // version made by
    central.u16(20); // version needed
    central.u16(0x0800);
    central.u16(0);
    central.u16(time);
    central.u16(date);
    central.u32(crc);
    central.u32(entry.data.length);
    central.u32(entry.data.length);
    central.u16(name.length);
    central.u16(0); // extra
    central.u16(0); // comment
    central.u16(0); // disk number
    central.u16(0); // internal attributes
    central.u32(0); // external attributes
    central.u32(offset);
    central.push(name);
  }

  const out = new ByteWriter();
  out.push(body.toUint8Array());
  const centralBytes = central.toUint8Array();
  out.push(centralBytes);
  out.u32(0x06054b50); // end of central directory
  out.u16(0);
  out.u16(0);
  out.u16(entries.length);
  out.u16(entries.length);
  out.u32(centralBytes.length);
  out.u32(body.length);
  out.u16(0); // no archive comment
  return out.toUint8Array();
}

// ── Spreadsheet ────────────────────────────────────────────────────────────────

export type CellFormat = "text" | "number" | "money" | "percent" | "date";

export type Column = {
  header: string;
  format: CellFormat;
  /** Column width in characters. */
  width?: number;
};

/** A cell value. `null` writes an empty cell rather than the string "null". */
export type CellValue = string | number | null;

export type Sheet = {
  name: string;
  columns: Column[];
  rows: CellValue[][];
  /** Optional bold row appended under the data, for column totals. */
  totals?: CellValue[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Control characters are not representable in XML 1.0 and make Excel refuse the file.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * Style indices baked into styles.xml below. Keeping them as named constants means the
 * sheet writer never has to know the order of the cellXfs list.
 */
const STYLE = { text: 0, header: 1, number: 2, money: 3, percent: 4, date: 5, totalText: 6, totalNumber: 7, totalMoney: 8, totalPercent: 9 } as const;

function bodyStyle(format: CellFormat): number {
  switch (format) {
    case "number":
      return STYLE.number;
    case "money":
      return STYLE.money;
    case "percent":
      return STYLE.percent;
    case "date":
      return STYLE.date;
    default:
      return STYLE.text;
  }
}

function totalStyle(format: CellFormat): number {
  switch (format) {
    case "number":
      return STYLE.totalNumber;
    case "money":
      return STYLE.totalMoney;
    case "percent":
      return STYLE.totalPercent;
    default:
      return STYLE.totalText;
  }
}

function cellXml(ref: string, value: CellValue, format: CellFormat, style: number): string {
  if (value === null || value === "") return "";
  // Numeric columns carry real numbers so Excel can sum and chart them — that is the entire
  // reason this exists alongside the CSV export.
  if (format !== "text" && typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const rows: string[] = [];

  const cols = sheet.columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`)
    .join("");

  const headerCells = sheet.columns
    .map((c, i) => cellXml(`${columnLetter(i)}1`, c.header, "text", STYLE.header))
    .join("");
  rows.push(`<row r="1" ht="18" customHeight="1">${headerCells}</row>`);

  sheet.rows.forEach((row, r) => {
    const number = r + 2;
    const cells = sheet.columns
      .map((c, i) => cellXml(`${columnLetter(i)}${number}`, row[i] ?? null, c.format, bodyStyle(c.format)))
      .join("");
    rows.push(`<row r="${number}">${cells}</row>`);
  });

  if (sheet.totals) {
    const number = sheet.rows.length + 2;
    const cells = sheet.columns
      .map((c, i) => cellXml(`${columnLetter(i)}${number}`, sheet.totals![i] ?? null, c.format, totalStyle(c.format)))
      .join("");
    rows.push(`<row r="${number}">${cells}</row>`);
  }

  const lastRow = sheet.rows.length + (sheet.totals ? 2 : 1);
  const dimension = `A1:${columnLetter(Math.max(0, sheet.columns.length - 1))}${Math.max(1, lastRow)}`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="${dimension}"/>` +
    // Freeze the header so a long report stays readable when scrolled.
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${rows.join("")}</sheetData>` +
    `<autoFilter ref="A1:${columnLetter(Math.max(0, sheet.columns.length - 1))}${Math.max(1, sheet.rows.length + 1)}"/>` +
    `</worksheet>`
  );
}

// ₹ #,##0.00 with a red negative — the format Excel applies to the money columns.
const MONEY_FORMAT = '&quot;₹&quot;#,##0.00;[Red]-&quot;₹&quot;#,##0.00';

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="2">` +
  `<numFmt numFmtId="164" formatCode="${MONEY_FORMAT}"/>` +
  `<numFmt numFmtId="165" formatCode="0.0&quot;%&quot;"/>` +
  `</numFmts>` +
  `<fonts count="2">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="3">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFEFEFF4"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="2">` +
  `<border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left/><right/><top style="thin"><color rgb="FF9AA0AE"/></top><bottom/><diagonal/></border>` +
  `</borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="10">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` + // 0 text
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` + // 1 header
  `<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` + // 2 number #,##0
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` + // 3 money
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` + // 4 percent
  `<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` + // 5 date
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>` + // 6 total text
  `<xf numFmtId="3" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>` + // 7 total number
  `<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>` + // 8 total money
  `<xf numFmtId="165" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>` + // 9 total percent
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** Excel rejects a sheet name over 31 chars or containing any of : \ / ? * [ ] */
function safeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, " ").trim();
  return (cleaned || "Sheet1").slice(0, 31);
}

/**
 * Build a single-sheet .xlsx workbook.
 *
 * Returns raw bytes; the caller decides whether that becomes a Blob download in the browser
 * or a file on disk in a test.
 */
export function buildXlsx(sheet: Sheet, now = new Date()): Uint8Array {
  const name = safeSheetName(sheet.name);

  const files: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      data: utf8.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          `</Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: utf8.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      data: utf8.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
          `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${escapeXml(name)}" sheetId="1" r:id="rId1"/></sheets>` +
          `</workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: utf8.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
          `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`,
      ),
    },
    { name: "xl/styles.xml", data: utf8.encode(STYLES_XML) },
    { name: "xl/worksheets/sheet1.xml", data: utf8.encode(sheetXml(sheet)) },
  ];

  return zip(files, now);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

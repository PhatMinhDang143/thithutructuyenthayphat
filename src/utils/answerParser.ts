import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

export interface ParsedAnswersResult {
  p1: Record<number, 'A' | 'B' | 'C' | 'D'>;
  p2: Record<number, Record<'a' | 'b' | 'c' | 'd', 'Đ' | 'S'>>;
  p3: Record<number, string>;
  p1Count: number;
  p2Count: number;
  p3Count: number;
  rawLogs: string[];
}

/**
 * Normalizes true/false string into 'Đ' | 'S'
 */
function normalizeTrueFalse(val: string): 'Đ' | 'S' | null {
  if (!val) return null;
  const s = val.toString().trim().toLowerCase();
  if (['đ', 'd', 'đúng', 'dung', 't', 'true', '1', 'v', 'x', '+'].includes(s)) return 'Đ';
  if (['s', 'sai', 'f', 'false', '0', '-'].includes(s)) return 'S';
  return null;
}

/**
 * Normalizes Part 1 choice to 'A' | 'B' | 'C' | 'D'
 */
function normalizeChoice(val: string): 'A' | 'B' | 'C' | 'D' | null {
  if (!val) return null;
  const s = val.toString().trim().toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(s)) return s as 'A' | 'B' | 'C' | 'D';
  // Check if starts with A, B, C, D
  const match = s.match(/^[ABCD]\b/);
  if (match) return match[0] as 'A' | 'B' | 'C' | 'D';
  return null;
}

/**
 * Parse smart text string (can be pasted directly or extracted from Word/TXT)
 */
export function parseAnswersFromText(text: string): ParsedAnswersResult {
  const result: ParsedAnswersResult = {
    p1: {},
    p2: {},
    p3: {},
    p1Count: 0,
    p2Count: 0,
    p3Count: 0,
    rawLogs: [],
  };

  if (!text || !text.trim()) {
    return result;
  }

  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Check if text is divided by section headers like "PHẦN I", "PHẦN II", "PHẦN III"
  const sectionSplit = cleanText.split(/(?:^|\n)\s*(?:phần|phan|part)\s*([iIvVxX\d]+)[:\s-]*/i);

  if (sectionSplit.length > 2) {
    // Found structured section headers!
    for (let i = 1; i < sectionSplit.length; i += 2) {
      const header = sectionSplit[i].trim().toLowerCase();
      const content = sectionSplit[i + 1] || '';

      if (header === '1' || header === 'i' || header.includes('1') || header.includes('i')) {
        parsePart1Text(content, result);
      } else if (header === '2' || header === 'ii' || header.includes('2') || header.includes('ii')) {
        parsePart2Text(content, result);
      } else if (header === '3' || header === 'iii' || header.includes('3') || header.includes('iii')) {
        parsePart3Text(content, result);
      }
    }
  } else {
    // Single unified text: Try multi-pass parsing
    // 1. Part 2 patterns (like 1a: Đ, 1b: S, 1c: Đ, 1d: S or Câu 1: a-Đ, b-S...)
    parsePart2Text(cleanText, result);

    // 2. Part 3 patterns (like P3_1: 15, Phần 3: Câu 1 = 12.5)
    // Or if lines start with "Câu [1-6]: [number/value]" after Part 1
    parsePart3Text(cleanText, result);

    // 3. Part 1 patterns (like 1.A 2.B 3.C or 1A 2B 3C or Câu 1: A)
    parsePart1Text(cleanText, result);
  }

  // Update counts
  result.p1Count = Object.keys(result.p1).length;
  result.p2Count = Object.keys(result.p2).length;
  result.p3Count = Object.keys(result.p3).length;

  return result;
}

/**
 * Parse Part 1 (Single Choice A, B, C, D)
 */
function parsePart1Text(text: string, result: ParsedAnswersResult) {
  // Pattern 1: "1.A", "1: A", "Câu 1: A", "Câu 1. A", "1 - A", "1A"
  const regex1 = /(?:câu|cau|c)?\s*(\d+)[\s.:\-=–—)]*([A-Da-d])(?![a-zA-Z0-9_])/gi;
  let match;
  while ((match = regex1.exec(text)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ans = normalizeChoice(match[2]);
    if (qNum > 0 && ans && !result.p1[qNum]) {
      result.p1[qNum] = ans;
    }
  }

  // If no numbered matches found, check if it's a sequence of letters like "A B C D A B C D" or "ABCD..."
  if (Object.keys(result.p1).length === 0) {
    const letterTokens = text.trim().split(/[\s,;|]+/);
    const validLetters = letterTokens.filter((t) => /^[A-D]$/i.test(t));
    if (validLetters.length >= 3) {
      validLetters.forEach((letter, idx) => {
        const choice = normalizeChoice(letter);
        if (choice) {
          result.p1[idx + 1] = choice;
        }
      });
    } else {
      // Check compact string like "ABCDABCD" (no spaces)
      const compact = text.replace(/[^A-Za-z]/g, '').toUpperCase();
      if (/^[ABCD]{4,}$/.test(compact)) {
        for (let i = 0; i < compact.length; i++) {
          result.p1[i + 1] = compact[i] as 'A' | 'B' | 'C' | 'D';
        }
      }
    }
  }
}

/**
 * Parse Part 2 (True/False - 4 sub-items a, b, c, d)
 */
function parsePart2Text(text: string, result: ParsedAnswersResult) {
  // Pattern 1: "Câu 1: a-Đ, b-S, c-Đ, d-S" or "1. a.Đ b.S c.Đ d.S"
  // or "1a: Đ, 1b: S, 1c: Đ, 1d: S"
  const regexSub = /(?:câu|cau|c)?\s*(\d+)[\s.:\-_]*([a-d])[\s.:\-=–—)]*([ĐđSsTtFfDd]|dung|sai|true|false)\b/gi;
  let match;
  while ((match = regexSub.exec(text)) !== null) {
    const qNum = parseInt(match[1], 10);
    const sub = match[2].toLowerCase() as 'a' | 'b' | 'c' | 'd';
    const tf = normalizeTrueFalse(match[3]);
    if (qNum > 0 && tf) {
      if (!result.p2[qNum]) {
        result.p2[qNum] = {} as any;
      }
      result.p2[qNum][sub] = tf;
    }
  }

  // Pattern 2: "Câu 1: Đ S Đ S" or "1: Đ, S, Đ, S"
  const regexGroup = /(?:câu|cau|c)?\s*(\d+)[\s.:\-=–—)]+([ĐđSsTtFfDd])[\s,;]+([ĐđSsTtFfDd])[\s,;]+([ĐđSsTtFfDd])[\s,;]+([ĐđSsTtFfDd])/gi;
  while ((match = regexGroup.exec(text)) !== null) {
    const qNum = parseInt(match[1], 10);
    const a = normalizeTrueFalse(match[2]);
    const b = normalizeTrueFalse(match[3]);
    const c = normalizeTrueFalse(match[4]);
    const d = normalizeTrueFalse(match[5]);
    if (qNum > 0 && a && b && c && d) {
      result.p2[qNum] = { a, b, c, d };
    }
  }

  // Pattern 3: Sub-items without question number prefix on individual lines within Part II
  const lines = text.split('\n');
  let currentQNum = 0;
  for (const line of lines) {
    const qHeaderMatch = line.match(/(?:câu|cau|c)\s*(\d+)/i);
    if (qHeaderMatch) {
      currentQNum = parseInt(qHeaderMatch[1], 10);
    }
    if (currentQNum > 0) {
      const subMatches = line.matchAll(/([a-d])[\s.:\-=–—)]*([ĐđSsTtFfDd]|dung|sai|true|false)\b/gi);
      for (const sm of subMatches) {
        const sub = sm[1].toLowerCase() as 'a' | 'b' | 'c' | 'd';
        const tf = normalizeTrueFalse(sm[2]);
        if (tf) {
          if (!result.p2[currentQNum]) {
            result.p2[currentQNum] = {} as any;
          }
          result.p2[currentQNum][sub] = tf;
        }
      }
    }
  }
}

/**
 * Parse Part 3 (Short Answers / Numbers)
 */
function parsePart3Text(text: string, result: ParsedAnswersResult) {
  // Look for lines like "Câu 1: 15.5", "1: 2024", "1. -3/4", "câu 1 = 100"
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(?:câu|cau|c)?\s*(\d+)[\s.:\-=–—)]+\s*([^\s;,\n\r]+)/i);
    if (match) {
      const qNum = parseInt(match[1], 10);
      const val = match[2].trim();
      // Only treat as Part 3 if it's not a single A/B/C/D or Đ/S (unless explicitly in Part 3 context)
      if (qNum > 0 && val && !result.p3[qNum]) {
        // If not already in P1 as single letter, or if val contains numbers / arithmetic symbols
        if (/[0-9.,\-/]/.test(val) || val.length > 1) {
          result.p3[qNum] = val;
        }
      }
    }
  }
}

/**
 * Parse Excel file (.xlsx, .xls, .csv)
 */
export async function parseAnswersFromExcel(file: File): Promise<ParsedAnswersResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  const result: ParsedAnswersResult = {
    p1: {},
    p2: {},
    p3: {},
    p1Count: 0,
    p2Count: 0,
    p3Count: 0,
    rawLogs: [],
  };

  // Iterate over sheets or check sheet names
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rows || rows.length === 0) continue;

    // Check if sheet contains textual data or structured columns
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] || '').trim().toLowerCase();
      const secondCell = String(row[1] || '').trim();

      // Check Part 1 columns: [Câu, Đáp án] -> e.g. [1, "A"]
      const qNumMatch = firstCell.match(/^(?:câu\s*|cau\s*|c)?(\d+)$/);
      if (qNumMatch) {
        const qNum = parseInt(qNumMatch[1], 10);

        // Check if row has a, b, c, d columns for Part 2 (e.g., [1, "Đ", "S", "Đ", "S"])
        if (row.length >= 5) {
          const a = normalizeTrueFalse(String(row[1]));
          const b = normalizeTrueFalse(String(row[2]));
          const c = normalizeTrueFalse(String(row[3]));
          const d = normalizeTrueFalse(String(row[4]));
          if (a && b && c && d) {
            result.p2[qNum] = { a, b, c, d };
            continue;
          }
        }

        // Check Part 1: e.g. [1, "A"]
        const choice = normalizeChoice(secondCell);
        if (choice) {
          result.p1[qNum] = choice;
          continue;
        }

        // Check Part 3: e.g. [1, "15.5"]
        if (secondCell && secondCell.length > 0 && !normalizeTrueFalse(secondCell)) {
          result.p3[qNum] = secondCell;
          continue;
        }
      }

      // Check 3-column format: [Phần, Câu, Đáp án] -> e.g. ["Phần 1", 1, "A"] or ["P1", 1, "A"]
      if (row.length >= 3) {
        const partTag = firstCell;
        const qVal = parseInt(String(row[1]).replace(/\D/g, ''), 10);
        const ansVal = String(row[2]).trim();

        if (qVal > 0) {
          if (partTag.includes('1') || partTag.includes('p1') || partTag.includes('i')) {
            const c = normalizeChoice(ansVal);
            if (c) result.p1[qVal] = c;
          } else if (partTag.includes('2') || partTag.includes('p2') || partTag.includes('ii')) {
            if (row.length >= 6) {
              const a = normalizeTrueFalse(String(row[2]));
              const b = normalizeTrueFalse(String(row[3]));
              const c = normalizeTrueFalse(String(row[4]));
              const d = normalizeTrueFalse(String(row[5]));
              if (a && b && c && d) result.p2[qVal] = { a, b, c, d };
            }
          } else if (partTag.includes('3') || partTag.includes('p3') || partTag.includes('iii')) {
            if (ansVal) result.p3[qVal] = ansVal;
          }
        }
      }
    }

    // Also fallback parse entire sheet as raw text if structured detection got too few
    if (Object.keys(result.p1).length === 0 && Object.keys(result.p2).length === 0) {
      const sheetText = rows.map((r) => r.join(' ')).join('\n');
      const fallbackResult = parseAnswersFromText(sheetText);
      if (fallbackResult.p1Count > 0) result.p1 = fallbackResult.p1;
      if (fallbackResult.p2Count > 0) result.p2 = fallbackResult.p2;
      if (fallbackResult.p3Count > 0) result.p3 = fallbackResult.p3;
    }
  }

  result.p1Count = Object.keys(result.p1).length;
  result.p2Count = Object.keys(result.p2).length;
  result.p3Count = Object.keys(result.p3).length;

  return result;
}

/**
 * Parse Word document (.docx) or Text file (.txt)
 */
export async function parseAnswersFromWordOrText(file: File): Promise<ParsedAnswersResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const mammothResult = await mammoth.extractRawText({ arrayBuffer });
    return parseAnswersFromText(mammothResult.value);
  } else {
    // .txt or .csv
    const text = await file.text();
    return parseAnswersFromText(text);
  }
}

/**
 * Universal File Parser: handles .xlsx, .xls, .csv, .docx, .txt
 */
export async function parseAnswersFromFile(file: File): Promise<ParsedAnswersResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseAnswersFromExcel(file);
  } else if (name.endsWith('.docx') || name.endsWith('.txt') || name.endsWith('.csv')) {
    return parseAnswersFromWordOrText(file);
  } else {
    // Try text as default
    const text = await file.text();
    return parseAnswersFromText(text);
  }
}

/**
 * Generates and downloads a standard sample Excel template
 */
export function downloadSampleExcelTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Phan 1 (Trắc nghiệm 12 câu)
  const dataP1 = [
    { 'Câu': 1, 'Đáp Án (A/B/C/D)': 'A' },
    { 'Câu': 2, 'Đáp Án (A/B/C/D)': 'B' },
    { 'Câu': 3, 'Đáp Án (A/B/C/D)': 'C' },
    { 'Câu': 4, 'Đáp Án (A/B/C/D)': 'D' },
    { 'Câu': 5, 'Đáp Án (A/B/C/D)': 'A' },
    { 'Câu': 6, 'Đáp Án (A/B/C/D)': 'B' },
    { 'Câu': 7, 'Đáp Án (A/B/C/D)': 'C' },
    { 'Câu': 8, 'Đáp Án (A/B/C/D)': 'D' },
    { 'Câu': 9, 'Đáp Án (A/B/C/D)': 'A' },
    { 'Câu': 10, 'Đáp Án (A/B/C/D)': 'B' },
    { 'Câu': 11, 'Đáp Án (A/B/C/D)': 'C' },
    { 'Câu': 12, 'Đáp Án (A/B/C/D)': 'D' },
  ];
  const ws1 = XLSX.utils.json_to_sheet(dataP1);
  XLSX.utils.book_append_sheet(wb, ws1, 'Phan_I_TracNghiem');

  // Sheet 2: Phan 2 (Đúng / Sai 4 câu)
  const dataP2 = [
    { 'Câu': 1, 'Ý a (Đ/S)': 'Đ', 'Ý b (Đ/S)': 'S', 'Ý c (Đ/S)': 'Đ', 'Ý d (Đ/S)': 'S' },
    { 'Câu': 2, 'Ý a (Đ/S)': 'S', 'Ý b (Đ/S)': 'Đ', 'Ý c (Đ/S)': 'S', 'Ý d (Đ/S)': 'Đ' },
    { 'Câu': 3, 'Ý a (Đ/S)': 'Đ', 'Ý b (Đ/S)': 'Đ', 'Ý c (Đ/S)': 'S', 'Ý d (Đ/S)': 'S' },
    { 'Câu': 4, 'Ý a (Đ/S)': 'S', 'Ý b (Đ/S)': 'S', 'Ý c (Đ/S)': 'Đ', 'Ý d (Đ/S)': 'Đ' },
  ];
  const ws2 = XLSX.utils.json_to_sheet(dataP2);
  XLSX.utils.book_append_sheet(wb, ws2, 'Phan_II_DungSai');

  // Sheet 3: Phan 3 (Điền ngắn 6 câu)
  const dataP3 = [
    { 'Câu': 1, 'Đáp Số / Kết Quả': '15' },
    { 'Câu': 2, 'Đáp Số / Kết Quả': '-3.5' },
    { 'Câu': 3, 'Đáp Số / Kết Quả': '2024' },
    { 'Câu': 4, 'Đáp Số / Kết Quả': '1/2' },
    { 'Câu': 5, 'Đáp Số / Kết Quả': '45' },
    { 'Câu': 6, 'Đáp Số / Kết Quả': '100' },
  ];
  const ws3 = XLSX.utils.json_to_sheet(dataP3);
  XLSX.utils.book_append_sheet(wb, ws3, 'Phan_III_TraLoiNgan');

  XLSX.writeFile(wb, 'Mau_Nap_Dap_An_De_Thi.xlsx');
}

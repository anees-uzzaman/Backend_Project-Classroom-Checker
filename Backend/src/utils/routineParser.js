const xlsx = require('xlsx');

const DAY_REGEX = /^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)$/i;
const DAY_PREFIX_REGEX = /^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)/i;

function capitalizeDay(day) {
  const clean = String(day || '').trim();
  if (!clean) return 'Saturday';
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

/**
 * Extracts teacher initials -> full name map from supporting sheets if present.
 */
function extractFacultyNamesFromWorkbook(workbook) {
  const facultyNames = {};

  // 1. Check 'Faculty List Information and Co' (or any sheet containing 'Faculty List')
  const facSheetName = workbook.SheetNames.find(n => /faculty list/i.test(n));
  if (facSheetName) {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[facSheetName], { header: 1, defval: '' });
    let initialCol = -1;
    let nameCol = -1;

    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim().toLowerCase();
        if (val === 'initial' || val === 'initials' || val === 'code') initialCol = c;
        if (val === 'name' || val === 'faculty name') nameCol = c;
      }
      if (initialCol !== -1 && nameCol !== -1) {
        for (let k = r + 1; k < rows.length; k++) {
          const dataRow = rows[k] || [];
          const init = String(dataRow[initialCol] || '').trim().toUpperCase();
          const name = String(dataRow[nameCol] || '').trim();
          if (init && name) {
            facultyNames[init] = name;
          }
        }
        break;
      }
    }
  }

  // 2. Check 'Routine_Data' sheet for Initial / Faculty Name columns
  if (workbook.Sheets['Routine_Data']) {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets['Routine_Data'], { header: 1, defval: '' });
    if (rows.length > 0) {
      const header = rows[0] || [];
      const initCol = header.findIndex(h => /^initial$/i.test(String(h || '').trim()));
      const nameCol = header.findIndex(h => /^faculty name$/i.test(String(h || '').trim()));
      if (initCol !== -1 && nameCol !== -1) {
        for (let r = 1; r < rows.length; r++) {
          const init = String((rows[r] || [])[initCol] || '').trim().toUpperCase();
          const name = String((rows[r] || [])[nameCol] || '').trim();
          if (init && name && !facultyNames[init]) {
            facultyNames[init] = name;
          }
        }
      }
    }
  }

  return facultyNames;
}

/**
 * Extracts room details from 'Room Allocation' sheet and discovered entries.
 */
function extractRoomDetailsFromWorkbook(workbook, entries) {
  const roomDetails = {};

  const allocSheetName = workbook.SheetNames.find(n => /room allocation/i.test(n));
  if (allocSheetName) {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[allocSheetName], { header: 1, defval: '' });
    if (rows.length > 1) {
      const header = rows[0].map(h => String(h || '').trim().toLowerCase());
      const typeCol = header.findIndex(h => h.includes('type'));
      const roomCol = header.findIndex(h => h.includes('room'));
      const capCol = header.findIndex(h => h.includes('student') || h.includes('cap'));

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const room = String(row[roomCol !== -1 ? roomCol : 1] || '').trim();
        if (!room) continue;
        const typeStr = String(row[typeCol !== -1 ? typeCol : 0] || '').trim().toLowerCase();
        const capNum = parseInt(row[capCol !== -1 ? capCol : 2], 10);
        const isLab = typeStr.includes('lab');
        roomDetails[room] = {
          capacity: Number.isFinite(capNum) && capNum > 0 ? capNum : (isLab ? 20 : 40),
          ac: true,
          projector: true,
          lab: isLab
        };
      }
    }
  }

  // Ensure every room appearing in entries has an entry in roomDetails
  for (const entry of entries) {
    const rm = String(entry.room || '').trim();
    if (!rm || /^tba$/i.test(rm)) continue;
    if (/^online$/i.test(rm)) {
      if (!roomDetails['Online']) {
        roomDetails['Online'] = { capacity: 1000, ac: false, projector: false, lab: false };
      }
      continue;
    }
    if (!roomDetails[rm]) {
      const looksLikeLab = Boolean(entry.isLab) || /L$/i.test(rm);
      roomDetails[rm] = {
        capacity: looksLikeLab ? 25 : 40,
        ac: true,
        projector: true,
        lab: looksLikeLab
      };
    }
  }

  return roomDetails;
}

/**
 * Checks whether a worksheet uses the multi-day horizontal matrix layout
 * (Day header -> Time slots -> Course/Faculty/Room triplets).
 */
function isMatrixRoutineSheet(sheet) {
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  let hasDayHeader = false;
  let hasCourseFacultyRoom = false;

  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const row = rows[r] || [];
    if (row.some(v => DAY_REGEX.test(String(v || '').trim()))) {
      hasDayHeader = true;
    }
    const lowerCells = row.map(v => String(v || '').trim().toLowerCase());
    if (lowerCells.includes('course') && lowerCells.includes('faculty') && lowerCells.includes('room')) {
      hasCourseFacultyRoom = true;
    }
  }

  return hasDayHeader && hasCourseFacultyRoom;
}

/**
 * Parses the matrix timetable sheet (e.g. 'Routine' in Documents_Summer 2026 CSE & CSIT.xlsx).
 */
function parseMatrixRoutineSheet(sheet, facultyNames = {}) {
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const merges = sheet['!merges'] || [];
  const mergeMap = new Map();
  for (const m of merges) {
    mergeMap.set(`${m.s.r},${m.s.c}`, m);
  }

  const entries = [];
  let r = 0;

  while (r < rows.length) {
    const row = rows[r] || [];

    // Locate Day header row (check first few columns)
    let foundDay = '';
    for (let c = 0; c <= 3; c++) {
      const val = String(row[c] || '').trim();
      if (DAY_REGEX.test(val)) {
        foundDay = capitalizeDay(val);
        break;
      }
    }

    if (!foundDay) {
      r++;
      continue;
    }

    // Locate Time Slot header row and Course/Faculty/Room header row
    let timeRowIdx = -1;
    let subHeaderIdx = -1;
    for (let k = r + 1; k <= Math.min(r + 4, rows.length - 1); k++) {
      const candidate = rows[k] || [];
      const rowText = candidate.map(v => String(v || '').trim()).join('|');
      if (timeRowIdx === -1 && /\d{1,2}[\.:]\d{2}.*[-–].*\d{1,2}[\.:]\d{2}/.test(rowText)) {
        timeRowIdx = k;
      }
      if (subHeaderIdx === -1 && candidate.some(v => /^course$/i.test(String(v || '').trim()))) {
        subHeaderIdx = k;
      }
    }

    if (timeRowIdx === -1 || subHeaderIdx === -1) {
      r++;
      continue;
    }

    const timeRow = rows[timeRowIdx] || [];
    const subRow = rows[subHeaderIdx] || [];

    // Build time slot triplets
    const slots = [];
    for (let col = 1; col < subRow.length; col++) {
      if (/^course$/i.test(String(subRow[col] || '').trim())) {
        let timeLabel = String(timeRow[col] || '').trim();
        if (!timeLabel) {
          for (let back = col - 1; back >= Math.max(1, col - 2); back--) {
            if (String(timeRow[back] || '').trim()) {
              timeLabel = String(timeRow[back]).trim();
              break;
            }
          }
        }
        if (timeLabel) {
          slots.push({ col, time: timeLabel });
        }
      }
    }

    let emptyStreak = 0;
    let curr = subHeaderIdx + 1;

    while (curr < rows.length) {
      const sRow = rows[curr] || [];
      const c0 = String(sRow[0] || '').trim();
      const c1 = String(sRow[1] || '').trim();

      if (DAY_REGEX.test(c1) || DAY_REGEX.test(c0)) {
        break;
      }

      if (!c0 && sRow.every(v => String(v || '').trim() === '')) {
        emptyStreak++;
        if (emptyStreak >= 3) break;
        curr++;
        continue;
      }
      emptyStreak = 0;

      if (!c0) {
        curr++;
        continue;
      }

      for (let sIdx = 0; sIdx < slots.length; sIdx++) {
        const slot = slots[sIdx];
        const col = slot.col;
        const rawA = String(sRow[col] || '').trim();
        const rawB = String(sRow[col + 1] || '').trim();
        const rawC = String(sRow[col + 2] || '').trim();

        if (!rawA && !rawB && !rawC) continue;

        const m = mergeMap.get(`${curr},${col}`);
        const colSpan = m ? (m.e.c - m.s.c + 1) : 1;
        const rowSpan = m ? (m.e.r - m.s.r + 1) : 1;

        // If vertically merged across I & II (rowSpan >= 2), strip group suffix so "5B - I" becomes "5B"
        let section = c0;
        const groupMatch = c0.match(/^(.+?)\s*-\s*(I|II)$/i);
        if (groupMatch && rowSpan >= 2) {
          section = groupMatch[1].trim();
        }
        section = section.toUpperCase();

        let course = '';
        let faculty = '';
        let room = '';
        let isLab = Boolean(groupMatch && rowSpan < 2);

        if (rawA.includes('\n')) {
          const lines = rawA.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
          course = lines[0] || c0;
          faculty = lines[1] || 'TBA';
          room = lines[2] || 'TBA';
          isLab = true;
        } else {
          course = rawA || c0;
          faculty = rawB || 'TBA';
          room = rawC || 'TBA';
        }

        course = course.toUpperCase();
        faculty = faculty.toUpperCase();
        if (!room) room = 'TBA';

        // Handle multi-slot horizontal merges (e.g. 2-slot lab spanning 6 columns)
        const slotsCovered = Math.max(1, Math.round(colSpan / 3));
        for (let offset = 0; offset < slotsCovered; offset++) {
          const targetSlot = slots[sIdx + offset];
          if (!targetSlot) break;
          entries.push({
            day: foundDay,
            time: targetSlot.time,
            section,
            course,
            faculty,
            facultyName: facultyNames[faculty] || '',
            room,
            isLab
          });
        }
      }

      curr++;
    }

    r = curr;
  }

  return entries;
}

/**
 * Fallback normalizer for standard flat tabular rows.
 */
function normalizeRoutineRow(row, defaultDay = 'Saturday', facultyNames = {}) {
  const getField = (candidates) => {
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const candidate of candidates) {
        if (cleanKey === candidate.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          const val = String(row[key]).trim();
          if (val) return val;
        }
      }
    }
    return '';
  };

  const day = getField(['day', 'weekday', 'dayofweek']) || defaultDay;
  const section = getField(['section', 'sec', 'batch']);
  const time = getField(['time', 'timeslot', 'slot', 'period', 'hour']);
  const course = getField(['course', 'coursecode', 'subject', 'class']);
  const faculty = getField(['faculty', 'facultyinitial', 'teacher', 'instructor', 'initials']) || 'TBA';
  const room = getField(['room', 'roomno', 'classroom', 'hall']);

  if (!section || !time || !course || !room) {
    return null;
  }

  const cleanFac = faculty.trim().toUpperCase();

  return {
    day: capitalizeDay(day),
    section: section.trim().toUpperCase(),
    time: time.trim(),
    course: course.trim().toUpperCase(),
    faculty: cleanFac,
    facultyName: facultyNames[cleanFac] || '',
    room: room.trim(),
    isLab: false
  };
}

/**
 * Parses an Excel/CSV buffer, supporting both matrix timetable sheets and flat tables.
 */
function parseRoutineFromExcel(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const facultyNames = extractFacultyNamesFromWorkbook(workbook);
  let entries = [];

  // Prefer the primary 'Routine' matrix sheet if present
  const matrixSheetName =
    (workbook.Sheets['Routine'] && isMatrixRoutineSheet(workbook.Sheets['Routine']) && 'Routine') ||
    workbook.SheetNames.find(name => isMatrixRoutineSheet(workbook.Sheets[name]));

  if (matrixSheetName) {
    entries = parseMatrixRoutineSheet(workbook.Sheets[matrixSheetName], facultyNames);
  } else {
    // Fallback to flat tabular parsing across sheets
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
      const dayMatch = sheetName.match(DAY_PREFIX_REGEX);
      const defaultDay = dayMatch ? capitalizeDay(dayMatch[1]) : 'Saturday';

      for (const row of rows) {
        const entry = normalizeRoutineRow(row, defaultDay, facultyNames);
        if (entry) {
          entries.push(entry);
        }
      }
    }
  }

  const roomDetails = extractRoomDetailsFromWorkbook(workbook, entries);
  return { entries, roomDetails, facultyNames };
}

/**
 * Parses routine entries from extracted PDF text.
 */
function parseRoutineFromText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results = [];
  let currentDay = 'Saturday';

  const timeRegex = /(\d{1,2}[\.:]\d{2}(?:\s*[AaPp][Mm])?\s*[-–]\s*\d{1,2}[\.:]\d{2}(?:\s*[AaPp][Mm])?)/;

  for (const line of lines) {
    const dayMatch = line.match(DAY_PREFIX_REGEX);
    if (dayMatch) {
      currentDay = capitalizeDay(dayMatch[1]);
    }

    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      const timeSlot = timeMatch[1].trim();
      const remaining = line.replace(timeSlot, ' ').trim();
      const parts = remaining.split(/[\t,|;]+|\s{2,}/).map(p => p.trim()).filter(Boolean);
      const tokens = parts.length >= 3 ? parts : remaining.split(/\s+/).filter(Boolean);
      const filteredTokens = tokens.filter(t => !t.match(DAY_PREFIX_REGEX));

      if (filteredTokens.length >= 3) {
        const section = filteredTokens[0];
        const course = filteredTokens[1];
        const faculty = filteredTokens.length >= 4 ? filteredTokens[2] : 'TBA';
        const room = filteredTokens[filteredTokens.length - 1];

        results.push({
          day: currentDay,
          section: section.trim().toUpperCase(),
          time: timeSlot,
          course: course.trim().toUpperCase(),
          faculty: faculty.trim().toUpperCase(),
          facultyName: '',
          room: room.trim(),
          isLab: false
        });
      }
    }
  }

  return results;
}

module.exports = {
  parseRoutineFromExcel,
  parseRoutineFromText,
  extractFacultyNamesFromWorkbook,
  extractRoomDetailsFromWorkbook,
  parseMatrixRoutineSheet
};

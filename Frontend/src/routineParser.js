import * as xlsx from 'xlsx';

const DAY_REGEX = /^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)$/i;
const DAY_PREFIX_REGEX = /^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)/i;

export const ACADEMIC_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

export const TIME_SLOTS = [
  '8.30 AM - 9.50 AM',
  '10.00 AM - 11.20 AM',
  '11.30 AM - 12.50 PM',
  '1.00 PM - 2.20 PM',
  '2.30 PM - 3.50 PM',
  '4.00 PM - 5.20 PM'
];

const DAY_ORDER = {
  saturday: 1,
  sunday: 2,
  monday: 3,
  tuesday: 4,
  wednesday: 5,
  thursday: 6,
  friday: 7
};

export function parseTimeSlotStart(timeStr) {
  const m = String(timeStr || '').match(/(\d{1,2})[\.:](\d{2})\s*([AaPp][Mm])?/);
  if (!m) return 0;
  let hour = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3] ? m[3].toUpperCase() : '';
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour * 60 + min;
}

export function sortRoutineEntries(entries) {
  return [...entries].sort((a, b) => {
    const dayA = DAY_ORDER[(a.day || '').toLowerCase()] || 99;
    const dayB = DAY_ORDER[(b.day || '').toLowerCase()] || 99;
    if (dayA !== dayB) return dayA - dayB;
    return parseTimeSlotStart(a.time) - parseTimeSlotStart(b.time);
  });
}

export function normalizeRoomKey(room) {
  return String(room || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

function capitalizeDay(day) {
  const clean = String(day || '').trim();
  if (!clean) return 'Saturday';
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

/**
 * Matches a student's section (e.g. "5B" or "5B - I") against a routine entry's section.
 * - "5B" matches "5B", "5B - I", and "5B - II"
 * - "5B - I" matches "5B" (shared theory) and "5B - I" (group I lab)
 */
export function matchesStudentSection(entrySection, studentSection) {
  const e = String(entrySection || '').trim().toUpperCase();
  const s = String(studentSection || '').trim().toUpperCase();
  if (!e || !s) return false;
  if (e === s) return true;
  if (!s.includes('-')) {
    return e.startsWith(`${s} -`) || e.startsWith(`${s}-`);
  }
  const base = s.split('-')[0].trim();
  return e === base;
}

export function extractFacultyNamesFromWorkbook(workbook) {
  const facultyNames = {};

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

export function extractRoomDetailsFromWorkbook(workbook, entries) {
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

function normalizeFlatRow(row, defaultDay = 'Saturday', facultyNames = {}) {
  const getField = (candidates) => {
    for (const key of Object.keys(row)) {
      const clean = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const c of candidates) {
        if (clean === c.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          const v = String(row[key]).trim();
          if (v) return v;
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

  if (!section || !time || !course || !room) return null;

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

export function parseRoutineWorkbook(arrayBuffer) {
  const workbook = xlsx.read(arrayBuffer, { type: 'array' });
  const facultyNames = extractFacultyNamesFromWorkbook(workbook);
  let entries = [];

  const matrixSheetName =
    (workbook.Sheets['Routine'] && isMatrixRoutineSheet(workbook.Sheets['Routine']) && 'Routine') ||
    workbook.SheetNames.find(name => isMatrixRoutineSheet(workbook.Sheets[name]));

  if (matrixSheetName) {
    entries = parseMatrixRoutineSheet(workbook.Sheets[matrixSheetName], facultyNames);
  } else {
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
      const dayMatch = sheetName.match(DAY_PREFIX_REGEX);
      const defaultDay = dayMatch ? capitalizeDay(dayMatch[1]) : 'Saturday';

      for (const r of rawRows) {
        const normalized = normalizeFlatRow(r, defaultDay, facultyNames);
        if (normalized) entries.push(normalized);
      }
    }
  }

  const roomDetails = extractRoomDetailsFromWorkbook(workbook, entries);
  return { entries, roomDetails, facultyNames };
}

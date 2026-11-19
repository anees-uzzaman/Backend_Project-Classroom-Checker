const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { PDFParse } = require('pdf-parse');
const Routine = require('../../models/Routine');
const RoomDetail = require('../../models/RoomDetail');
const { authenticateToken, optionalAuthenticateToken, requireTeacher } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Helper: Normalize key names for flexible column matching in Excel/CSV
function normalizeRoutineRow(row, defaultDay = 'Saturday') {
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
  const faculty = getField(['faculty', 'teacher', 'instructor', 'initials']) || 'TBA';
  const room = getField(['room', 'roomno', 'classroom', 'hall']);

  if (!section || !time || !course || !room) {
    return null;
  }

  // Capitalize Day
  const cleanDay = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();

  return {
    day: cleanDay,
    section: section.trim().toUpperCase(),
    time: time.trim(),
    course: course.trim().toUpperCase(),
    faculty: faculty.trim().toUpperCase(),
    room: room.trim()
  };
}

// Helper: Parse routine from Excel/CSV buffer
function parseRoutineFromExcel(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const allEntries = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const dayMatch = sheetName.match(/^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)/i);
    const defaultDay = dayMatch ? dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1).toLowerCase() : 'Saturday';

    for (const row of rows) {
      const entry = normalizeRoutineRow(row, defaultDay);
      if (entry) {
        allEntries.push(entry);
      }
    }
  }

  return allEntries;
}

// Helper: Parse routine from extracted PDF text
function parseRoutineFromText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results = [];
  let currentDay = 'Saturday';

  const daysRegex = /^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)/i;
  const timeRegex = /(\d{1,2}[\.:]\d{2}(?:\s*[AaPp][Mm])?\s*[-–]\s*\d{1,2}[\.:]\d{2}(?:\s*[AaPp][Mm])?)/;

  for (const line of lines) {
    const dayMatch = line.match(daysRegex);
    if (dayMatch) {
      currentDay = dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1).toLowerCase();
    }

    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      const timeSlot = timeMatch[1].trim();
      const remaining = line.replace(timeSlot, ' ').trim();
      const parts = remaining.split(/[\t,|;]+|\s{2,}/).map(p => p.trim()).filter(Boolean);
      const tokens = parts.length >= 3 ? parts : remaining.split(/\s+/).filter(Boolean);
      const filteredTokens = tokens.filter(t => !t.match(daysRegex));

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
          room: room.trim()
        });
      }
    }
  }

  return results;
}

// GET /api/routine - Supports optional query filters: ?section=5B&faculty=SDS&day=Saturday
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.section) {
      filter.section = req.query.section.trim().toUpperCase();
    }
    if (req.query.faculty) {
      filter.faculty = req.query.faculty.trim().toUpperCase();
    }
    if (req.query.day) {
      filter.day = req.query.day.trim();
    }
    if (req.query.room) {
      filter.room = req.query.room.trim();
    }

    const routine = await Routine.find(filter).sort({ day: 1, time: 1, section: 1 });
    res.status(200).json({ routine });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching routine.' });
  }
});

// GET /api/routine/meta - Returns available sections, faculties, and days for filters
router.get('/meta', async (req, res) => {
  try {
    const sections = await Routine.distinct('section');
    const faculties = await Routine.distinct('faculty');
    const rooms = await Routine.distinct('room');
    const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

    res.status(200).json({
      sections: sections.filter(Boolean).sort(),
      faculties: faculties.filter(Boolean).sort(),
      rooms: rooms.filter(Boolean).sort(),
      days
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching routine metadata.' });
  }
});

// POST /api/routine/upload-file - Upload and parse Excel (.xlsx, .xls, .csv) or PDF (.pdf)
router.post('/upload-file', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (req.user.designation !== 'Admin' && req.user.designation !== 'Teacher') {
      return res.status(403).json({ message: 'Access denied. Administrative role required.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Please provide an Excel or PDF file.' });
    }

    const filename = req.file.originalname.toLowerCase();
    const mode = req.body.mode || 'replace'; // 'replace' or 'append'
    const dryRun = req.body.dryRun === 'true' || req.body.dryRun === true;
    let parsedEntries = [];

    if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv')) {
      parsedEntries = parseRoutineFromExcel(req.file.buffer);
    } else if (filename.endsWith('.pdf')) {
      const parser = new PDFParse({ data: req.file.buffer });
      const pdfText = await parser.getText();
      parsedEntries = parseRoutineFromText(pdfText.text || '');
    } else {
      return res.status(400).json({
        message: 'Unsupported file format. Please upload an Excel (.xlsx, .xls, .csv) or PDF (.pdf) file.'
      });
    }

    if (parsedEntries.length === 0) {
      return res.status(422).json({
        message: 'Could not extract valid routine entries. Please ensure columns include Day, Section, Time, Course, Faculty, and Room.'
      });
    }

    // If dryRun, return parsed preview without saving
    if (dryRun) {
      return res.status(200).json({
        message: `Parsed ${parsedEntries.length} routine entries from ${req.file.originalname}`,
        count: parsedEntries.length,
        entries: parsedEntries
      });
    }

    // Commit to database
    if (mode === 'replace') {
      await Routine.deleteMany({});
    }

    await Routine.insertMany(parsedEntries);

    // Auto-discover any new rooms and add to RoomDetail
    const uniqueRooms = [...new Set(parsedEntries.map(e => e.room))];
    for (const r of uniqueRooms) {
      await RoomDetail.findOneAndUpdate(
        { room: r },
        { $setOnInsert: { room: r, capacity: 40, ac: true, projector: true, lab: false } },
        { upsert: true }
      );
    }

    res.status(200).json({
      message: `Routine updated successfully! ${parsedEntries.length} classes loaded (${mode === 'replace' ? 'Master schedule replaced' : 'Appended to schedule'}).`,
      count: parsedEntries.length,
      mode,
      sample: parsedEntries.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ message: `Failed to process routine file: ${error.message}` });
  }
});

// POST /api/routine/batch-update - Direct batch save of routine items from preview
router.post('/batch-update', authenticateToken, async (req, res) => {
  try {
    if (req.user.designation !== 'Admin' && req.user.designation !== 'Teacher') {
      return res.status(403).json({ message: 'Access denied. Administrative role required.' });
    }

    const { routines, mode = 'replace' } = req.body;
    if (!Array.isArray(routines) || routines.length === 0) {
      return res.status(400).json({ message: 'Valid routine array required.' });
    }

    if (mode === 'replace') {
      await Routine.deleteMany({});
    }

    await Routine.insertMany(routines);

    // Auto-discover rooms
    const uniqueRooms = [...new Set(routines.map(e => e.room))];
    for (const r of uniqueRooms) {
      await RoomDetail.findOneAndUpdate(
        { room: r },
        { $setOnInsert: { room: r, capacity: 40, ac: true, projector: true, lab: false } },
        { upsert: true }
      );
    }

    res.status(200).json({
      message: `Batch update complete. ${routines.length} classes successfully registered.`,
      count: routines.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during batch update.' });
  }
});

// POST /api/routine - Single routine entry addition
router.post('/', optionalAuthenticateToken, async (req, res) => {
  try {
    const { day, section, time, course, faculty, room, capacity, hasAC, hasProjector, isLab } = req.body;

    if (!day || !section || !time || !course || !faculty || !room) {
      return res.status(400).json({ message: 'All routine fields are required.' });
    }

    if (req.user && req.user.designation !== 'Teacher' && req.user.designation !== 'Admin') {
      return res.status(403).json({ message: 'Teacher or Admin privileges required.' });
    }

    const newEntry = new Routine({
      day: day.trim(),
      section: section.trim().toUpperCase(),
      time: time.trim(),
      course: course.trim().toUpperCase(),
      faculty: faculty.trim().toUpperCase(),
      room: room.trim()
    });

    await newEntry.save();

    if (capacity !== undefined) {
      await RoomDetail.findOneAndUpdate(
        { room: room.trim() },
        {
          room: room.trim(),
          capacity: Number(capacity) || 30,
          ac: Boolean(hasAC),
          projector: Boolean(hasProjector),
          lab: Boolean(isLab)
        },
        { upsert: true, new: true }
      );
    }

    res.status(201).json({ routineEntry: newEntry });
  } catch (error) {
    res.status(500).json({ message: 'Server error adding routine entry.' });
  }
});

// GET /api/routine/rooms
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await RoomDetail.find();
    const roomMap = {};
    for (const r of rooms) {
      roomMap[r.room] = {
        capacity: r.capacity,
        ac: r.ac,
        projector: r.projector,
        lab: r.lab
      };
    }
    res.status(200).json({ rooms: roomMap });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching room details.' });
  }
});

// POST /api/routine/seed
router.post('/seed', async (req, res) => {
  try {
    const { routines, roomDetails } = req.body;

    if (Array.isArray(routines) && routines.length > 0) {
      const count = await Routine.countDocuments();
      if (count === 0) {
        await Routine.insertMany(routines);
      }
    }

    if (roomDetails && typeof roomDetails === 'object') {
      const roomCount = await RoomDetail.countDocuments();
      if (roomCount === 0) {
        const roomDocs = Object.keys(roomDetails).map((room) => ({
          room,
          capacity: roomDetails[room].capacity || 30,
          ac: Boolean(roomDetails[room].ac),
          projector: Boolean(roomDetails[room].projector),
          lab: Boolean(roomDetails[room].lab)
        }));
        await RoomDetail.insertMany(roomDocs);
      }
    }

    res.status(200).json({ message: 'Seed completed successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during routine seed.' });
  }
});

module.exports = router;

const express = require('express');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const Routine = require('../../models/Routine');
const RoutineRequest = require('../../models/RoutineRequest');
const RoomDetail = require('../../models/RoomDetail');
const { authenticateToken, requireTeacher, requireAdmin } = require('../middleware/auth');
const { parseRoutineFromExcel, parseRoutineFromText } = require('../utils/routineParser');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function upsertRoomDetailsMap(roomDetails, fallbackEntries = []) {
  if (roomDetails && typeof roomDetails === 'object' && Object.keys(roomDetails).length > 0) {
    for (const [roomName, details] of Object.entries(roomDetails)) {
      if (!roomName || /^tba$/i.test(roomName)) continue;
      await RoomDetail.findOneAndUpdate(
        { room: roomName },
        {
          room: roomName,
          capacity: Number(details.capacity) || 40,
          ac: details.ac !== undefined ? Boolean(details.ac) : true,
          projector: details.projector !== undefined ? Boolean(details.projector) : true,
          lab: Boolean(details.lab)
        },
        { upsert: true, new: true }
      );
    }
    return;
  }

  // Fallback: auto-discover rooms from parsed routine entries
  const uniqueRooms = [...new Set(fallbackEntries.map(e => e.room).filter(r => r && !/^tba$/i.test(r)))];
  for (const r of uniqueRooms) {
    const isOnline = /^online$/i.test(r);
    await RoomDetail.findOneAndUpdate(
      { room: r },
      {
        $setOnInsert: {
          room: r,
          capacity: isOnline ? 1000 : 40,
          ac: !isOnline,
          projector: !isOnline,
          lab: /L$/i.test(r)
        }
      },
      { upsert: true }
    );
  }
}

// GET /api/routine - Supports optional query filters: ?section=5B&faculty=SDS&day=Saturday
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.section) {
      const sec = req.query.section.trim().toUpperCase();
      if (!sec.includes('-')) {
        // Base section like "5B" matches "5B", "5B - I", and "5B - II"
        filter.section = { $regex: new RegExp(`^${escapeRegex(sec)}(\\s*-\\s*(I|II))?$`, 'i') };
      } else {
        // Specific group like "5B - I" matches itself and shared theory "5B"
        const base = sec.split('-')[0].trim();
        filter.section = { $in: [sec, base] };
      }
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
router.post('/upload-file', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Please provide an Excel or PDF file.' });
    }

    const filename = req.file.originalname.toLowerCase();
    const mode = req.body.mode || 'replace'; // 'replace' or 'append'
    const dryRun = req.body.dryRun === 'true' || req.body.dryRun === true;

    let parsedEntries = [];
    let parsedRoomDetails = {};
    let facultyNames = {};

    if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv')) {
      const parsed = parseRoutineFromExcel(req.file.buffer);
      parsedEntries = parsed.entries;
      parsedRoomDetails = parsed.roomDetails;
      facultyNames = parsed.facultyNames;
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
        message: 'Could not extract valid routine entries. Ensure your spreadsheet has a Routine matrix or Day, Section, Time, Course, Faculty, and Room columns.'
      });
    }

    if (dryRun) {
      return res.status(200).json({
        message: `Parsed ${parsedEntries.length} routine entries from ${req.file.originalname}`,
        count: parsedEntries.length,
        entries: parsedEntries,
        roomDetails: parsedRoomDetails,
        facultyNames
      });
    }

    if (mode === 'replace') {
      await Routine.deleteMany({});
    }

    await Routine.insertMany(parsedEntries);
    await upsertRoomDetailsMap(parsedRoomDetails, parsedEntries);

    res.status(200).json({
      message: `Routine updated successfully! ${parsedEntries.length} classes loaded (${mode === 'replace' ? 'Master schedule replaced' : 'Appended to schedule'}).`,
      count: parsedEntries.length,
      mode,
      sample: parsedEntries.slice(0, 5),
      roomDetails: parsedRoomDetails
    });
  } catch (error) {
    res.status(500).json({ message: `Failed to process routine file: ${error.message}` });
  }
});

// POST /api/routine/batch-update - Direct batch save of routine items from preview
router.post('/batch-update', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { routines, roomDetails, mode = 'replace' } = req.body;
    if (!Array.isArray(routines) || routines.length === 0) {
      return res.status(400).json({ message: 'Valid routine array required.' });
    }

    if (mode === 'replace') {
      await Routine.deleteMany({});
    }

    await Routine.insertMany(routines);
    await upsertRoomDetailsMap(roomDetails, routines);

    res.status(200).json({
      message: `Batch update complete. ${routines.length} classes successfully registered.`,
      count: routines.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during batch update.' });
  }
});

async function checkRoutineConflicts({ day, time, section, faculty, room }) {
  if (!/^(online|tba)$/i.test(room)) {
    const roomConflict = await Routine.findOne({ day, time, room });
    if (roomConflict) {
      return `Room ${room} is already occupied by ${roomConflict.course} (Section ${roomConflict.section}) on ${day} at ${time}.`;
    }
  }

  const sectionConflict = await Routine.findOne({ day, time, section });
  if (sectionConflict) {
    return `Section ${section} already has ${sectionConflict.course} scheduled on ${day} at ${time}.`;
  }

  if (!/^(tba|extra)$/i.test(faculty)) {
    const facultyConflict = await Routine.findOne({ day, time, faculty });
    if (facultyConflict) {
      return `Faculty ${faculty} is already teaching ${facultyConflict.course} (Section ${facultyConflict.section}) on ${day} at ${time}.`;
    }
  }

  return null;
}

// GET /api/routine/requests - Admin sees all requests; Teacher sees own requests
router.get('/requests', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const filter = req.user.designation === 'Admin' ? {} : { requestedBy: req.user.userId };
    const requests = await RoutineRequest.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ requests });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching routine requests.' });
  }
});

// POST /api/routine/requests - Teacher submits a routine change for admin approval
router.post('/requests', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { day, section, time, course, faculty, facultyName, room, capacity, hasAC, hasProjector, isLab, note } = req.body;

    if (!day || !section || !time || !course || !faculty || !room) {
      return res.status(400).json({ message: 'All routine fields are required.' });
    }

    const cleanDay = day.trim();
    const cleanSection = section.trim().toUpperCase();
    const cleanTime = time.trim();
    const cleanCourse = course.trim().toUpperCase();
    const cleanFaculty = faculty.trim().toUpperCase();
    const cleanRoom = room.trim();

    const conflictMsg = await checkRoutineConflicts({
      day: cleanDay,
      time: cleanTime,
      section: cleanSection,
      faculty: cleanFaculty,
      room: cleanRoom
    });
    if (conflictMsg) {
      return res.status(409).json({ message: conflictMsg });
    }

    // Prevent duplicate pending request for same slot & room/section
    const pendingDup = await RoutineRequest.findOne({
      status: 'Pending',
      day: cleanDay,
      time: cleanTime,
      $or: [
        { section: cleanSection },
        ...(!/^(online|tba)$/i.test(cleanRoom) ? [{ room: cleanRoom }] : [])
      ]
    });
    if (pendingDup) {
      return res.status(409).json({
        message: `A pending request already exists for ${cleanDay} at ${cleanTime} (Section ${pendingDup.section}, Room ${pendingDup.room}).`
      });
    }

    const newRequest = new RoutineRequest({
      day: cleanDay,
      section: cleanSection,
      time: cleanTime,
      course: cleanCourse,
      faculty: cleanFaculty,
      facultyName: facultyName ? facultyName.trim() : '',
      room: cleanRoom,
      capacity: capacity ? Number(capacity) : 40,
      hasAC: hasAC !== undefined ? Boolean(hasAC) : true,
      hasProjector: hasProjector !== undefined ? Boolean(hasProjector) : true,
      isLab: Boolean(isLab),
      note: note ? String(note).trim() : '',
      requestedBy: req.user.userId,
      requestedByName: req.user.name || req.user.userId,
      status: 'Pending'
    });

    await newRequest.save();
    res.status(201).json({
      message: 'Routine change submitted for admin review.',
      request: newRequest
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error submitting routine request.' });
  }
});

// POST /api/routine/requests/:id/approve - Admin approves submission and adds to master routine
router.post('/requests/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const requestDoc = await RoutineRequest.findById(req.params.id);
    if (!requestDoc) {
      return res.status(404).json({ message: 'Routine request not found.' });
    }
    if (requestDoc.status !== 'Pending') {
      return res.status(400).json({ message: `This request has already been ${requestDoc.status.toLowerCase()}.` });
    }

    const conflictMsg = await checkRoutineConflicts({
      day: requestDoc.day,
      time: requestDoc.time,
      section: requestDoc.section,
      faculty: requestDoc.faculty,
      room: requestDoc.room
    });
    if (conflictMsg) {
      return res.status(409).json({ message: `Cannot approve due to schedule conflict: ${conflictMsg}` });
    }

    const newEntry = new Routine({
      day: requestDoc.day,
      section: requestDoc.section,
      time: requestDoc.time,
      course: requestDoc.course,
      faculty: requestDoc.faculty,
      facultyName: requestDoc.facultyName || '',
      room: requestDoc.room,
      isLab: Boolean(requestDoc.isLab)
    });

    await newEntry.save();

    let updatedRoomDetails = null;
    if (!/^(online|tba)$/i.test(requestDoc.room)) {
      const roomDoc = await RoomDetail.findOneAndUpdate(
        { room: requestDoc.room },
        {
          room: requestDoc.room,
          capacity: Number(requestDoc.capacity) || 40,
          ac: Boolean(requestDoc.hasAC),
          projector: Boolean(requestDoc.hasProjector),
          lab: Boolean(requestDoc.isLab)
        },
        { upsert: true, new: true }
      );
      updatedRoomDetails = {
        room: roomDoc.room,
        details: {
          capacity: roomDoc.capacity,
          ac: roomDoc.ac,
          projector: roomDoc.projector,
          lab: roomDoc.lab
        }
      };
    }

    requestDoc.status = 'Approved';
    requestDoc.reviewedBy = req.user.userId;
    requestDoc.reviewNote = req.body.reviewNote ? String(req.body.reviewNote).trim() : '';
    requestDoc.reviewedAt = new Date();
    await requestDoc.save();

    res.status(200).json({
      message: `Approved ${requestDoc.course} (${requestDoc.day} ${requestDoc.time}) and added to master routine.`,
      request: requestDoc,
      routineEntry: newEntry,
      updatedRoomDetails
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error approving routine request.' });
  }
});

// POST /api/routine/requests/:id/reject - Admin rejects submission
router.post('/requests/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const requestDoc = await RoutineRequest.findById(req.params.id);
    if (!requestDoc) {
      return res.status(404).json({ message: 'Routine request not found.' });
    }
    if (requestDoc.status !== 'Pending') {
      return res.status(400).json({ message: `This request has already been ${requestDoc.status.toLowerCase()}.` });
    }

    requestDoc.status = 'Rejected';
    requestDoc.reviewedBy = req.user.userId;
    requestDoc.reviewNote = req.body.reviewNote ? String(req.body.reviewNote).trim() : 'Rejected by administrator.';
    requestDoc.reviewedAt = new Date();
    await requestDoc.save();

    res.status(200).json({
      message: `Rejected routine request for ${requestDoc.course}.`,
      request: requestDoc
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error rejecting routine request.' });
  }
});

// POST /api/routine - Direct single routine entry addition (ONLY Admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { day, section, time, course, faculty, facultyName, room, capacity, hasAC, hasProjector, isLab } = req.body;

    if (!day || !section || !time || !course || !faculty || !room) {
      return res.status(400).json({ message: 'All routine fields are required.' });
    }

    const cleanDay = day.trim();
    const cleanSection = section.trim().toUpperCase();
    const cleanTime = time.trim();
    const cleanCourse = course.trim().toUpperCase();
    const cleanFaculty = faculty.trim().toUpperCase();
    const cleanRoom = room.trim();

    const conflictMsg = await checkRoutineConflicts({
      day: cleanDay,
      time: cleanTime,
      section: cleanSection,
      faculty: cleanFaculty,
      room: cleanRoom
    });
    if (conflictMsg) {
      return res.status(409).json({ message: conflictMsg });
    }

    const newEntry = new Routine({
      day: cleanDay,
      section: cleanSection,
      time: cleanTime,
      course: cleanCourse,
      faculty: cleanFaculty,
      facultyName: facultyName ? facultyName.trim() : '',
      room: cleanRoom,
      isLab: Boolean(isLab)
    });

    await newEntry.save();

    let updatedRoomDetails = null;
    if (capacity !== undefined && !/^(online|tba)$/i.test(cleanRoom)) {
      const roomDoc = await RoomDetail.findOneAndUpdate(
        { room: cleanRoom },
        {
          room: cleanRoom,
          capacity: Number(capacity) || 30,
          ac: Boolean(hasAC),
          projector: Boolean(hasProjector),
          lab: Boolean(isLab)
        },
        { upsert: true, new: true }
      );
      updatedRoomDetails = {
        capacity: roomDoc.capacity,
        ac: roomDoc.ac,
        projector: roomDoc.projector,
        lab: roomDoc.lab
      };
    }

    res.status(201).json({ routineEntry: newEntry, roomDetails: updatedRoomDetails });
  } catch (error) {
    res.status(500).json({ message: 'Server error adding routine entry.' });
  }
});

// DELETE /api/routine/:id - Remove a routine entry (ONLY Admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await Routine.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Routine entry not found.' });
    }
    res.status(200).json({ message: 'Routine entry deleted.', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting routine entry.' });
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

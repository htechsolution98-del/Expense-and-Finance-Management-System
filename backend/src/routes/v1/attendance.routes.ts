import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getAttendanceConfig,
  upsertAttendanceConfig,
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getTodayStatus,
  getMyAttendance,
  getAllAttendance,
  getAttendanceReport,
  toggleEmployeeWFH,
  createManualAttendance,
} from '../../controllers/attendance.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';

const router = Router();

const uploadDir = path.join(__dirname, '../../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Selfie upload config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `selfie-${uniqueSuffix}${path.extname(file.originalname || '.jpg')}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for selfies.'));
    }
  },
});

// Apply auth
router.use(authenticate);
router.use(tenantScopeMiddleware);

// Config endpoints
router.get('/config', getAttendanceConfig);
router.put('/config', upsertAttendanceConfig);

// Employee check-in/out
router.post('/check-in', upload.single('selfie'), checkIn);
router.post('/check-out', upload.single('selfie'), checkOut);

// Break
router.post('/break/start', startBreak);
router.post('/break/end', endBreak);

// Queries
router.get('/today', getTodayStatus);
router.get('/my', getMyAttendance);
router.get('/all', getAllAttendance);
router.get('/report', getAttendanceReport);
router.patch('/employees/:id/wfh', toggleEmployeeWFH);
router.post('/manual', createManualAttendance);

export default router;

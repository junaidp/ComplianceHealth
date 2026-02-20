import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { logAudit, getClientIp } from '../utils/auditLogger';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.eml', '.txt', '.csv', '.log'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  },
});

const router = Router();

// POST /evidence/upload
router.post('/upload', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided', code: 'VALIDATION_ERROR' });
      return;
    }

    const { controlId, assessmentId, taskId, description } = req.body;
    if (!controlId || !description) {
      res.status(400).json({ error: 'controlId and description are required', code: 'VALIDATION_ERROR' });
      return;
    }

    if (description.length > 100) {
      res.status(400).json({ error: 'Description max 100 characters', code: 'VALIDATION_ERROR' });
      return;
    }

    // Validate control exists
    const control = await prisma.control.findUnique({ where: { id: controlId } });
    if (!control) {
      // Clean up uploaded file
      if (req.file?.path) fs.unlinkSync(req.file.path);
      res.status(400).json({ error: `Control ID "${controlId}" not found. Check the Controls Library for valid IDs.`, code: 'INVALID_CONTROL' });
      return;
    }

    // Compute SHA-256
    const fileBuffer = fs.readFileSync(req.file.path);
    const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const evidence = await prisma.evidenceFile.create({
      data: {
        orgId: req.user!.orgId,
        controlId,
        assessmentId: assessmentId || null,
        taskId: taskId || null,
        filename: req.file.originalname,
        storagePath: req.file.path,
        fileSizeBytes: BigInt(req.file.size),
        sha256Hash,
        description,
        uploadedBy: req.user!.userId,
      },
    });

    await logAudit({
      orgId: req.user!.orgId,
      userId: req.user!.userId,
      action: 'EVIDENCE_UPLOADED',
      entityType: 'evidence',
      entityId: evidence.id,
      newValue: { controlId, filename: req.file.originalname, sha256Hash },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      id: evidence.id,
      filename: evidence.filename,
      sha256Hash: evidence.sha256Hash,
      fileSizeBytes: evidence.fileSizeBytes.toString(),
      description: evidence.description,
      uploadedAt: evidence.uploadedAt,
    });
  } catch (error: any) {
    console.error('Evidence upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload evidence', code: 'INTERNAL_ERROR' });
  }
});

// GET /evidence — List evidence for org
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { controlId, assessmentId, taskId } = req.query;
    const where: any = { orgId: req.user!.orgId, isDeleted: false };
    if (controlId) where.controlId = controlId;
    if (assessmentId) where.assessmentId = assessmentId;
    if (taskId) where.taskId = taskId;

    const files = await prisma.evidenceFile.findMany({
      where,
      include: {
        control: { select: { ref: true, domainName: true } },
        uploadedByUser: { select: { firstName: true, lastName: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    const serialized = files.map(f => ({
      ...f,
      fileSizeBytes: f.fileSizeBytes.toString(),
    }));

    res.json({ data: serialized, total: files.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get evidence files', code: 'INTERNAL_ERROR' });
  }
});

// GET /evidence/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const file = await prisma.evidenceFile.findFirst({
      where: { id: String(req.params.id), orgId: req.user!.orgId, isDeleted: false },
    });

    if (!file) {
      res.status(404).json({ error: 'Evidence file not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({
      ...file,
      fileSizeBytes: file.fileSizeBytes.toString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get evidence file', code: 'INTERNAL_ERROR' });
  }
});

// GET /evidence/:id/download
router.get('/:id/download', authenticate, async (req: Request, res: Response) => {
  try {
    const file = await prisma.evidenceFile.findFirst({
      where: { id: String(req.params.id), orgId: req.user!.orgId, isDeleted: false },
    });

    if (!file) {
      res.status(404).json({ error: 'Evidence file not found', code: 'NOT_FOUND' });
      return;
    }

    if (!fs.existsSync(file.storagePath)) {
      res.status(404).json({ error: 'File not found on disk', code: 'FILE_MISSING' });
      return;
    }

    res.download(file.storagePath, file.filename);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download evidence file', code: 'INTERNAL_ERROR' });
  }
});

export default router;

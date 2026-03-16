import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { getPageCount } from '../services/pdf.service';
import { AppError } from '../middleware/error';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../db';

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists at startup
fs.mkdir(uploadDir, { recursive: true }).catch(() => {});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.use(authMiddleware);

// Upload PDF
router.post('/upload', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Run multer manually to handle async properly
    await new Promise<void>((resolve, reject) => {
      upload.single('file')(req as any, res as any, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const filePath = req.file.path;
    const pageCount = await getPageCount(filePath);

    const document = await prisma.document.create({
      data: {
        userId: req.user!.userId,
        name: req.file.originalname,
        filePath,
        pageCount,
        status: 'draft',
      },
    });

    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
});

// List documents
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const documents = await prisma.document.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        envelopes: {
          include: { recipients: true },
        },
      },
    });

    res.json(documents);
  } catch (error) {
    next(error);
  }
});

// Get document by ID
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        envelopes: {
          include: { recipients: true, fields: true },
        },
      },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    res.json(document);
  } catch (error) {
    next(error);
  }
});

// Get PDF file for viewing
router.get('/:id/pdf', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    const absolutePath = path.resolve(document.filePath);
    res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
});

// Send document (create envelope with recipients and fields)
router.post('/:id/send', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { subject, message, recipients, fields } = req.body as {
      subject: string;
      message?: string;
      recipients: { email: string; name: string; role?: string; signingOrder?: number }[];
      fields: { recipientIndex: number; type: string; page: number; x: number; y: number; width: number; height: number; required?: boolean; placeholder?: string; value?: string }[];
    };

    if (!subject) {
      throw new AppError('Subject is required', 400);
    }

    if ((!recipients || recipients.length === 0) && !fields.some((f) => f.value)) {
      throw new AppError('At least one recipient or self-filled field is required', 400);
    }

    if (!fields || fields.length === 0) {
      throw new AppError('At least one field is required', 400);
    }

    // Validate recipient emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (recipients && recipients.length > 0) {
      for (const r of recipients) {
        if (!emailRegex.test(r.email)) {
          throw new AppError(`Invalid email format: ${r.email}`, 400);
        }
      }
    }

    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    // Check credits
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || user.credits < 1) {
      throw new AppError('Insufficient credits. Please purchase more credits to send documents.', 402);
    }

    // Create envelope
    const envelope = await prisma.envelope.create({
      data: {
        documentId: document.id,
        userId: req.user!.userId,
        subject,
        message,
        status: 'sent',
      },
    });

    // Create recipients
    const createdRecipients = await Promise.all(
      (recipients || []).map((r, _i) =>
        prisma.recipient.create({
          data: {
            envelopeId: envelope.id,
            email: r.email,
            name: r.name,
            role: r.role || 'signer',
            signingOrder: r.signingOrder || 1,
          },
        })
      )
    );

    // Validate field indices and page numbers
    for (const f of fields) {
      if (f.recipientIndex !== -1 && (f.recipientIndex < 0 || f.recipientIndex >= (recipients || []).length)) {
        throw new AppError('Invalid recipient index for field', 400);
      }
      if (f.page < 1 || f.page > document.pageCount) {
        throw new AppError(`Field page ${f.page} is out of range (document has ${document.pageCount} pages)`, 400);
      }
    }

    // Create fields and assign to recipients
    await Promise.all(
      fields.map((f) => {
        const recipient = createdRecipients[f.recipientIndex];
        return prisma.field.create({
          data: {
            envelopeId: envelope.id,
            recipientId: recipient ? recipient.id : null,
            type: f.type,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            required: f.required ?? true,
            placeholder: f.placeholder,
            value: f.value || null,
          },
        });
      })
    );

    // Deduct credit atomically
    await prisma.$transaction(async (tx) => {
      const freshUser = await tx.user.findUnique({ where: { id: req.user!.userId } });
      if (!freshUser || freshUser.credits < 1) {
        throw new AppError('Insufficient credits. Please purchase more credits to send documents.', 402);
      }
      await tx.user.update({
        where: { id: req.user!.userId },
        data: { credits: { decrement: 1 } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: req.user!.userId,
          amount: -1,
          transactionType: 'usage',
          description: `Sent: ${subject}`,
        },
      });
    });

    // If no recipients (self-fill only), generate final PDF and mark completed
    const hasSigners = createdRecipients.some((r) => r.role === 'signer');
    if (!hasSigners) {
      const allFields = await prisma.field.findMany({ where: { envelopeId: envelope.id } });
      const fieldsForPdf = allFields.map((f) => ({
        id: f.id, type: f.type, page: f.page,
        x: f.x, y: f.y, width: f.width, height: f.height, value: f.value,
      }));
      const { saveFinalPdf } = await import('../services/pdf.service');
      await saveFinalPdf(document.filePath, fieldsForPdf, uploadDir);

      await prisma.envelope.update({
        where: { id: envelope.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'completed' },
      });
    } else {
      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'sent' },
      });
    }

    // Return envelope with signing links
    const fullEnvelope = await prisma.envelope.findUnique({
      where: { id: envelope.id },
      include: {
        recipients: true,
        fields: true,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const signingLinks = createdRecipients.map((r) => ({
      recipientName: r.name,
      recipientEmail: r.email,
      signingUrl: `${frontendUrl}/sign/${r.uniqueLink}`,
    }));

    res.status(201).json({
      envelope: fullEnvelope,
      signingLinks,
    });
  } catch (error) {
    next(error);
  }
});

// Delete document
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    // Delete file from disk
    try {
      await fs.unlink(document.filePath);
    } catch {
      // File may not exist
    }

    await prisma.document.delete({ where: { id: document.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Download completed PDF
router.get('/:id/download', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    const baseName = path.basename(document.filePath, '.pdf');
    const signedPath = path.join(uploadDir, `${baseName}_signed.pdf`);

    // Allow downloading original with ?original=true query param
    if (req.query.original === 'true') {
      res.download(document.filePath, document.name);
      return;
    }

    try {
      await fs.access(signedPath);
      res.download(signedPath, `${document.name.replace('.pdf', '')}_signed.pdf`);
    } catch {
      throw new AppError('Signed document not yet available. All recipients must complete signing first.', 404);
    }
  } catch (error) {
    next(error);
  }
});

// Detect form fields from PDF text
router.get('/:id/detect-fields', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    // @ts-ignore - pdf-parse v1 has no types
    const pdfParse = (await import('pdf-parse')).default;
    const pdfBuffer = await fs.readFile(document.filePath);
    const pdfData = await pdfParse(pdfBuffer) as { text: string; numpages: number };

    // Common form field patterns — label followed by colon, underscores, or blank
    const patterns: { regex: RegExp; question: string; type: string; fieldType: string }[] = [
      { regex: /\b(full\s*name|your\s*name|print\s*name|name\s*of\s*\w+)\b/i, question: 'Full Name', type: 'name', fieldType: 'text' },
      { regex: /\b(first\s*name|given\s*name)\b/i, question: 'First Name', type: 'firstName', fieldType: 'text' },
      { regex: /\b(last\s*name|surname|family\s*name)\b/i, question: 'Last Name', type: 'lastName', fieldType: 'text' },
      { regex: /\b(date\s*of\s*birth|d\.?o\.?b\.?|birth\s*date)\b/i, question: 'Date of Birth', type: 'dob', fieldType: 'date' },
      { regex: /\b(email\s*address|e-?mail)\b/i, question: 'Email Address', type: 'email', fieldType: 'text' },
      { regex: /\b(phone\s*number|telephone|mobile|cell\s*phone|contact\s*number)\b/i, question: 'Phone Number', type: 'phone', fieldType: 'text' },
      { regex: /\b(address|street\s*address|mailing\s*address|residential\s*address)\b/i, question: 'Address', type: 'address', fieldType: 'text' },
      { regex: /\b(city|town|suburb)\b/i, question: 'City / Town', type: 'city', fieldType: 'text' },
      { regex: /\b(state|province|county)\b/i, question: 'State / Province', type: 'state', fieldType: 'text' },
      { regex: /\b(post\s*code|zip\s*code|postal\s*code)\b/i, question: 'Postcode / ZIP', type: 'postcode', fieldType: 'text' },
      { regex: /\b(country|nationality)\b/i, question: 'Country', type: 'country', fieldType: 'text' },
      { regex: /\b(company|organisation|organization|employer|business\s*name)\b/i, question: 'Company / Organisation', type: 'company', fieldType: 'text' },
      { regex: /\b(position|job\s*title|title|role|occupation)\b/i, question: 'Position / Title', type: 'title', fieldType: 'text' },
      { regex: /\b(abn|acn|tax\s*file|tfn|ssn|social\s*security)\b/i, question: 'Tax / ID Number', type: 'taxId', fieldType: 'text' },
      { regex: /\b(date|dated|today'?s?\s*date)\b(?!\s*of\s*birth)/i, question: 'Date', type: 'date', fieldType: 'date' },
      { regex: /\b(signature|signed?\s*by|authorised\s*signature)\b/i, question: 'Signature', type: 'signature', fieldType: 'signature' },
    ];

    const text = pdfData.text;
    const detectedFields: { question: string; type: string; fieldType: string; context: string }[] = [];
    const seenTypes = new Set<string>();

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match && !seenTypes.has(pattern.type)) {
        seenTypes.add(pattern.type);
        // Extract surrounding context for the match
        const idx = match.index || 0;
        const context = text.substring(Math.max(0, idx - 30), Math.min(text.length, idx + match[0].length + 30)).trim();
        detectedFields.push({
          question: pattern.question,
          type: pattern.type,
          fieldType: pattern.fieldType,
          context,
        });
      }
    }

    res.json({
      fields: detectedFields,
      pageCount: document.pageCount,
      textPreview: text.substring(0, 500),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

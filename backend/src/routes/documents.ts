import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { getPageCount } from '../services/pdf.service';
import { AppError } from '../middleware/error';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendSigningRequest } from '../services/email.service';
import prisma from '../db';

const detectFieldsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many detect-fields requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

    // Verify PDF magic bytes
    const buf = Buffer.alloc(5);
    const fd = await fs.open(req.file.path, 'r');
    await fd.read(buf, 0, 5, 0);
    await fd.close();
    if (buf.toString('ascii') !== '%PDF-') {
      await fs.unlink(req.file.path);
      throw new AppError('Invalid PDF file', 400);
    }

    const filePath = path.resolve(req.file.path);
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

    const safeDocuments = documents.map((doc) => {
      const { filePath: _fp, ...rest } = doc as any;
      return rest;
    });
    res.json(safeDocuments);
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

    const { filePath: _fp, ...safeDoc } = document as any;
    res.json(safeDoc);
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
    const uploadsAbsolute = path.resolve(uploadDir);
    if (!absolutePath.startsWith(uploadsAbsolute)) {
      throw new AppError('Invalid file path', 400);
    }
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

    // Subject/message length and CRLF sanitisation
    if (subject && subject.length > 255) throw new AppError('Subject must be 255 characters or fewer', 400);
    if (message && message.length > 2000) throw new AppError('Message must be 2000 characters or fewer', 400);
    const safeSubject = (subject || '').replace(/[\r\n]/g, ' ');
    const safeMessage = (message || '').replace(/[\r\n]/g, ' ');

    if ((!recipients || recipients.length === 0) && !fields.some((f) => f.value)) {
      throw new AppError('At least one recipient or self-filled field is required', 400);
    }

    if (!fields || fields.length === 0) {
      throw new AppError('At least one field is required', 400);
    }

    // Validate field types
    const validFieldTypes = ['signature', 'text', 'date', 'checkbox'];
    for (const f of fields) {
      if (!validFieldTypes.includes(f.type)) {
        throw new AppError(`Invalid field type: ${f.type}`, 400);
      }
    }

    // Validate field coordinates
    for (const f of fields) {
      if (typeof f.x !== 'number' || f.x < 0 || typeof f.y !== 'number' || f.y < 0 ||
          typeof f.width !== 'number' || f.width <= 0 || typeof f.height !== 'number' || f.height <= 0) {
        throw new AppError('Invalid field coordinates', 400);
      }
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

    // Duplicate recipient email check
    const emails = (recipients || []).map((r: any) => r.email?.toLowerCase());
    if (new Set(emails).size !== emails.length) {
      throw new AppError('Duplicate recipient email addresses are not allowed', 400);
    }

    // Validate signingOrder values
    for (const r of (recipients || [])) {
      if (r.signingOrder !== undefined && (!Number.isInteger(Number(r.signingOrder)) || Number(r.signingOrder) < 1)) {
        throw new AppError('signingOrder must be a positive integer', 400);
      }
    }

    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    // Validate field indices and page numbers BEFORE any DB writes
    for (const f of fields) {
      if (f.recipientIndex !== -1 && (f.recipientIndex < 0 || f.recipientIndex >= (recipients || []).length)) {
        throw new AppError('Invalid recipient index for field', 400);
      }
      if (f.page < 1 || f.page > document.pageCount) {
        throw new AppError(`Field page ${f.page} is out of range (document has ${document.pageCount} pages)`, 400);
      }
    }

    // Wrap entire operation in a single transaction to prevent orphaned records
    const result = await prisma.$transaction(async (tx) => {
      // Check and deduct credit atomically
      const user = await tx.user.findUnique({ where: { id: req.user!.userId } });
      if (!user || user.credits < 1) {
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
          description: `Sent: ${safeSubject}`,
        },
      });

      // Create envelope
      const envelope = await tx.envelope.create({
        data: {
          documentId: document.id,
          userId: req.user!.userId,
          subject: safeSubject,
          message: safeMessage || null,
          status: 'sent',
        },
      });

      // Create recipients
      const createdRecipients = await Promise.all(
        (recipients || []).map((r) =>
          tx.recipient.create({
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

      // Create fields and assign to recipients
      await Promise.all(
        fields.map((f) => {
          const recipient = f.recipientIndex >= 0 ? createdRecipients[f.recipientIndex] : null;
          return tx.field.create({
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

      // If no signers, mark completed
      const hasSigners = createdRecipients.some((r) => r.role === 'signer');
      if (!hasSigners) {
        await tx.envelope.update({
          where: { id: envelope.id },
          data: { status: 'completed', completedAt: new Date() },
        });
        await tx.document.update({
          where: { id: document.id },
          data: { status: 'completed' },
        });
      } else {
        await tx.document.update({
          where: { id: document.id },
          data: { status: 'sent' },
        });
      }

      return { envelope, createdRecipients, hasSigners, senderName: `${user.firstName} ${user.lastName}`.trim(), senderEmail: user.email };
    });

    // Generate final PDF outside transaction if no signers (self-fill only)
    if (!result.hasSigners) {
      const allFields = await prisma.field.findMany({ where: { envelopeId: result.envelope.id } });
      const fieldsForPdf = allFields.map((f) => ({
        id: f.id, type: f.type, page: f.page,
        x: f.x, y: f.y, width: f.width, height: f.height, value: f.value,
      }));
      const { saveFinalPdf } = await import('../services/pdf.service');
      await saveFinalPdf(document.filePath, fieldsForPdf, uploadDir, result.envelope.id);
    }

    // Return envelope with signing links
    const fullEnvelope = await prisma.envelope.findUnique({
      where: { id: result.envelope.id },
      include: {
        recipients: true,
        fields: true,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const signingLinks = result.createdRecipients.map((r) => ({
      recipientName: r.name,
      recipientEmail: r.email,
      signingUrl: `${frontendUrl}/sign/${r.uniqueLink}`,
    }));

    // Send signing request emails (fire-and-forget — don't fail the request if email fails)
    const signers = result.createdRecipients.filter((r) => r.role === 'signer');
    for (const signer of signers) {
      sendSigningRequest({
        recipientName: signer.name,
        recipientEmail: signer.email,
        senderName: result.senderName || 'Someone',
        documentTitle: document.name,
        subject: safeSubject,
        message: safeMessage || undefined,
        signingUrl: `${frontendUrl}/sign/${signer.uniqueLink}`,
      }).catch((err) => console.error('[email] Failed to send signing request:', err.message));
    }

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
      include: { envelopes: true },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    if (document.status === 'sent') {
      throw new AppError('Cannot delete a document that has been sent for signing. Void it first.', 409);
    }

    // Delete original PDF from disk
    try {
      await fs.unlink(document.filePath);
    } catch {
      // File may not exist
    }
    // Delete signed PDFs for each envelope (named {envelopeId}_signed.pdf)
    for (const envelope of document.envelopes) {
      try {
        const signedPath = path.join(path.resolve(uploadDir), `${envelope.id}_signed.pdf`);
        await fs.unlink(signedPath);
      } catch {
        // Signed file may not exist
      }
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
      include: { envelopes: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    // Allow downloading original with ?original=true query param
    if (req.query.original === 'true') {
      res.download(document.filePath, document.name);
      return;
    }

    // Signed PDFs are named {envelopeId}_signed.pdf
    const envelope = document.envelopes[0];
    if (!envelope) {
      throw new AppError('Signed document not yet available. All recipients must complete signing first.', 404);
    }
    const signedPath = path.join(path.resolve(uploadDir), `${envelope.id}_signed.pdf`);

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
router.get('/:id/detect-fields', detectFieldsLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    });
  } catch (error) {
    next(error);
  }
});

export default router;

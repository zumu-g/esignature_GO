import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import { saveFinalPdf } from '../services/pdf.service';
import { AppError } from '../middleware/error';
import prisma from '../db';

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Get document for signing (public - no auth required)
router.get('/:link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const link = req.params.link;
    if (!link) {
      throw new AppError('Signing link required', 400);
    }

    const recipient = await prisma.recipient.findUnique({
      where: { uniqueLink: link },
      include: {
        envelope: {
          include: {
            document: true,
            fields: true,
            recipients: {
              select: { id: true, name: true, status: true, signingOrder: true },
            },
          },
        },
      },
    });

    if (!recipient) {
      throw new AppError('Signing link not found or expired', 404);
    }

    if (recipient.envelope.status === 'voided') {
      throw new AppError('This document has been voided', 400);
    }

    if (recipient.status === 'signed') {
      throw new AppError('You have already signed this document', 400);
    }

    // Check signing order
    const allRecipients = recipient.envelope.recipients;
    const earlierPending = allRecipients.some(
      (r) => r.signingOrder < recipient.signingOrder && r.status === 'pending'
    );

    if (earlierPending) {
      throw new AppError('Waiting for previous signers to complete', 400);
    }

    // Mark as viewed
    if (!recipient.viewedAt) {
      await prisma.recipient.update({
        where: { id: recipient.id },
        data: { viewedAt: new Date(), status: 'viewed' },
      });
    }

    // Return only fields assigned to this recipient
    const myFields = recipient.envelope.fields.filter(
      (f) => f.recipientId === recipient.id
    );

    res.json({
      recipientId: recipient.id,
      recipientName: recipient.name,
      documentName: recipient.envelope.document.name,
      subject: recipient.envelope.subject,
      message: recipient.envelope.message,
      pageCount: recipient.envelope.document.pageCount,
      fields: myFields,
      allRecipients: allRecipients.map((r) => ({
        name: r.name,
        status: r.status,
        isMe: r.id === recipient.id,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get PDF for signing view (public)
router.get('/:link/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const link = req.params.link;
    if (!link) {
      throw new AppError('Signing link required', 400);
    }

    const recipient = await prisma.recipient.findUnique({
      where: { uniqueLink: link },
      include: { envelope: { include: { document: true } } },
    });

    if (!recipient) {
      throw new AppError('Signing link not found', 404);
    }

    const absolutePath = path.resolve(recipient.envelope.document.filePath);
    res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
});

// Complete signing (public)
router.post('/:link/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const link = req.params.link;
    if (!link) {
      throw new AppError('Signing link required', 400);
    }

    const { fields: submittedFields } = req.body as {
      fields: { id: string; value: string }[];
    };

    const recipient = await prisma.recipient.findUnique({
      where: { uniqueLink: link },
      include: {
        envelope: {
          include: {
            document: true,
            fields: true,
            recipients: true,
          },
        },
      },
    });

    if (!recipient) {
      throw new AppError('Signing link not found', 404);
    }

    if (recipient.status === 'signed') {
      throw new AppError('You have already signed this document', 400);
    }

    // Validate required fields for this recipient
    const myFields = recipient.envelope.fields.filter((f) => f.recipientId === recipient.id);
    const requiredFields = myFields.filter((f) => f.required);

    for (const reqField of requiredFields) {
      const submitted = submittedFields.find((sf) => sf.id === reqField.id);
      if (!submitted || !submitted.value) {
        throw new AppError(`Required field is not filled`, 400);
      }
    }

    // Validate field value sizes and formats
    for (const sf of submittedFields) {
      if (!sf.value) continue;
      const fieldDef = myFields.find((f) => f.id === sf.id);
      if (!fieldDef) {
        throw new AppError('Invalid field submission', 400);
      }
      sf.value = sf.value.trim();
      if (fieldDef.type === 'signature') {
        if (!sf.value.startsWith('data:image/png;base64,')) {
          throw new AppError('Invalid signature format', 400);
        }
        if (sf.value.length > 500000) {
          throw new AppError('Signature data too large', 400);
        }
      } else if (fieldDef.type === 'text') {
        if (sf.value.length > 1000) {
          throw new AppError('Text value too long (max 1000 characters)', 400);
        }
      } else if (fieldDef.type === 'date') {
        if (sf.value.length > 50) {
          throw new AppError('Date value too long', 400);
        }
      }
    }

    // Perform all signing operations in a transaction
    const allComplete = await prisma.$transaction(async (tx) => {
      // Update field values
      await Promise.all(
        submittedFields.map((sf) =>
          tx.field.update({
            where: { id: sf.id },
            data: { value: sf.value },
          })
        )
      );

      // Mark recipient as signed
      await tx.recipient.update({
        where: { id: recipient.id },
        data: { status: 'signed', signedAt: new Date() },
      });

      // Re-fetch all recipients to get fresh status
      const freshRecipients = await tx.recipient.findMany({
        where: { envelopeId: recipient.envelope.id },
      });

      const allSigners = freshRecipients.filter((r) => r.role === 'signer');
      const allSignersComplete = allSigners.every((r) => r.status === 'signed');

      if (allSignersComplete) {
        // All signers done - generate final PDF
        const allFields = await tx.field.findMany({
          where: { envelopeId: recipient.envelope.id },
        });

        const fieldsForPdf = allFields.map((f) => ({
          id: f.id,
          type: f.type,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          value: f.value,
        }));

        await saveFinalPdf(recipient.envelope.document.filePath, fieldsForPdf, uploadDir);

        await tx.envelope.update({
          where: { id: recipient.envelope.id },
          data: { status: 'completed', completedAt: new Date() },
        });

        await tx.document.update({
          where: { id: recipient.envelope.documentId },
          data: { status: 'completed' },
        });
      }

      return allSignersComplete;
    });

    res.json({
      success: true,
      message: 'Document signed successfully',
      allComplete,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

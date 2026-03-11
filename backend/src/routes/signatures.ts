import { Router, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../db';

const router = Router();

router.use(authMiddleware);

// List signatures
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const signatures = await prisma.signature.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(signatures);
  } catch (error) {
    next(error);
  }
});

// Create signature
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, signatureData, isDefault } = req.body as {
      name: string;
      signatureData: string;
      isDefault?: boolean;
    };

    if (!name || !signatureData) {
      throw new AppError('Name and signature data are required', 400);
    }

    if (isDefault) {
      await prisma.signature.updateMany({
        where: { userId: req.user!.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const signature = await prisma.signature.create({
      data: {
        userId: req.user!.userId,
        name,
        signatureData,
        isDefault: isDefault ?? false,
      },
    });

    res.status(201).json(signature);
  } catch (error) {
    next(error);
  }
});

// Delete signature
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sig = await prisma.signature.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!sig) {
      throw new AppError('Signature not found', 404);
    }

    await prisma.signature.delete({ where: { id: sig.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

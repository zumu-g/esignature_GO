import { Router, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../db';

const router = Router();

router.use(authMiddleware);

const CREDIT_PACKS = [
  { id: 'pack_5', credits: 5, price: 1000, label: '5 Credits - $10' },
  { id: 'pack_10', credits: 10, price: 1800, label: '10 Credits - $18' },
  { id: 'pack_25', credits: 25, price: 4000, label: '25 Credits - $40' },
  { id: 'pack_50', credits: 50, price: 7500, label: '50 Credits - $75' },
  { id: 'pack_100', credits: 100, price: 12000, label: '100 Credits - $120' },
];

// Get credit balance and packs
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { credits: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({ credits: user.credits, packs: CREDIT_PACKS });
  } catch (error) {
    next(error);
  }
});

// Purchase credits (stubbed - no Stripe for now)
router.post('/purchase', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { packId } = req.body as { packId: string };
    const pack = CREDIT_PACKS.find((p) => p.id === packId);

    if (!pack) {
      throw new AppError('Invalid credit pack', 400);
    }

    // In production, this would process Stripe payment first
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { credits: { increment: pack.credits } },
    });

    await prisma.creditTransaction.create({
      data: {
        userId: req.user!.userId,
        amount: pack.credits,
        transactionType: 'purchase',
        description: pack.label,
      },
    });

    res.json({ credits: user.credits, purchased: pack.credits });
  } catch (error) {
    next(error);
  }
});

// Transaction history
router.get('/history', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transactions = await prisma.creditTransaction.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

export default router;

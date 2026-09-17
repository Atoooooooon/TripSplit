import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// Handler to record a settlement
const handleRecordSettlement = (req: Request, res: Response) => {
  try {
    const tripId = req.params.tripId;
    const { fromMemberId, toMemberId, amount, currency = 'CNY', note, expenseId } = req.body;

    if (!tripId) {
      return res.status(400).json({ success: false, error: '缺少 tripId' });
    }

    if (!fromMemberId || !toMemberId || !amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: '转账人、收款人和有效还款金额均为必填项',
      });
    }

    if (fromMemberId === toMemberId) {
      return res.status(400).json({ success: false, error: '转账人与收款人不能是同一人' });
    }

    const numAmount = parseFloat(amount);
    const settlementId = `stl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO settlements (id, trip_id, from_member_id, to_member_id, amount, currency, settled_at, note, expense_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(settlementId, tripId, fromMemberId, toMemberId, numAmount, currency, now, note || null, expenseId || null);

    console.log(`[Settlement] Recorded ${settlementId} in trip ${tripId}: ${fromMemberId} -> ${toMemberId} ¥${numAmount}${expenseId ? ` for expense ${expenseId}` : ''}`);

    res.json({ success: true, settlementId });
  } catch (err: any) {
    console.error('[Settlement Error]', err);
    res.status(500).json({ success: false, error: err.message || '记录结清失败' });
  }
};

// Bind multiple route styles to ensure universal compatibility
router.post('/:tripId/settlements', handleRecordSettlement);
router.post('/trips/:tripId/settlements', handleRecordSettlement);
router.post('/settlements/:tripId', handleRecordSettlement);

// Handler to delete/undo a settlement
const handleDeleteSettlement = (req: Request, res: Response) => {
  try {
    const settlementId = req.params.id;
    if (!settlementId) {
      return res.status(400).json({ success: false, error: '缺少结算ID' });
    }

    db.prepare('DELETE FROM settlements WHERE id = ?').run(settlementId);
    console.log(`[Settlement] Deleted ${settlementId}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Settlement Delete Error]', err);
    res.status(500).json({ success: false, error: err.message || '撤销结清失败' });
  }
};

router.delete('/settlements/:id', handleDeleteSettlement);
router.delete('/:id', handleDeleteSettlement);

export default router;


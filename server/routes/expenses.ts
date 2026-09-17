import { Router } from 'express';
import { db } from '../db';
import { convertCurrency, roundCurrency } from '../../src/utils/math';
import { Currency } from '../../src/types';

const router = Router();

// Create new expense
const handleCreateExpense = (req: any, res: any) => {
  try {
    const { tripId } = req.params;
    const {
      title,
      category = '其他',
      amount,
      currency = 'CNY',
      exchangeRate: customRate,
      date,
      splitType = 'equal',
      payers = [],
      participants = [],
      notes,
    } = req.body;

    if (!title || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Title and valid positive amount are required' });
    }

    const trip = db.prepare('SELECT settlement_currency FROM trips WHERE id = ?').get(tripId) as any;
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const settlementCurrency = trip.settlement_currency as Currency;
    const { settlementAmount, exchangeRate } = convertCurrency(amount, currency as Currency, settlementCurrency, customRate);

    const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const insertExpense = db.prepare(`
      INSERT INTO expenses (id, trip_id, title, category, amount, currency, settlement_amount, exchange_rate, date, split_type, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPayer = db.prepare(`
      INSERT INTO expense_payers (id, expense_id, member_id, amount)
      VALUES (?, ?, ?, ?)
    `);

    const insertParticipant = db.prepare(`
      INSERT INTO expense_participants (id, expense_id, member_id, share, share_ratio)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertExpense.run(
        expenseId,
        tripId,
        title.trim(),
        category,
        amount,
        currency,
        settlementAmount,
        exchangeRate,
        date || now.split('T')[0],
        splitType,
        notes || null,
        now
      );

      // Save Payers
      payers.forEach((p: any) => {
        insertPayer.run(
          `payer_${expenseId}_${p.memberId}`,
          expenseId,
          p.memberId,
          p.amount
        );
      });

      // Save Participants
      participants.forEach((p: any) => {
        insertParticipant.run(
          `part_${expenseId}_${p.memberId}`,
          expenseId,
          p.memberId,
          p.share,
          p.shareRatio || null
        );
      });
    });

    transaction();

    res.json({ success: true, expenseId });
  } catch (err: any) {
    console.error('[Expense Create Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

router.post('/:tripId/expenses', handleCreateExpense);
router.post('/trips/:tripId/expenses', handleCreateExpense);

// Update expense
const handleUpdateExpense = (req: any, res: any, next: any) => {
  try {
    const expenseId = req.params.id;
    if (expenseId && expenseId.startsWith('stl_')) {
      return next();
    }
    const {
      title,
      category,
      amount,
      currency,
      exchangeRate: customRate,
      date,
      splitType,
      payers,
      participants,
      notes,
    } = req.body;

    const existing = db.prepare('SELECT trip_id FROM expenses WHERE id = ?').get(expenseId) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }

    const trip = db.prepare('SELECT settlement_currency FROM trips WHERE id = ?').get(existing.trip_id) as any;
    const settlementCurrency = trip ? trip.settlement_currency : 'CNY';

    let settlementAmount = amount;
    let exchangeRate = 1.0;
    if (currency && settlementCurrency) {
      const converted = convertCurrency(amount, currency as Currency, settlementCurrency as Currency, customRate);
      settlementAmount = converted.settlementAmount;
      exchangeRate = converted.exchangeRate;
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE expenses
        SET title = COALESCE(?, title),
            category = COALESCE(?, category),
            amount = COALESCE(?, amount),
            currency = COALESCE(?, currency),
            settlement_amount = COALESCE(?, settlement_amount),
            exchange_rate = COALESCE(?, exchange_rate),
            date = COALESCE(?, date),
            split_type = COALESCE(?, split_type),
            notes = COALESCE(?, notes)
        WHERE id = ?
      `).run(title, category, amount, currency, settlementAmount, exchangeRate, date, splitType, notes, expenseId);

      if (payers && Array.isArray(payers)) {
        db.prepare('DELETE FROM expense_payers WHERE expense_id = ?').run(expenseId);
        payers.forEach((payer: any, idx: number) => {
          db.prepare('INSERT INTO expense_payers (id, expense_id, member_id, amount) VALUES (?, ?, ?, ?)').run(
            `payer_${expenseId}_${idx}`,
            expenseId,
            payer.memberId,
            payer.amount
          );
        });
      }

      if (participants && Array.isArray(participants)) {
        db.prepare('DELETE FROM expense_participants WHERE expense_id = ?').run(expenseId);
        participants.forEach((part: any, idx: number) => {
          db.prepare('INSERT INTO expense_participants (id, expense_id, member_id, share, share_ratio) VALUES (?, ?, ?, ?, ?)').run(
            `part_${expenseId}_${idx}`,
            expenseId,
            part.memberId,
            part.share,
            part.shareRatio || null
          );
        });
      }
    });

    transaction();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.put('/expenses/:id', handleUpdateExpense);
router.put('/:id', handleUpdateExpense);

// Delete expense
const handleDeleteExpense = (req: any, res: any, next: any) => {
  try {
    const expenseId = req.params.id;
    if (expenseId && expenseId.startsWith('stl_')) {
      return next();
    }
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM expense_payers WHERE expense_id = ?').run(expenseId);
      db.prepare('DELETE FROM expense_participants WHERE expense_id = ?').run(expenseId);
      db.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId);
    });
    tx();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.delete('/expenses/:id', handleDeleteExpense);
router.delete('/:id', handleDeleteExpense);

export default router;

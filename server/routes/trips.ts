import { Router } from 'express';
import { db } from '../db';
import { Trip, TripMember } from '../../src/types';

const router = Router();

// List trips (isolated by access codes)
router.get('/', (req, res) => {
  try {
    const codesParam = req.query.codes as string | undefined;
    let trips: any[] = [];
    if (codesParam) {
      const codes = codesParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      if (codes.length > 0) {
        const placeholders = codes.map(() => '?').join(',');
        trips = db.prepare(`SELECT * FROM trips WHERE UPPER(access_code) IN (${placeholders}) ORDER BY created_at DESC`).all(...codes) as any[];
      }
    }
    
    // Attach members and expense counts
    const result = trips.map(t => {
      const members = db.prepare('SELECT * FROM trip_members WHERE trip_id = ?').all(t.id) as any[];
      const expenseCount = (db.prepare('SELECT COUNT(*) as count FROM expenses WHERE trip_id = ?').get(t.id) as any).count;
      const expenseSum = (db.prepare('SELECT COALESCE(SUM(settlement_amount), 0) as total FROM expenses WHERE trip_id = ?').get(t.id) as any).total;

      return {
        id: t.id,
        name: t.name,
        destination: t.destination,
        startDate: t.start_date,
        endDate: t.end_date,
        settlementCurrency: t.settlement_currency,
        accessCode: t.access_code || 'KR2026',
        createdAt: t.created_at,
        memberCount: members.length,
        expenseCount,
        totalExpense: expenseSum,
        members: members.map(m => ({
          id: m.id,
          tripId: m.trip_id,
          name: m.name,
          isCurrentUser: false,
          avatarColor: m.avatar_color,
          createdAt: m.created_at,
        })),
      };
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Join trip by access code
router.post('/join', (req, res) => {
  try {
    const rawCode = req.body.code || req.body.accessCode;
    if (!rawCode || !String(rawCode).trim()) {
      return res.status(400).json({ success: false, error: '请输入旅行房间口令' });
    }
    const cleanCode = String(rawCode).trim().toUpperCase();
    const trip = db.prepare('SELECT id, name, access_code FROM trips WHERE UPPER(access_code) = ?').get(cleanCode) as any;
    if (!trip) {
      return res.status(404).json({ success: false, error: '未找到该口令对应的旅行，请检查是否输入正确' });
    }
    res.json({ success: true, data: { tripId: trip.id, name: trip.name, accessCode: trip.access_code } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single trip with all members, expenses, settlements
router.get('/:id', (req, res) => {
  try {
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id) as any;
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const members = (db.prepare('SELECT * FROM trip_members WHERE trip_id = ? ORDER BY created_at ASC').all(trip.id) as any[]).map(m => ({
      id: m.id,
      tripId: m.trip_id,
      name: m.name,
      isCurrentUser: false,
      avatarColor: m.avatar_color,
      createdAt: m.created_at,
    }));

    const expensesRaw = db.prepare('SELECT * FROM expenses WHERE trip_id = ? ORDER BY date DESC, created_at DESC').all(trip.id) as any[];
    const expenses = expensesRaw.map(exp => {
      const payers = db.prepare('SELECT member_id as memberId, amount FROM expense_payers WHERE expense_id = ?').all(exp.id) as any[];
      const participants = db.prepare('SELECT member_id as memberId, share, share_ratio as shareRatio FROM expense_participants WHERE expense_id = ?').all(exp.id) as any[];
      return {
        id: exp.id,
        tripId: exp.trip_id,
        title: exp.title,
        category: exp.category,
        amount: exp.amount,
        currency: exp.currency,
        settlementAmount: exp.settlement_amount,
        exchangeRate: exp.exchange_rate,
        date: exp.date,
        splitType: exp.split_type,
        notes: exp.notes,
        createdAt: exp.created_at,
        payers,
        participants,
      };
    });

    const settlements = (db.prepare('SELECT * FROM settlements WHERE trip_id = ? ORDER BY settled_at DESC').all(trip.id) as any[]).map(s => ({
      id: s.id,
      tripId: s.trip_id,
      fromMemberId: s.from_member_id,
      toMemberId: s.to_member_id,
      amount: s.amount,
      currency: s.currency,
      settledAt: s.settled_at,
      note: s.note,
    }));

    res.json({
      success: true,
      data: {
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        settlementCurrency: trip.settlement_currency,
        accessCode: trip.access_code || 'KR2026',
        createdAt: trip.created_at,
        members,
        expenses,
        settlements,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a trip and its cascade data
router.delete('/:id', (req, res) => {
  try {
    const tripId = req.params.id;
    const trip = db.prepare('SELECT id, name FROM trips WHERE id = ?').get(tripId) as any;
    if (!trip) {
      return res.status(404).json({ success: false, error: '旅行不存在或已被删除' });
    }

    const deleteTx = db.transaction(() => {
      const expenses = db.prepare('SELECT id FROM expenses WHERE trip_id = ?').all(tripId) as any[];
      for (const exp of expenses) {
        db.prepare('DELETE FROM expense_payers WHERE expense_id = ?').run(exp.id);
        db.prepare('DELETE FROM expense_participants WHERE expense_id = ?').run(exp.id);
      }
      db.prepare('DELETE FROM expenses WHERE trip_id = ?').run(tripId);
      db.prepare('DELETE FROM settlements WHERE trip_id = ?').run(tripId);
      db.prepare('DELETE FROM trip_members WHERE trip_id = ?').run(tripId);
      db.prepare('DELETE FROM trips WHERE id = ?').run(tripId);
    });

    deleteTx();
    res.json({ success: true, message: `旅行账本「${trip.name}」已成功删除` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new trip
router.post('/', (req, res) => {
  try {
    const { name, destination, startDate, endDate, settlementCurrency = 'CNY', members = [], creatorName } = req.body;
    if (!name || !destination) {
      return res.status(400).json({ success: false, error: 'Name and destination are required' });
    }

    const trimmedCreator = (creatorName || '').trim();
    if (!trimmedCreator || ['我', '自己', '本人', 'me', 'i'].includes(trimmedCreator.toLowerCase())) {
      return res.status(400).json({ success: false, error: '请填写具体的发起人名字或昵称，不能使用“我”' });
    }

    const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    // Auto-generate a guaranteed unique 6-character code (excluding ambiguous chars)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let finalCode = '';
    while (true) {
      let candidate = '';
      for (let i = 0; i < 6; i++) {
        candidate += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existing = db.prepare('SELECT id FROM trips WHERE UPPER(access_code) = ?').get(candidate);
      if (!existing) {
        finalCode = candidate;
        break;
      }
    }

    const insertTrip = db.prepare(`
      INSERT INTO trips (id, name, destination, start_date, end_date, settlement_currency, access_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMember = db.prepare(`
      INSERT INTO trip_members (id, trip_id, name, is_current_user, avatar_color, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const avatarColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

    const transaction = db.transaction(() => {
      insertTrip.run(
        tripId,
        name,
        destination,
        startDate || now.split('T')[0],
        endDate || now.split('T')[0],
        settlementCurrency,
        finalCode,
        now
      );

      // Normalize members whether array of strings or objects
      const rawList = Array.isArray(members) ? members : [];
      const memberList: Array<{ name: string; isCurrentUser: boolean }> = rawList.map((item: any) => {
        if (typeof item === 'string') {
          return { name: item.trim(), isCurrentUser: item.trim() === trimmedCreator };
        }
        return { name: (item.name || '').trim(), isCurrentUser: !!item.isCurrentUser };
      }).filter(m => m.name.length > 0 && !['我', '自己', '本人'].includes(m.name));

      // Ensure creator is in members
      if (!memberList.some(m => m.name === trimmedCreator || m.isCurrentUser)) {
        memberList.unshift({ name: trimmedCreator, isCurrentUser: true });
      }

      memberList.forEach((m, idx) => {
        const memId = `mem_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`;
        const color = avatarColors[idx % avatarColors.length];
        insertMember.run(memId, tripId, m.name, m.isCurrentUser ? 1 : 0, color, now);
      });
    });

    transaction();

    res.json({ success: true, tripId, accessCode: finalCode });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add member to trip
router.post('/:id/members', (req, res) => {
  try {
    const { name, isCurrentUser = false } = req.body;
    const cleanName = (name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ success: false, error: '请输入成员名字' });
    }
    if (['我', '自己', '本人', 'me', 'i'].includes(cleanName.toLowerCase())) {
      return res.status(400).json({ success: false, error: '不能添加“' + cleanName + '”，请填写具体成员名字或昵称' });
    }

    const tripId = req.params.id;
    const memId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const avatarColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];
    const count = (db.prepare('SELECT COUNT(*) as c FROM trip_members WHERE trip_id = ?').get(tripId) as any).c;
    const color = avatarColors[count % avatarColors.length];

    db.prepare(`
      INSERT INTO trip_members (id, trip_id, name, is_current_user, avatar_color, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(memId, tripId, cleanName, isCurrentUser ? 1 : 0, color, new Date().toISOString());

    res.json({ success: true, memberId: memId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update member name
router.put('/:id/members/:memberId', (req, res) => {
  try {
    const { name } = req.body;
    const { id: tripId, memberId } = req.params;
    const cleanName = (name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ success: false, error: '请输入成员名字' });
    }
    if (['我', '自己', '本人', 'me', 'i'].includes(cleanName.toLowerCase())) {
      return res.status(400).json({ success: false, error: '不能改名为“' + cleanName + '”，请填写具体成员名字或昵称' });
    }
    db.prepare('UPDATE trip_members SET name = ? WHERE id = ? AND trip_id = ?').run(cleanName, memberId, tripId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete member
router.delete('/:id/members/:memberId', (req, res) => {
  try {
    const { id: tripId, memberId } = req.params;

    // Check if member has active expenses
    const payerCount = (db.prepare('SELECT COUNT(*) as c FROM expense_payers WHERE member_id = ?').get(memberId) as any).c;
    const partCount = (db.prepare('SELECT COUNT(*) as c FROM expense_participants WHERE member_id = ?').get(memberId) as any).c;

    if (payerCount > 0 || partCount > 0) {
      return res.status(400).json({
        success: false,
        error: '该成员已有参与的记账消费记录，无法直接删除。请先修改相关账单。',
      });
    }

    db.prepare('DELETE FROM trip_members WHERE id = ? AND trip_id = ?').run(memberId, tripId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

import { Router } from 'express';
import { db } from '../db';
import { parseExpenseWithAi, parseTripWithAi } from '../ai/deepseek';
import { TripMember, Currency } from '../../src/types';

const router = Router();

// Parse natural language expense or settlement
router.post('/parse', async (req, res) => {
  try {
    const { text, tripId, history = [], customApiKey, currentMemberId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text input is required' });
    }

    let members: TripMember[] = [];
    let settlementCurrency: Currency = 'CNY';

    if (tripId) {
      const trip = db.prepare('SELECT settlement_currency FROM trips WHERE id = ?').get(tripId) as any;
      if (trip) {
        settlementCurrency = trip.settlement_currency as Currency;
      }

      const rows = db.prepare('SELECT * FROM trip_members WHERE trip_id = ? ORDER BY created_at ASC').all(tripId) as any[];
      members = rows.map(r => ({
        id: r.id,
        tripId: r.trip_id,
        name: r.name,
        isCurrentUser: currentMemberId ? r.id === currentMemberId : !!r.is_current_user,
        avatarColor: r.avatar_color,
        createdAt: r.created_at,
      }));
    }

    const todayDate = new Date().toISOString().split('T')[0];

    const draft = await parseExpenseWithAi(
      text,
      {
        members,
        settlementCurrency,
        todayDate,
        history,
      },
      customApiKey
    );

    res.json({ success: true, data: draft });
  } catch (err: any) {
    console.error('[AI Parse Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Parse natural language trip creation
router.post('/parse-trip', async (req, res) => {
  try {
    const { text, customApiKey } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text input is required' });
    }

    const draft = await parseTripWithAi(text, customApiKey);
    res.json({ success: true, data: draft });
  } catch (err: any) {
    console.error('[AI Parse Trip Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

import { Router } from 'express';
import { db } from '../db';

const router = Router();

// Get settings
router.get('/', (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'deepseek_api_key'").get() as { value: string } | undefined;
    const hasKey = !!(row && row.value && row.value.trim().length > 0) || !!process.env.DEEPSEEK_API_KEY;
    const maskedKey = row?.value ? `${row.value.slice(0, 4)}••••••••${row.value.slice(-4)}` : '';

    res.json({
      success: true,
      data: {
        hasDeepSeekKey: hasKey,
        maskedKey,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update settings
router.post('/', (req, res) => {
  try {
    const { deepseekApiKey } = req.body;

    if (deepseekApiKey !== undefined) {
      db.prepare(`
        INSERT INTO settings (key, value) VALUES ('deepseek_api_key', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(deepseekApiKey.trim());
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify developer password against database
router.post('/verify-dev-password', (req, res) => {
  try {
    const { password } = req.body;
    if (!password || !String(password).trim()) {
      return res.status(400).json({ success: false, error: '请输入开发者管理密码' });
    }

    const row = db.prepare("SELECT value FROM settings WHERE key = 'dev_password'").get() as { value: string } | undefined;
    const dbPassword = row?.value || '010034';

    if (String(password).trim() === dbPassword.trim()) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: '密码错误' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

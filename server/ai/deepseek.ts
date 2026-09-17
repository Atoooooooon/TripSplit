import { AiExpenseDraft, TripMember, Currency, SplitType, AiTripDraft } from '../../src/types';
import { heuristicParseExpense, heuristicParseTrip } from './heuristicParser';
import { db } from '../db';

interface TripContext {
  members: TripMember[];
  settlementCurrency: Currency;
  todayDate: string;
  history?: Array<{ role: string; content: string }>;
}

export async function parseExpenseWithAi(
  text: string,
  context: TripContext,
  customApiKey?: string
): Promise<AiExpenseDraft> {
  // 1. Check for DeepSeek API Key in customApiKey, DB settings, or environment
  let apiKey = customApiKey;
  if (!apiKey) {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'deepseek_api_key'").get() as { value: string } | undefined;
    apiKey = row?.value || process.env.DEEPSEEK_API_KEY;
  }

  // If no API key is provided, use the high-precision heuristic rule engine
  if (!apiKey || apiKey.trim() === '') {
    return heuristicParseExpense(text, context);
  }

  // 2. Prepare DeepSeek Prompt
  const memberListStr = context.members.map(m => `${m.name}${m.isCurrentUser ? '（当前登录用户/“我”）' : ''}`).join('、');
  
  const systemPrompt = `你是一个专业的旅行记账助手。你的任务是从用户的自然语言输入中准确提取【日常旅行消费记账信息（Expense）】。
请注意：本系统 AI 识别只负责记日常消费账单，不负责结算转账（结算在独立模块处理）。任何输入都请作为消费支出提取。

当前旅行上下文：
- 成员列表：${memberListStr}
- 默认结算货币：${context.settlementCurrency}
- 今天日期：${context.todayDate}

【核心语义理解准则】：
1. 消费事项与分类 (title & category)：
   - 提取消费的具体物品或服务（如：车票、打车、午餐、便利店、景点门票、房费、咖啡等）。
   - category 必须在以下中选取一个：餐饮、交通、住宿、门票、购物、娱乐、机票、咖啡、超市、其他。
2. 金额与币种 (amount & currency)：
   - 提取总消费金额数字。默认币种为 ${context.settlementCurrency}，若提及韩元、日元、美元、泰铢、欧元等请转换为对应的 ISO 代码。
3. 付款垫付人 (payers)：
   - 谁实际掏钱/刷卡付款或垫付这笔款项。
   - 例如：“我买了车票20”、“我帮小李垫了100门票”、“lyh应付我20元车票钱”（由我垫付出资）-> payers 为 [{ memberName: "我", amount: 20 }]。
   - 若未提及付款人，默认由当前登录用户（“我”）支付。
4. 承担享受人 (participants) 与分摊方式 (splitType)：
   - 谁享受并实际承担这笔消费。
   - 代垫/他人个人消费：“lyh应付我20元车票钱”、“小王欠我50饭钱”、“我帮小李垫了100门票” -> 承担人只有对应的具体成员（lyh、小王、小李），金额为该笔消费全额，splitType 为 "exact"。
   - 集体/多人分摊：“中午吃饭花了300”、“大家打车50” -> 参与分摊成员为全员（或提到的成员），金额均分，splitType 为 "equal"。
   - 个人自费：“我自己买了一杯咖啡25” -> 付款人和承担人均为“我”，splitType 为 "exact"。

必须严格返回如下 JSON 格式：
{
  "title": "项目名称（如车票、午餐、打车等）",
  "category": "餐饮|交通|住宿|门票|购物|娱乐|机票|咖啡|超市|其他",
  "amount": 数字金额,
  "currency": "货币代码，如 CNY, KRW, JPY, USD, EUR, THB",
  "date": "YYYY-MM-DD 格式日期",
  "splitType": "equal 或 exact",
  "payers": [
    { "memberName": "出资付款人姓名", "amount": 实际付款金额 }
  ],
  "participants": [
    { "memberName": "承担分摊人姓名", "share": 承担金额 }
  ],
  "needClarification": false,
  "clarificationQuestion": "",
  "clarificationOptions": []
}

注意：
1. 涉及“我”时映射为“我”；涉及其他成员时必须准确对应成员列表中的成员姓名。
2. 必须仅返回有效 JSON 对象，严禁输出任何 markdown 格式或非 JSON 字符。`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(context.history || []),
      { role: 'user', content: text },
    ];

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[AI] DeepSeek API returned ${response.status}. Falling back to heuristic.`);
      return heuristicParseExpense(text, context);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    const memberMap = new Map(context.members.map(m => [m.name, m.id]));
    const currentMember = context.members.find(m => m.isCurrentUser);

    const payers = (parsed.payers || []).map((p: any) => {
      let memberId = memberMap.get(p.memberName);
      if (!memberId && (p.memberName === '我' || p.memberName === '自己')) {
        memberId = currentMember?.id;
      }
      return {
        memberName: p.memberName,
        memberId,
        amount: Number(p.amount) || 0,
      };
    });

    const participants = (parsed.participants || []).map((p: any) => {
      let memberId = memberMap.get(p.memberName);
      if (!memberId && (p.memberName === '我' || p.memberName === '自己')) {
        memberId = currentMember?.id;
      }
      return {
        memberName: p.memberName,
        memberId,
        share: Number(p.share) || 0,
      };
    });

    return {
      title: parsed.title || '旅行消费',
      category: parsed.category || '其他',
      amount: Number(parsed.amount) || 0,
      currency: (parsed.currency as Currency) || context.settlementCurrency || 'CNY',
      date: parsed.date || context.todayDate,
      splitType: (parsed.splitType as SplitType) || 'equal',
      payers,
      participants,
      needClarification: !!parsed.needClarification,
      clarificationQuestion: parsed.clarificationQuestion,
      clarificationOptions: parsed.clarificationOptions,
      rawText: text,
    };
  } catch (error: any) {
    console.warn('[AI] DeepSeek call failed:', error.message, '. Falling back to heuristic.');
    return heuristicParseExpense(text, context);
  }
}

/**
 * Natural language creation of a trip using DeepSeek AI with heuristic fallback.
 */
export async function parseTripWithAi(
  text: string,
  customApiKey?: string
): Promise<AiTripDraft> {
  let apiKey = customApiKey;
  if (!apiKey) {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'deepseek_api_key'").get() as { value: string } | undefined;
    apiKey = row?.value || process.env.DEEPSEEK_API_KEY;
  }

  if (!apiKey || apiKey.trim() === '') {
    return heuristicParseTrip(text);
  }

  const systemPrompt = `你是一个旅行助手。用户会用自然语言描述一个旅行计划（如：“国庆和老王、小李三个人去成都玩5天”、“下周跟Amy去东京玩，用日元”）。
请提取并返回严格 JSON 格式：
{
  "name": "旅行名称（如 成都秋季游、东京探索之行）",
  "destination": "目的地（如 成都、日本 · 东京）",
  "creatorName": "发起人具体名字或昵称，若用户未明确说明自己叫什么，请留空字符串 \"\"，严禁输出 \"我\"",
  "members": ["同行好友A", "同行好友B"],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "settlementCurrency": "结算币种代码，如 CNY, JPY, KRW, USD, EUR, THB",
  "accessCode": "推荐的6位大写字母数字房间口令（如 CD2026, TK8888）"
}
注意：members 中不要包含发起人自身；严禁将发起人命名为“我”；必须仅返回 JSON 对象。`;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return heuristicParseTrip(text);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return heuristicParseTrip(text);

    const parsed = JSON.parse(content);
    return {
      name: parsed.name || '新旅行',
      destination: parsed.destination || '旅行目的地',
      creatorName: (parsed.creatorName && !['我', '自己', '本人', 'me', 'i'].includes(parsed.creatorName.trim().toLowerCase())) ? parsed.creatorName.trim() : '',
      members: Array.isArray(parsed.members) ? parsed.members : ['小王', '小李'],
      startDate: parsed.startDate || new Date().toISOString().split('T')[0],
      endDate: parsed.endDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      settlementCurrency: (parsed.settlementCurrency as Currency) || 'CNY',
      accessCode: parsed.accessCode || `TR${Math.floor(1000 + Math.random() * 9000)}`,
    };
  } catch (err) {
    console.warn('[AI] DeepSeek trip parse failed. Falling back to heuristic.');
    return heuristicParseTrip(text);
  }
}

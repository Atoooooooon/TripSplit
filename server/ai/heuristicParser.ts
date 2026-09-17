import { Category, Currency, SplitType, AiExpenseDraft, TripMember, AiTripDraft } from '../../src/types';
import { splitEqually, convertCurrency, roundCurrency } from '../../src/utils/math';

interface TripContext {
  members: TripMember[];
  settlementCurrency: Currency;
  todayDate: string;
  history?: Array<{ role: string; content: string }>;
}

// Convert Chinese numbers like "八万六", "八万六千", "五百", "一百二" into number
function parseChineseNumber(str: string): number | null {
  const cnNumMap: Record<string, number> = {
    '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  };

  // Check simple patterns like 八万六 (86000), 八万六千 (86000)
  if (/^([一二两三四五六七八九])万([一二两三四五六七八九])千?$/.test(str)) {
    const match = str.match(/^([一二两三四五六七八九])万([一二两三四五六七八九])千?$/);
    if (match) {
      return (cnNumMap[match[1]] || 0) * 10000 + (cnNumMap[match[2]] || 0) * 1000;
    }
  }

  if (/^([一二两三四五六七八九])万$/.test(str)) {
    const match = str.match(/^([一二两三四五六七八九])万$/);
    if (match) return (cnNumMap[match[1]] || 0) * 10000;
  }

  if (/^([一二两三四五六七八九])千([一二两三四五六七八九])百?$/.test(str)) {
    const match = str.match(/^([一二两三四五六七八九])千([一二两三四五六七八九])百?$/);
    if (match) {
      return (cnNumMap[match[1]] || 0) * 1000 + (cnNumMap[match[2]] || 0) * 100;
    }
  }

  if (/^([一二两三四五六七八九])千$/.test(str)) {
    const match = str.match(/^([一二两三四五六七八九])千$/);
    if (match) return (cnNumMap[match[1]] || 0) * 1000;
  }

  if (/^([一二两三四五六七八九])百([一二两三四五六七八九])?十?$/.test(str)) {
    const match = str.match(/^([一二两三四五六七八九])百([一二两三四五六七八九])?十?$/);
    if (match) {
      return (cnNumMap[match[1]] || 0) * 100 + (match[2] ? (cnNumMap[match[2]] || 0) * 10 : 0);
    }
  }

  return null;
}

export function heuristicParseExpense(
  text: string,
  context: TripContext
): AiExpenseDraft {
  const members = context.members || [];
  const memberNames = members.map(m => m.name);
  const rawText = text.trim();

  // 1. Currency Detection
  let currency: Currency = context.settlementCurrency || 'CNY';
  if (/韩元|韩币|KRW|₩/i.test(rawText)) {
    currency = 'KRW';
  } else if (/日元|日币|JPY/i.test(rawText)) {
    currency = 'JPY';
  } else if (/美元|美金|USD|\$|刀/i.test(rawText)) {
    currency = 'USD';
  } else if (/欧元|EUR|€/i.test(rawText)) {
    currency = 'EUR';
  } else if (/泰铢|THB|฿/i.test(rawText)) {
    currency = 'THB';
  } else if (/人民币|RMB|CNY|元|块/i.test(rawText)) {
    currency = 'CNY';
  }

  // 0A. Advance Payment Detection (代垫记账消费，如 "lyh应付我20元车票钱", "小王欠我50饭钱", "我帮小李垫了100门票", "我替小王付了50打车")
  // 这是代垫消费（由出资人垫付，由承担人享受），绝非还款转账！
  const advancePattern1 = rawText.match(/^(?:([^\s，,。0-9]+?)\s*)?(?:应付|欠|该给|该付给|应给)\s*([^\s，,。0-9]+?)\s*(\d+(?:\.\d+)?)\s*(?:元|块)?(?:\s*(?:的|买)?\s*(.*))?$/i);
  const advancePattern2 = rawText.match(/^(?:([^\s，,。0-9]+?)\s*)?(?:帮|替|代)\s*([^\s，,。0-9]+?)\s*(?:垫了?|付了?|出了?|垫付了?|买了?)\s*(\d+(?:\.\d+)?)\s*(?:元|块)?(?:\s*(?:的|买)?\s*(.*))?$/i);

  if (advancePattern1 || advancePattern2) {
    let debtorName = ''; // 实际承担消费/欠款的人
    let creditorName = ''; // 实际垫付出资的人
    let expAmount = 0;
    let desc = '';

    if (advancePattern1) {
      // [A] 应付 [B] 20元 [车票钱] -> A欠钱，B垫付
      debtorName = (advancePattern1[1] || '').trim();
      creditorName = (advancePattern1[2] || '').trim();
      expAmount = parseFloat(advancePattern1[3]);
      desc = (advancePattern1[4] || '').trim();
    } else if (advancePattern2) {
      // [B] 帮 [A] 垫了 20元 [车票钱] -> B垫付，A欠钱
      creditorName = (advancePattern2[1] || '').trim() || '我';
      debtorName = (advancePattern2[2] || '').trim();
      expAmount = parseFloat(advancePattern2[3]);
      desc = (advancePattern2[4] || '').trim();
    }

    if (expAmount > 0) {
      const findMember = (name: string) => {
        if (!name) return null;
        if (name === '我' || name === '自己') return members.find(m => m.isCurrentUser) || members[0];
        return members.find(m => m.name.toLowerCase() === name.toLowerCase() || m.name.replace(/\s+/g, '') === name.replace(/\s+/g, ''));
      };

      const creditorMember = findMember(creditorName) || members.find(m => m.isCurrentUser) || members[0];
      const debtorMember = findMember(debtorName) || members.find(m => !m.isCurrentUser) || members[0];

      let expCategory: Category = '其他';
      let expTitle = '代垫消费';
      const testText = desc || rawText;

      if (/车票|动车|高铁|火车|地铁|打车|出租车|Uber|滴滴|交通|公交/i.test(testText)) {
        expCategory = '交通';
        if (/车票|动车|高铁|火车/i.test(testText)) expTitle = '车票';
        else if (/打车|出租车|Uber|滴滴/i.test(testText)) expTitle = '打车出行';
        else expTitle = '交通出行';
      } else if (/饭|餐|吃|外卖|奶茶|火锅|烤肉|烧烤/i.test(testText)) {
        expCategory = '餐饮';
        expTitle = '餐饮美食';
      } else if (/门票|景点/i.test(testText)) {
        expCategory = '门票';
        expTitle = '景点门票';
      } else if (/酒店|住宿|房费/i.test(testText)) {
        expCategory = '住宿';
        expTitle = '住宿房费';
      } else if (desc) {
        expTitle = desc.replace(/钱|费$/g, '');
      }

      return {
        title: expTitle,
        category: expCategory,
        amount: expAmount,
        currency,
        date: context.todayDate || new Date().toISOString().split('T')[0],
        splitType: 'exact',
        payers: [
          {
            memberName: creditorMember ? creditorMember.name : (creditorName || '我'),
            memberId: creditorMember?.id,
            amount: expAmount,
          }
        ],
        participants: [
          {
            memberName: debtorMember ? debtorMember.name : (debtorName || '同行成员'),
            memberId: debtorMember?.id,
            share: expAmount,
          }
        ],
        rawText,
        needClarification: false,
      };
    }
  }

  // 2. Category Detection
  let category: Category = '其他';
  let title = '消费';

  if (/烤肉|火锅|海鲜|料理|炸鸡|晚饭|晚餐|午饭|午餐|早餐|早饭|吃饭|吃面|奶茶|夜宵|烧烤/i.test(rawText)) {
    category = '餐饮';
    const foodMatch = rawText.match(/(烤肉|火锅|海鲜|料理|炸鸡|晚饭|晚餐|午饭|午餐|早餐|早饭|奶茶|夜宵|烧烤)/);
    title = foodMatch ? foodMatch[1] : '餐饮美食';
  } else if (/打车|出租车|Uber|打Uber|打滴滴|滴滴|地铁|机场|包车|动车|高铁|火车|公交|接机|送机/i.test(rawText)) {
    category = '交通';
    if (/机场/i.test(rawText)) title = '打车去机场';
    else if (/打车|出租车|Uber/i.test(rawText)) title = '打车出行';
    else title = '交通出行';
  } else if (/酒店|民宿|住宿|Hotel|青旅|房费/i.test(rawText)) {
    category = '住宿';
    title = '酒店住宿';
  } else if (/门票|门票费|景点|迪士尼|环球影城|观光/i.test(rawText)) {
    category = '门票';
    title = '景点门票';
  } else if (/便利店|7-11|全家|罗森|超市|CU|GS25/i.test(rawText)) {
    category = '超市';
    title = '便利店超市';
  } else if (/咖啡|星巴克|Blue Bottle|拿铁|美式/i.test(rawText)) {
    category = '咖啡';
    title = '咖啡下午茶';
  } else if (/机票|飞机票|航司/i.test(rawText)) {
    category = '机票';
    title = '往返机票';
  } else if (/购物|免税店|买衣服|买鞋|专柜|商场/i.test(rawText)) {
    category = '购物';
    title = '购物消费';
  } else if (/酒吧|清吧|KTV|娱乐|游乐/i.test(rawText)) {
    category = '娱乐';
    title = '休闲娱乐';
  }

  // 3. Amount Detection
  let amount = 0;

  // Check for Chinese numerals like 八万六
  const cnMatch = rawText.match(/([一二两三四五六七八九]万[一二两三四五六七八九]?千?|[一二两三四五六七八九]千[一二两三四五六七八九]?百?|[一二两三四五六七八九]百[一二两三四五六七八九]?十?)/);
  if (cnMatch) {
    const val = parseChineseNumber(cnMatch[1]);
    if (val && val > 0) amount = val;
  }

  // Check for standard arabic numerals (e.g. 120, 86000, 38000, 480.5)
  if (amount === 0) {
    // Look for numbers preceded or followed by currency words or spend words
    const numMatches = Array.from(rawText.matchAll(/(\d+(?:\.\d+)?)/g));
    if (numMatches.length > 0) {
      // If there are multiple numbers (e.g. "便利店 135，我出了100，小李出了35"),
      // check if the first number or the largest number is the total
      const nums = numMatches.map(m => parseFloat(m[1]));
      // If first number matches sum of others, e.g. 135 = 100 + 35
      if (nums.length >= 3 && Math.abs(nums[0] - (nums[1] + nums[2])) < 0.01) {
        amount = nums[0];
      } else {
        amount = nums[0];
      }
    }
  }

  // 4. Date Detection
  let date = context.todayDate || new Date().toISOString().split('T')[0];
  if (/昨天/i.test(rawText)) {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    date = d.toISOString().split('T')[0];
  } else if (/前天/i.test(rawText)) {
    const d = new Date(date);
    d.setDate(d.getDate() - 2);
    date = d.toISOString().split('T')[0];
  }

  // 5. Payers Detection
  interface PayerDraft {
    memberName: string;
    memberId?: string;
    amount: number;
  }

  const payers: PayerDraft[] = [];

  // Multi-payer check: "我出了100，小李出了35"
  const multiPayerRegex = /([^\s，,。]+)(?:出|付)了?\s*(\d+(?:\.\d+)?)/g;
  const multiMatches = Array.from(rawText.matchAll(multiPayerRegex));
  if (multiMatches.length >= 2) {
    let sumPaid = 0;
    for (const m of multiMatches) {
      const name = m[1].replace(/^(我和|和|跟)/, '').trim();
      const pAmt = parseFloat(m[2]);
      const matchedMember = members.find(mem => mem.name === name || (name === '我' && mem.isCurrentUser));
      if (matchedMember) {
        payers.push({
          memberName: matchedMember.name,
          memberId: matchedMember.id,
          amount: pAmt,
        });
        sumPaid += pAmt;
      }
    }
    if (amount === 0 && sumPaid > 0) {
      amount = sumPaid;
    }
  }

  // Single payer check: "我付", "我先垫", "小王付", "小李付", "小王买门票花了"
  if (payers.length === 0) {
    let payerName: string | null = null;
    if (/我(?:先)?(?:付|垫|买|出的|付款|买单|结账)/.test(rawText) || /是我付/.test(rawText)) {
      payerName = '我';
    } else {
      for (const m of members) {
        const regex = new RegExp(`(${m.name})(?:先)?(?:付|垫|买|出的|付款|买单|结账)`);
        if (regex.test(rawText)) {
          payerName = m.name;
          break;
        }
      }
    }

    if (payerName) {
      const matchedMember = members.find(mem => mem.name === payerName || (payerName === '我' && mem.isCurrentUser));
      if (matchedMember) {
        payers.push({
          memberName: matchedMember.name,
          memberId: matchedMember.id,
          amount: amount,
        });
      }
    }
  }

  // 6. Participants & Split Type Detection
  let splitType: SplitType = 'equal';
  let participantMembers: TripMember[] = [];

  // Check for exclusions: "小王没吃，剩下三个人 AA"
  const excludeMatch = rawText.match(/([^\s，,。]+)(?:没吃|没去|不参与|不吃|除外)/);
  if (excludeMatch) {
    const excludedName = excludeMatch[1].replace(/^(除|除了)/, '').trim();
    participantMembers = members.filter(m => m.name !== excludedName);
  } else if (/我和\s*([^\s，,。]+)\s*(?:坐的|吃的|去)/.test(rawText)) {
    // "我和 Amy 坐的，我付款"
    const pairMatch = rawText.match(/我和\s*([^\s，,。]+)\s*(?:坐的|吃的|去)/);
    const partnerName = pairMatch ? pairMatch[1].trim() : '';
    participantMembers = members.filter(m => m.isCurrentUser || m.name === partnerName);
  } else if (/([^\s，,。]+(?:、[^\s，,。]+)*(?:和[^\s，,。]+)?)(?:三|四|两)?个人(?:平摊|AA|的)/.test(rawText)) {
    // e.g. "小王、小李和我三个人平摊" or "我、小王、小李三个人的"
    const groupMatch = rawText.match(/([^\s，,。]+(?:、[^\s，,。]+)*(?:和[^\s，,。]+)?)(?:三|四|两)?个人(?:平摊|AA|的)/);
    if (groupMatch) {
      const groupStr = groupMatch[1];
      const matched = members.filter(m => groupStr.includes(m.name) || (m.isCurrentUser && groupStr.includes('我')));
      if (matched.length > 0) {
        participantMembers = matched;
      }
    }
  }

  // Check for custom amounts: "我和小王各承担200，剩下100小李承担"
  const customShareMatch = rawText.match(/各承担\s*(\d+).*?剩下\s*(\d+)([^\s，,。]+)承担/);
  let customParticipants: Array<{ memberName: string; memberId: string; share: number }> | null = null;

  if (customShareMatch) {
    splitType = 'custom';
    const eachAmount = parseFloat(customShareMatch[1]);
    const restAmount = parseFloat(customShareMatch[2]);
    const restPersonName = customShareMatch[3].trim();

    customParticipants = [];
    members.forEach(m => {
      if (m.name === restPersonName) {
        customParticipants!.push({ memberName: m.name, memberId: m.id, share: restAmount });
      } else if (rawText.includes(m.name) || (m.isCurrentUser && rawText.includes('我'))) {
        customParticipants!.push({ memberName: m.name, memberId: m.id, share: eachAmount });
      }
    });
  }

  // Default participants to all members if not specifically restricted
  if (!customParticipants && participantMembers.length === 0) {
    participantMembers = [...members];
  }

  // Calculate shares
  const participants = customParticipants
    ? customParticipants
    : (() => {
        const shares = splitEqually(amount, participantMembers.length, currency);
        return participantMembers.map((m, idx) => ({
          memberName: m.name,
          memberId: m.id,
          share: shares[idx] || 0,
        }));
      })();

  // 7. Missing Information / Clarification Check
  // E.g. "今天吃饭花了300" -> missing payer
  if (amount > 0 && payers.length === 0) {
    return {
      title,
      category,
      amount,
      currency,
      date,
      splitType,
      payers: [],
      participants,
      rawText,
      needClarification: true,
      clarificationQuestion: `识别到 ${currency === 'CNY' ? '¥' : currency} ${amount} 的「${category}」消费，请问是谁付款？`,
      clarificationOptions: members.map(m => m.name),
    };
  }

  return {
    title,
    category,
    amount,
    currency,
    date,
    splitType,
    payers,
    participants,
    rawText,
    needClarification: false,
  };
}

export function heuristicParseTrip(text: string): AiTripDraft {
  const rawText = text.trim();

  // Destination detection
  let destination = '城市探索';
  const destMatch = rawText.match(/去\s*([^\s，,。玩趟次]{2,10})/);
  if (destMatch) {
    destination = destMatch[1].trim();
  } else {
    const cityMatch = rawText.match(/(成都|重庆|首尔|东京|大阪|北京|上海|河南|开封|洛阳|郑州|杭州|三亚|大理|丽江|西藏|新疆|香港|澳门|曼谷|普吉岛|清迈|韩国|日本|泰国|欧洲)/);
    if (cityMatch) destination = cityMatch[1];
  }

  const name = `${destination}旅行`;

  // Currency detection
  let settlementCurrency: Currency = 'CNY';
  if (/韩元|韩币|KRW/i.test(rawText)) settlementCurrency = 'KRW';
  else if (/日元|日币|JPY/i.test(rawText)) settlementCurrency = 'JPY';
  else if (/美元|USD/i.test(rawText)) settlementCurrency = 'USD';
  else if (/泰铢|THB/i.test(rawText)) settlementCurrency = 'THB';
  else if (/欧元|EUR/i.test(rawText)) settlementCurrency = 'EUR';

  // Members extraction: "和老王、小李三个人" / "跟老王、小李、Amy" / "同行三人"
  const members: string[] = [];
  const memberMatch = rawText.match(/(?:和|跟|与)\s*([^去，,。]+?)(?:三|四|五|两|几)?(?:个)?人?去/);
  if (memberMatch) {
    const namesStr = memberMatch[1];
    const names = namesStr.split(/[、,，\s和跟与]+/).map(s => s.trim()).filter(s => s && s !== '我' && s !== '自己');
    members.push(...names);
  }

  if (members.length === 0) {
    // Check for "同行三人" or "四个人"
    if (/三个人|同行三人|3个人|同行3人/.test(rawText)) {
      members.push('同行好友A', '同行好友B');
    } else if (/四个人|同行四人|4个人|同行4人/.test(rawText)) {
      members.push('小王', '小李', 'Amy');
    } else {
      members.push('小王', '小李');
    }
  }

  // Duration / Dates
  let days = 5;
  const dayMatch = rawText.match(/(\d+)\s*天/);
  if (dayMatch) {
    days = parseInt(dayMatch[1], 10);
  }

  const now = new Date();
  const startDate = now.toISOString().split('T')[0];
  const endDateObj = new Date(now);
  endDateObj.setDate(endDateObj.getDate() + days);
  const endDate = endDateObj.toISOString().split('T')[0];

  // Access Code recommendation (e.g. HN8821)
  const prefix = destination.length >= 2 ? destination.slice(0, 2).toUpperCase() : 'TR';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const accessCode = `TR${randomSuffix}`;

  return {
    name,
    destination,
    creatorName: '',
    members,
    startDate,
    endDate,
    settlementCurrency,
    accessCode,
  };
}

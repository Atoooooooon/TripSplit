import { describe, it, expect } from 'vitest';
import { splitEqually, roundCurrency, convertCurrency } from './math';
import { calculateBalancesAndTransfers } from './debtSimplifier';
import { Trip, Expense, TripMember } from '../types';

describe('Math utilities', () => {
  it('should split 100 CNY equally among 3 members with exact remainder handling', () => {
    const shares = splitEqually(100, 3, 'CNY');
    expect(shares).toEqual([33.34, 33.33, 33.33]);
    const sum = shares.reduce((acc, v) => acc + v, 0);
    expect(roundCurrency(sum, 'CNY')).toBe(100.0);
  });

  it('should split 86,000 KRW among 4 members with 0 decimals', () => {
    const shares = splitEqually(86000, 4, 'KRW');
    expect(shares).toEqual([21500, 21500, 21500, 21500]);
    const sum = shares.reduce((acc, v) => acc + v, 0);
    expect(sum).toBe(86000);
  });

  it('should convert KRW to CNY at fixed exchange rate correctly', () => {
    const { settlementAmount, exchangeRate } = convertCurrency(86000, 'KRW', 'CNY', 190);
    expect(exchangeRate).toBe(190);
    expect(settlementAmount).toBe(452.63);
  });
});

describe('Debt Simplification (Min Cash Flow)', () => {
  it('should simplify circular debt A -> B -> C into A -> C', () => {
    const members: TripMember[] = [
      { id: 'm1', tripId: 't1', name: 'A', isCurrentUser: true, avatarColor: '#3b82f6', createdAt: '' },
      { id: 'm2', tripId: 't1', name: 'B', isCurrentUser: false, avatarColor: '#10b981', createdAt: '' },
      { id: 'm3', tripId: 't1', name: 'C', isCurrentUser: false, avatarColor: '#f59e0b', createdAt: '' },
    ];

    const trip: Trip = {
      id: 't1',
      name: 'Test Trip',
      destination: 'Seoul',
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      settlementCurrency: 'CNY',
      members,
      createdAt: '',
    };

    // Expense 1: B paid 100 for A (A owes B 100)
    // Expense 2: C paid 100 for B (B owes C 100)
    const expenses: Expense[] = [
      {
        id: 'e1',
        tripId: 't1',
        title: 'Taxi',
        category: '交通',
        amount: 100,
        currency: 'CNY',
        settlementAmount: 100,
        exchangeRate: 1,
        date: '2026-10-01',
        splitType: 'exact',
        payers: [{ memberId: 'm2', amount: 100 }], // B paid
        participants: [{ memberId: 'm1', share: 100 }], // A consumed
        createdAt: '',
      },
      {
        id: 'e2',
        tripId: 't1',
        title: 'Coffee',
        category: '咖啡',
        amount: 100,
        currency: 'CNY',
        settlementAmount: 100,
        exchangeRate: 1,
        date: '2026-10-01',
        splitType: 'exact',
        payers: [{ memberId: 'm3', amount: 100 }], // C paid
        participants: [{ memberId: 'm2', share: 100 }], // B consumed
        createdAt: '',
      },
    ];

    const { balances, suggestedTransfers } = calculateBalancesAndTransfers(trip, expenses, []);

    // Net balance:
    // A paid 0, share 100 -> net -100
    // B paid 100, share 100 -> net 0
    // C paid 100, share 0 -> net +100
    const aBal = balances.find(b => b.memberId === 'm1');
    const bBal = balances.find(b => b.memberId === 'm2');
    const cBal = balances.find(b => b.memberId === 'm3');

    expect(aBal?.netBalance).toBe(-100);
    expect(bBal?.netBalance).toBe(0);
    expect(cBal?.netBalance).toBe(100);

    // Simplification: only ONE transfer: A -> C 100!
    expect(suggestedTransfers.length).toBe(1);
    expect(suggestedTransfers[0].fromMemberName).toBe('A');
    expect(suggestedTransfers[0].toMemberName).toBe('C');
    expect(suggestedTransfers[0].amount).toBe(100);
  });

  it('Scenario from User: 河南tri-trip (城际铁路60元 3人AA + 火车票1030元 2人AA)', () => {
    const members: TripMember[] = [
      { id: 'm_me', tripId: 't2', name: '我', isCurrentUser: true, avatarColor: '#3b82f6', createdAt: '' },
      { id: 'm_lyy', tripId: 't2', name: 'l y y', isCurrentUser: false, avatarColor: '#10b981', createdAt: '' },
      { id: 'm_lzh', tripId: 't2', name: 'lzh', isCurrentUser: false, avatarColor: '#f59e0b', createdAt: '' },
    ];

    const trip: Trip = {
      id: 't2',
      name: '河南tri-trip',
      destination: '河南',
      startDate: '2026-09-30',
      endDate: '2026-10-07',
      settlementCurrency: 'CNY',
      members,
      createdAt: '',
    };

    // 1. 郑州东到开封城际铁路 60元, lyy付, 3人AA
    // 2. 上海到郑州东火车票 1030元, lzh付, 我和lzh 2人
    const expenses: Expense[] = [
      {
        id: 'e1',
        tripId: 't2',
        title: '郑州东到开封城际铁路',
        category: '交通',
        amount: 60,
        currency: 'CNY',
        settlementAmount: 60,
        exchangeRate: 1,
        date: '2026-09-30',
        splitType: 'equal',
        payers: [{ memberId: 'm_lyy', amount: 60 }],
        participants: [
          { memberId: 'm_me', share: 20 },
          { memberId: 'm_lyy', share: 20 },
          { memberId: 'm_lzh', share: 20 },
        ],
        createdAt: '',
      },
      {
        id: 'e2',
        tripId: 't2',
        title: '上海到郑州东火车票',
        category: '交通',
        amount: 1030,
        currency: 'CNY',
        settlementAmount: 1030,
        exchangeRate: 1,
        date: '2026-09-30',
        splitType: 'equal',
        payers: [{ memberId: 'm_lzh', amount: 1030 }],
        participants: [
          { memberId: 'm_me', share: 515 },
          { memberId: 'm_lzh', share: 515 },
        ],
        createdAt: '',
      },
    ];

    const { balances, suggestedTransfers, rawTransfers } = calculateBalancesAndTransfers(trip, expenses, []);

    // 1. Check balances
    const meBal = balances.find(b => b.memberId === 'm_me')?.netBalance;
    const lyyBal = balances.find(b => b.memberId === 'm_lyy')?.netBalance;
    const lzhBal = balances.find(b => b.memberId === 'm_lzh')?.netBalance;

    expect(meBal).toBe(-535); // 我欠 535
    expect(lyyBal).toBe(40);  // lyy应收 40
    expect(lzhBal).toBe(495); // lzh应收 495

    // 2. Check Min Cash Flow simplified mode (2 transfers)
    expect(suggestedTransfers.length).toBe(2);
    // 我 -> lzh 495
    const toLzh = suggestedTransfers.find(t => t.toMemberName === 'lzh');
    expect(toLzh?.amount).toBe(495);
    // 我 -> lyy 40 (with explanation!)
    const toLyy = suggestedTransfers.find(t => t.toMemberName === 'l y y');
    expect(toLyy?.amount).toBe(40);
    expect(toLyy?.explanation).toContain('本人应付');

    // 3. Check Raw mode (3 transfers: 我->lzh 515, 我->lyy 20, lzh->lyy 20)
    expect(rawTransfers.length).toBe(3);
    const rawMeToLzh = rawTransfers.find(t => t.fromMemberName === '我' && t.toMemberName === 'lzh');
    const rawMeToLyy = rawTransfers.find(t => t.fromMemberName === '我' && t.toMemberName === 'l y y');
    const rawLzhToLyy = rawTransfers.find(t => t.fromMemberName === 'lzh' && t.toMemberName === 'l y y');

    expect(rawMeToLzh?.amount).toBe(515);
    expect(rawMeToLyy?.amount).toBe(20);
    expect(rawLzhToLyy?.amount).toBe(20);
  });
});

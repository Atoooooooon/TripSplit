import { describe, it, expect } from 'vitest';
import { heuristicParseExpense } from './heuristicParser';
import { TripMember } from '../../src/types';

describe('Heuristic NLP Parser for Travel Expenses', () => {
  const members: TripMember[] = [
    { id: 'm_me', tripId: 't1', name: '我', isCurrentUser: true, avatarColor: '#3b82f6', createdAt: '' },
    { id: 'm_wang', tripId: 't1', name: '小王', isCurrentUser: false, avatarColor: '#10b981', createdAt: '' },
    { id: 'm_li', tripId: 't1', name: '小李', isCurrentUser: false, avatarColor: '#f59e0b', createdAt: '' },
    { id: 'm_amy', tripId: 't1', name: 'Amy', isCurrentUser: false, avatarColor: '#ec4899', createdAt: '' },
  ];

  const context = {
    members,
    settlementCurrency: 'CNY' as const,
    todayDate: '2026-09-17',
  };

  it('Example 1: 打车去机场 120 元，我付的，小王、小李和我三个人平摊', () => {
    const res = heuristicParseExpense('今天打车去机场 120 元，我付的，小王、小李和我三个人平摊。', context);
    expect(res.category).toBe('交通');
    expect(res.amount).toBe(120);
    expect(res.payers[0].memberName).toBe('我');
    expect(res.participants.length).toBe(3);
    const names = res.participants.map(p => p.memberName);
    expect(names).toContain('我');
    expect(names).toContain('小王');
    expect(names).toContain('小李');
    expect(res.participants[0].share).toBe(40);
  });

  it('Example 2: 晚饭 480，我付，小王没吃，剩下三个人 AA', () => {
    const res = heuristicParseExpense('晚饭 480，我付，小王没吃，剩下三个人 AA。', context);
    expect(res.category).toBe('餐饮');
    expect(res.amount).toBe(480);
    expect(res.payers[0].memberName).toBe('我');
    expect(res.participants.length).toBe(3);
    const names = res.participants.map(p => p.memberName);
    expect(names).not.toContain('小王');
    expect(res.participants[0].share).toBe(160);
  });

  it('Example 3: 早餐 86 小李付的，大家一起吃', () => {
    const res = heuristicParseExpense('早餐 86 小李付的，大家一起吃。', context);
    expect(res.category).toBe('餐饮');
    expect(res.amount).toBe(86);
    expect(res.payers[0].memberName).toBe('小李');
    expect(res.participants.length).toBe(4);
    // 86 / 4 = 21.5
    expect(res.participants[0].share).toBe(21.5);
  });

  it('Example 4: 昨天酒店 1200，我先垫的，四个人平摊', () => {
    const res = heuristicParseExpense('昨天酒店 1200，我先垫的，四个人平摊。', context);
    expect(res.category).toBe('住宿');
    expect(res.amount).toBe(1200);
    expect(res.payers[0].memberName).toBe('我');
    expect(res.date).toBe('2026-09-16');
    expect(res.participants.length).toBe(4);
    expect(res.participants[0].share).toBe(300);
  });

  it('Example 5: 打车 76，我和 Amy 坐的，我付款', () => {
    const res = heuristicParseExpense('打车 76，我和 Amy 坐的，我付款。', context);
    expect(res.category).toBe('交通');
    expect(res.amount).toBe(76);
    expect(res.payers[0].memberName).toBe('我');
    expect(res.participants.length).toBe(2);
    const names = res.participants.map(p => p.memberName);
    expect(names).toContain('我');
    expect(names).toContain('Amy');
    expect(res.participants[0].share).toBe(38);
  });

  it('Example 6: 小王买门票花了 300，我、小王、小李三个人的', () => {
    const res = heuristicParseExpense('小王买门票花了 300，我、小王、小李三个人的。', context);
    expect(res.category).toBe('门票');
    expect(res.amount).toBe(300);
    expect(res.payers[0].memberName).toBe('小王');
    expect(res.participants.length).toBe(3);
    expect(res.participants[0].share).toBe(100);
  });

  it('Example 7: 便利店 135，我出了100，小李出了35，四个人平摊', () => {
    const res = heuristicParseExpense('便利店 135，我出了100，小李出了35，四个人平摊。', context);
    expect(res.category).toBe('超市');
    expect(res.amount).toBe(135);
    expect(res.payers.length).toBe(2);
    const p1 = res.payers.find(p => p.memberName === '我');
    const p2 = res.payers.find(p => p.memberName === '小李');
    expect(p1?.amount).toBe(100);
    expect(p2?.amount).toBe(35);
    expect(res.participants.length).toBe(4);
  });

  it('Example 8: 烤肉八万六韩元，我付，大家平摊', () => {
    const res = heuristicParseExpense('刚刚我们四个人吃烤肉花了八万六韩元，是我付的钱，大家平摊。', context);
    expect(res.category).toBe('餐饮');
    expect(res.amount).toBe(86000);
    expect(res.currency).toBe('KRW');
    expect(res.payers[0].memberName).toBe('我');
    expect(res.participants.length).toBe(4);
    expect(res.participants[0].share).toBe(21500);
  });

  it('Example 10: Advance payment: lyh应付我20元车票钱', () => {
    const res = heuristicParseExpense('lyh应付我20元车票钱', {
      ...context,
      members: [
        { id: 'm_lyy', tripId: 't1', name: 'lyy', isCurrentUser: true, avatarColor: '#3b82f6', createdAt: '' },
        { id: 'm_lyh', tripId: 't1', name: 'lyh', isCurrentUser: false, avatarColor: '#10b981', createdAt: '' },
      ],
    });
    expect(res.category).toBe('交通');
    expect(res.title).toBe('车票');
    expect(res.amount).toBe(20);
    expect(res.payers[0].memberName).toBe('lyy');
    expect(res.payers[0].amount).toBe(20);
    expect(res.participants[0].memberName).toBe('lyh');
    expect(res.participants[0].share).toBe(20);
  });

  it('Example 11: Advance payment: 我帮小李垫了100门票', () => {
    const res = heuristicParseExpense('我帮小李垫了100门票', context);
    expect(res.category).toBe('门票');
    expect(res.amount).toBe(100);
    expect(res.payers[0].memberName).toBe('我');
    expect(res.participants[0].memberName).toBe('小李');
    expect(res.participants[0].share).toBe(100);
  });

  it('Example 12: Advance payment: 小王欠我50饭钱', () => {
    const res = heuristicParseExpense('小王欠我50饭钱', context);
    expect(res.category).toBe('餐饮');
    expect(res.amount).toBe(50);
    expect(res.payers[0].memberName).toBe('我');
    expect(res.participants[0].memberName).toBe('小王');
    expect(res.participants[0].share).toBe(50);
  });
});


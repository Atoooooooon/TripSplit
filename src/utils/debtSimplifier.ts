import { Trip, TripMember, Expense, Settlement, DebtTransfer, MemberBalance, Currency, TripSummary } from '../types';
import { roundCurrency, formatMoney } from './math';

/**
 * Calculates member balances and minimized debt transfer suggestions,
 * as well as raw pairwise transfers (without multi-party simplification),
 * providing clear explanation for debt offsets.
 */
export function calculateBalancesAndTransfers(
  trip: Trip,
  expenses: Expense[] = [],
  settlements: Settlement[] = [],
  currentMemberId?: string
): {
  balances: MemberBalance[];
  suggestedTransfers: DebtTransfer[];
  rawTransfers: DebtTransfer[];
  summary: TripSummary;
} {
  const currency = trip.settlementCurrency;
  const members = trip.members || [];
  const memberMap = new Map(members.map(m => [m.id, m]));

  // Step 1: Calculate total paid and total share in settlement currency for each member
  const totalPaidMap = new Map<string, number>();
  const totalShareMap = new Map<string, number>();
  let totalExpense = 0;

  // Direct pairwise debt matrix: directDebtMatrix[debtorId][creditorId]
  const directDebtMatrix: Record<string, Record<string, number>> = {};
  members.forEach(m1 => {
    directDebtMatrix[m1.id] = {};
    members.forEach(m2 => {
      directDebtMatrix[m1.id][m2.id] = 0;
    });
  });

  members.forEach(m => {
    totalPaidMap.set(m.id, 0);
    totalShareMap.set(m.id, 0);
  });

  expenses.forEach(exp => {
    const expSettlementAmount = exp.settlementAmount || exp.amount;
    totalExpense += expSettlementAmount;

    const expTotal = exp.amount || 1;
    const ratio = expSettlementAmount / expTotal;

    exp.payers.forEach(payer => {
      const current = totalPaidMap.get(payer.memberId) || 0;
      const payerSettlement = payer.amount * ratio;
      totalPaidMap.set(payer.memberId, current + payerSettlement);
    });

    exp.participants.forEach(part => {
      const current = totalShareMap.get(part.memberId) || 0;
      const partSettlement = part.share * ratio;
      totalShareMap.set(part.memberId, current + partSettlement);
    });

    // Compute direct debts for this expense
    // If payer is P, and participant is M (where P !== M), M directly owes P (part.share * ratio * payer.amount / expTotal)
    exp.payers.forEach(payer => {
      const payerContributionRatio = (payer.amount || 0) / expTotal;
      exp.participants.forEach(part => {
        if (part.memberId !== payer.memberId) {
          const directAmount = (part.share * ratio) * payerContributionRatio;
          if (directDebtMatrix[part.memberId] && directDebtMatrix[part.memberId][payer.memberId] !== undefined) {
            directDebtMatrix[part.memberId][payer.memberId] += directAmount;
          }
        }
      });
    });
  });

  // Factor in existing settlements
  const settlementsPaidMap = new Map<string, number>();
  const settlementsReceivedMap = new Map<string, number>();

  members.forEach(m => {
    settlementsPaidMap.set(m.id, 0);
    settlementsReceivedMap.set(m.id, 0);
  });

  settlements.forEach(st => {
    const fromPaid = settlementsPaidMap.get(st.fromMemberId) || 0;
    settlementsPaidMap.set(st.fromMemberId, fromPaid + st.amount);

    const toReceived = settlementsReceivedMap.get(st.toMemberId) || 0;
    settlementsReceivedMap.set(st.toMemberId, toReceived + st.amount);

    // Settlement reduces direct debt from fromMemberId to toMemberId
    if (directDebtMatrix[st.fromMemberId] && directDebtMatrix[st.fromMemberId][st.toMemberId] !== undefined) {
      directDebtMatrix[st.fromMemberId][st.toMemberId] -= st.amount;
    }
  });

  // Step 2: Build MemberBalance list
  const balances: MemberBalance[] = members.map(m => {
    const paid = roundCurrency(totalPaidMap.get(m.id) || 0, currency);
    const share = roundCurrency(totalShareMap.get(m.id) || 0, currency);
    const stPaid = roundCurrency(settlementsPaidMap.get(m.id) || 0, currency);
    const stRecv = roundCurrency(settlementsReceivedMap.get(m.id) || 0, currency);

    const netBalance = roundCurrency((paid - share) + (stPaid - stRecv), currency);

    return {
      memberId: m.id,
      memberName: m.name,
      isCurrentUser: currentMemberId ? m.id === currentMemberId : !!m.isCurrentUser,
      avatarColor: m.avatarColor,
      totalPaid: paid,
      totalShare: share,
      netBalance,
    };
  });

  // Step 3A: Calculate Raw Pairwise Transfers (按单原始直还模式)
  const rawTransfers: DebtTransfer[] = [];
  const processedPairs = new Set<string>();

  for (let a = 0; a < members.length; a++) {
    for (let b = a + 1; b < members.length; b++) {
      const idA = members[a].id;
      const idB = members[b].id;
      const debtAtoB = directDebtMatrix[idA]?.[idB] || 0;
      const debtBtoA = directDebtMatrix[idB]?.[idA] || 0;
      const net = roundCurrency(debtAtoB - debtBtoA, currency);

      if (net > 0.001) {
        rawTransfers.push({
          fromMemberId: idA,
          fromMemberName: members[a].name,
          toMemberId: idB,
          toMemberName: members[b].name,
          amount: net,
          currency,
          isSimplified: false,
          originalDirectAmount: net,
        });
      } else if (net < -0.001) {
        rawTransfers.push({
          fromMemberId: idB,
          fromMemberName: members[b].name,
          toMemberId: idA,
          toMemberName: members[a].name,
          amount: -net,
          currency,
          isSimplified: false,
          originalDirectAmount: -net,
        });
      }
    }
  }

  // Step 3B: Calculate Minimized Debt Transfers (最简转账模式 - Min Cash Flow)
  interface BalanceNode {
    memberId: string;
    memberName: string;
    amount: number;
  }

  const debtors: BalanceNode[] = [];
  const creditors: BalanceNode[] = [];

  balances.forEach(b => {
    const bal = roundCurrency(b.netBalance, currency);
    if (bal < -0.001) {
      debtors.push({
        memberId: b.memberId,
        memberName: b.memberName,
        amount: -bal,
      });
    } else if (bal > 0.001) {
      creditors.push({
        memberId: b.memberId,
        memberName: b.memberName,
        amount: bal,
      });
    }
  });

  const suggestedTransfers: DebtTransfer[] = [];

  // Sort descending by amount to optimize greedy matching
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const transferAmount = roundCurrency(Math.min(debtor.amount, creditor.amount), currency);

    if (transferAmount > 0.001) {
      // Find original direct debt between this debtor and creditor
      const directAtoB = directDebtMatrix[debtor.memberId]?.[creditor.memberId] || 0;
      const directBtoA = directDebtMatrix[creditor.memberId]?.[debtor.memberId] || 0;
      const directNet = roundCurrency(directAtoB - directBtoA, currency);

      let explanation: string | undefined;
      if (directNet > 0 && Math.abs(transferAmount - directNet) > 0.01) {
        if (transferAmount > directNet) {
          const delta = roundCurrency(transferAmount - directNet, currency);
          explanation = `含本人应付 ${formatMoney(directNet, currency)} + 帮其他同伴转付 ${formatMoney(delta, currency)}（转这一笔即可全部结清，不用分别转多人）`;
        } else {
          const delta = roundCurrency(directNet - transferAmount, currency);
          explanation = `原应转出 ${formatMoney(directNet, currency)}，经大家互相抵消后，只要转 ${formatMoney(transferAmount, currency)} 即可（少转了 ${formatMoney(delta, currency)}）`;
        }
      } else if (directNet <= 0) {
        explanation = `大家互相抵消后的合并转账（直接转给这位朋友即可结清，不用再转给原本的垫付人）`;
      }

      suggestedTransfers.push({
        fromMemberId: debtor.memberId,
        fromMemberName: debtor.memberName,
        toMemberId: creditor.memberId,
        toMemberName: creditor.memberName,
        amount: transferAmount,
        currency,
        isSimplified: true,
        originalDirectAmount: directNet > 0 ? directNet : 0,
        explanation,
      });
    }

    debtor.amount = roundCurrency(debtor.amount - transferAmount, currency);
    creditor.amount = roundCurrency(creditor.amount - transferAmount, currency);

    if (debtor.amount <= 0.001) {
      i++;
    }
    if (creditor.amount <= 0.001) {
      j++;
    }
  }

  // Step 4: Calculate current user's summary metrics
  const currentUser = (currentMemberId ? members.find(m => m.id === currentMemberId) : null) || members.find(m => m.isCurrentUser) || members[0];
  const currentBalance = currentUser ? balances.find(b => b.memberId === currentUser.id) : null;

  const summary: TripSummary = {
    totalExpense: roundCurrency(totalExpense, currency),
    myPaid: currentBalance ? currentBalance.totalPaid : 0,
    myShare: currentBalance ? currentBalance.totalShare : 0,
    myNetBalance: currentBalance ? currentBalance.netBalance : 0,
    billCount: expenses.length,
    memberCount: members.length,
  };

  return {
    balances,
    suggestedTransfers,
    rawTransfers,
    summary,
  };
}

export interface ExpenseDebtorInfo {
  memberId: string;
  memberName: string;
  avatarColor: string;
  isCurrentUser: boolean;
  initialOwed: number;   // In expense currency
  settledAmount: number; // In expense currency
  remainingOwed: number; // In expense currency
  isSettled: boolean;
}

export interface ExpenseDebtorBreakdown {
  expenseId: string;
  payerId: string | null;
  payerName: string;
  payerMember: TripMember | null;
  debtors: ExpenseDebtorInfo[];
  unsettledCount: number;
  isFullySettled: boolean;
  canQuickSettle: boolean;
}

/**
 * Calculates per-participant bill debt relationships and settlement status for a specific expense.
 */
export function getExpenseDebtorBreakdown(
  expense: Expense,
  settlements: Settlement[] = [],
  members: TripMember[] = [],
  currentMemberId?: string
): ExpenseDebtorBreakdown {
  const currency = expense.currency;
  const primaryPayer = (expense.payers && expense.payers.length > 0)
    ? expense.payers.reduce((max, p) => (p.amount > (max?.amount || 0) ? p : max), expense.payers[0])
    : null;
  const payerId = primaryPayer?.memberId || null;
  const payerMember = members.find(m => m.id === payerId) || null;
  const payerName = payerMember
    ? (payerMember.id === currentMemberId ? '我' : payerMember.name)
    : '垫付方';

  const memberMap = new Map(members.map(m => [m.id, m]));
  const debtors: ExpenseDebtorInfo[] = [];

  (expense.participants || []).forEach(p => {
    const upfrontPaid = expense.payers?.find(payer => payer.memberId === p.memberId)?.amount || 0;
    const initialOwed = roundCurrency(Math.max(0, p.share - upfrontPaid), currency);

    // If initialOwed > 0.01, this participant owes money on this bill
    if (initialOwed > 0.01) {
      // Match settlements specifically recorded for this expense from this debtor
      const settledAmount = roundCurrency(
        settlements
          .filter(s => {
            const matchesExpense =
              s.expenseId === expense.id ||
              (s.note && s.note.includes(`结清此单: ${expense.title}`)) ||
              (s.note && s.note.includes(expense.title));
            const matchesDebtor = s.fromMemberId === p.memberId;
            const matchesCreditor = !payerId || s.toMemberId === payerId;
            return matchesExpense && matchesDebtor && matchesCreditor;
          })
          .reduce((sum, s) => sum + s.amount, 0),
        currency
      );

      const remainingOwed = roundCurrency(Math.max(0, initialOwed - settledAmount), currency);
      const isSettled = remainingOwed <= 0.01;
      const mem = memberMap.get(p.memberId);

      debtors.push({
        memberId: p.memberId,
        memberName: mem ? mem.name : '成员',
        avatarColor: mem ? mem.avatarColor : '#6b7280',
        isCurrentUser: p.memberId === currentMemberId,
        initialOwed,
        settledAmount,
        remainingOwed,
        isSettled,
      });
    }
  });

  const unsettledCount = debtors.filter(d => !d.isSettled).length;
  const isFullySettled = debtors.length > 0 && unsettledCount === 0;
  // Can quick settle if there are debtors and at least one is not yet settled
  const canQuickSettle = debtors.length > 0 && !isFullySettled;

  return {
    expenseId: expense.id,
    payerId,
    payerName,
    payerMember,
    debtors,
    unsettledCount,
    isFullySettled,
    canQuickSettle,
  };
}

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Trip, Expense, AiExpenseDraft, DebtTransfer, Currency, TripMember } from './types';
import {
  fetchTrips,
  joinTripByCode,
  fetchTrip,
  createTrip,
  addTripMember,
  removeTripMember,
  updateTripMember,
  createExpense,
  updateExpense,
  deleteExpense,
  recordSettlement,
  deleteSettlement,
  parseNaturalLanguageExpense,
  getSettings,
  deleteTrip,
} from './services/api';
import { calculateBalancesAndTransfers } from './utils/debtSimplifier';
import { Navbar } from './components/Navbar';
import { TripSummaryHeader } from './components/TripSummaryHeader';
import { TabNav, TabType } from './components/TabNav';
import { ExpenseTimeline } from './components/ExpenseTimeline';
import { StatisticsView } from './components/StatisticsView';
import { SettlementView } from './components/SettlementView';
import { MembersView } from './components/MembersView';
import { AiExpenseBar } from './components/AiExpenseBar';
import { AiConfirmCard } from './components/AiConfirmCard';
import { ExpenseDetailModal } from './components/ExpenseDetailModal';
import { CreateTripModal } from './components/CreateTripModal';
import { TripSwitcherModal } from './components/TripSwitcherModal';
import { SettingsModal } from './components/SettingsModal';
import { PerspectiveModal } from './components/PerspectiveModal';
import { ClaimIdentityModal } from './components/ClaimIdentityModal';
import { ShareTripModal } from './components/ShareTripModal';
import { DevAuthModal } from './components/DevAuthModal';
import { WelcomeView } from './components/WelcomeView';
import { QuickSettleModal } from './components/QuickSettleModal';

export const App: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string>('');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);

  // Modals & Drawers
  const [aiDraft, setAiDraft] = useState<AiExpenseDraft | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isCreateTripOpen, setIsCreateTripOpen] = useState<boolean>(false);
  const [isTripSwitcherOpen, setIsTripSwitcherOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDevAuthOpen, setIsDevAuthOpen] = useState<boolean>(false);
  const [isPerspectiveOpen, setIsPerspectiveOpen] = useState<boolean>(false);
  const [isClaimIdentityOpen, setIsClaimIdentityOpen] = useState<boolean>(false);
  const [hasDeepSeekKey, setHasDeepSeekKey] = useState<boolean>(false);

  // Share Trip Modal state
  const [shareModalTrip, setShareModalTrip] = useState<Trip | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isNewlyCreatedTrip, setIsNewlyCreatedTrip] = useState<boolean>(false);

  // Quick Settle Target for one-click settling from expense list
  const [quickSettleTarget, setQuickSettleTarget] = useState<{
    expense: Expense;
    payer: TripMember;
    amount: number;
  } | null>(null);

  // AI clarification state for incomplete prompts
  const [clarificationState, setClarificationState] = useState<{
    needed: boolean;
    question?: string;
    options?: string[];
    history: Array<{ role: string; content: string }>;
  } | null>(null);

  // Check settings
  const checkSettings = useCallback(async () => {
    try {
      const data = await getSettings();
      setHasDeepSeekKey(data.hasDeepSeekKey);
    } catch (e) {
      console.warn('Failed to load settings', e);
    }
  }, []);

  // Code Isolation: local storage helpers for joined trip access codes
  const getStoredJoinedCodes = (): string[] => {
    try {
      const raw = localStorage.getItem('tripsplit_joined_codes');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn(e);
    }
    return [];
  };

  const addStoredJoinedCode = (code: string) => {
    try {
      const list = getStoredJoinedCodes();
      const upper = code.trim().toUpperCase();
      if (!list.includes(upper)) {
        list.push(upper);
        localStorage.setItem('tripsplit_joined_codes', JSON.stringify(list));
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const removeStoredJoinedCode = (code: string) => {
    try {
      const upper = code.trim().toUpperCase();
      const list = getStoredJoinedCodes().filter(c => c !== upper);
      localStorage.setItem('tripsplit_joined_codes', JSON.stringify(list));
    } catch (e) {
      console.warn(e);
    }
  };

  // Sync current user perspective from localStorage, or prompt identity claim if no local record
  const syncPerspective = (trip: Trip, promptIfUnset = false) => {
    const saved = localStorage.getItem(`tripsplit_perspective_${trip.id}`);
    const valid = saved ? trip.members.find(m => m.id === saved) : null;
    if (valid) {
      setCurrentMemberId(valid.id);
      setIsClaimIdentityOpen(false);
    } else {
      // Local storage has no record for this device in this trip: prompt identity claim!
      setCurrentMemberId(trip.members[0]?.id || '');
      if (promptIfUnset) {
        setIsClaimIdentityOpen(true);
      }
    }
  };

  const handleClaimIdentity = (memberId: string) => {
    if (!activeTrip) return;
    localStorage.setItem(`tripsplit_perspective_${activeTrip.id}`, memberId);
    setCurrentMemberId(memberId);
    setIsClaimIdentityOpen(false);
  };

  const handleAddAndClaimIdentity = async (name: string) => {
    if (!activeTrip) return;
    const newMemberId = await addTripMember(activeTrip.id, name);
    localStorage.setItem(`tripsplit_perspective_${activeTrip.id}`, newMemberId);
    setCurrentMemberId(newMemberId);
    setIsClaimIdentityOpen(false);
    await refreshActiveTrip();
  };

  // Load all trips matching joined access codes
  const loadTrips = useCallback(async (selectTripId?: string, silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const codes = getStoredJoinedCodes();

      // Parallelize fetching trip list and trip detail when selectTripId is provided
      if (selectTripId) {
        setActiveTripId(selectTripId);
        const [list, detail] = await Promise.all([
          codes.length > 0 ? fetchTrips(codes) : Promise.resolve([]),
          fetchTrip(selectTripId),
        ]);
        setTrips(list);
        setActiveTrip(detail);
        syncPerspective(detail, true);
      } else {
        const list = codes.length > 0 ? await fetchTrips(codes) : [];
        setTrips(list);
        if (!silent) {
          setActiveTripId('');
          setActiveTrip(null);
        }
      }
    } catch (err) {
      console.error('Failed to load trips', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSettings();

    const initApp = async () => {
      // 1. Check if user opened an invitation link with ?code=XXXX
      const urlParams = new URLSearchParams(window.location.search);
      const codeParam = urlParams.get('code');
      if (codeParam) {
        const cleanCode = codeParam.trim().toUpperCase();
        try {
          const joined = await joinTripByCode(cleanCode);
          addStoredJoinedCode(joined.accessCode);
          sessionStorage.setItem('tripsplit_active_trip_id', joined.tripId);
          await loadTrips(joined.tripId);
          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch (e) {}
          return;
        } catch (e) {
          console.warn('Auto join by URL code failed:', e);
        }
      }

      // 2. Check if user was viewing an active trip in this tab/session
      const sessionTripId = sessionStorage.getItem('tripsplit_active_trip_id');
      if (sessionTripId) {
        try {
          await loadTrips(sessionTripId);
          return;
        } catch (e) {
          console.warn('Reload session trip failed:', e);
        }
      }

      // 3. Normal initial landing: show starting/welcome page
      await loadTrips();
    };

    initApp();
  }, []);

  // Reload current active trip (silent by default for polling / foreground sync)
  const refreshActiveTrip = useCallback(async (silent = false) => {
    if (!activeTripId) return;
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (!silent) setIsSyncing(true);

    try {
      const detail = await fetchTrip(activeTripId);
      if (detail && detail.id === activeTripId) {
        setActiveTrip(detail);
        syncPerspective(detail, false);
      }
    } catch (e) {
      console.error('Failed to refresh trip', e);
    } finally {
      isSyncingRef.current = false;
      if (!silent) {
        setTimeout(() => setIsSyncing(false), 300);
      }
    }
  }, [activeTripId]);

  // Background polling & foreground wake-up synchronization
  useEffect(() => {
    if (!activeTripId) {
      // When on welcome/home screen, refresh trips list when user comes back
      const handleHomeVisibility = () => {
        if (document.visibilityState === 'visible') {
          loadTrips(undefined, true);
        }
      };
      document.addEventListener('visibilitychange', handleHomeVisibility);
      return () => {
        document.removeEventListener('visibilitychange', handleHomeVisibility);
      };
    }

    // 1. Polling interval: sync every 4.5 seconds if tab is visible and no blocking edit is open
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !editingExpense && !aiDraft) {
        refreshActiveTrip(true);
      }
    }, 4500);

    // 2. Immediate sync when user switches back to this tab / browser app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshActiveTrip(true);
      }
    };

    // 3. Immediate sync on window focus
    const handleWindowFocus = () => {
      refreshActiveTrip(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [activeTripId, editingExpense, aiDraft, refreshActiveTrip, loadTrips]);

  const handleSelectTrip = async (tripId: string) => {
    sessionStorage.setItem('tripsplit_active_trip_id', tripId);
    setActiveTripId(tripId);
    setIsLoading(true);
    try {
      const detail = await fetchTrip(tripId);
      setActiveTrip(detail);
      syncPerspective(detail, true);
      setClarificationState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoHome = () => {
    sessionStorage.removeItem('tripsplit_active_trip_id');
    setActiveTripId('');
    setActiveTrip(null);
    setClarificationState(null);
    loadTrips();
  };

  const handleSelectPerspective = (memberId: string) => {
    setCurrentMemberId(memberId);
    if (activeTrip) {
      localStorage.setItem(`tripsplit_perspective_${activeTrip.id}`, memberId);
    }
  };

  const handleRenameMember = async (memberId: string, newName: string) => {
    if (!activeTrip) return;
    try {
      await updateTripMember(activeTrip.id, memberId, newName);
      await refreshActiveTrip();
    } catch (err: any) {
      alert(`修改名字失败: ${err.message}`);
    }
  };

  // AI parsing
  const handleAiParse = async (
    text: string,
    history: Array<{ role: string; content: string }> = []
  ) => {
    if (!activeTrip) return;
    setIsAiLoading(true);

    try {
      const newHistory = [...history, { role: 'user', content: text }];
      const draft = await parseNaturalLanguageExpense(
        text,
        activeTrip.id,
        newHistory,
        currentMemberId
      );

      if (draft.needClarification) {
        setClarificationState({
          needed: true,
          question: draft.clarificationQuestion,
          options: draft.clarificationOptions,
          history: [
            ...newHistory,
            { role: 'assistant', content: draft.clarificationQuestion || '' },
          ],
        });
      } else {
        setClarificationState(null);
        setAiDraft(draft);
      }
    } catch (err: any) {
      alert(`AI 解析失败: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Confirm and save AI draft (Expense)
  const handleConfirmAiDraft = async (finalData: any) => {
    if (!activeTrip) return;
    try {
      await createExpense(activeTrip.id, finalData);
      setAiDraft(null);
      await refreshActiveTrip();
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    }
  };

  // Settle transfer
  const handleSettleTransfer = async (transfer: DebtTransfer) => {
    if (!activeTrip) return;
    try {
      await recordSettlement(activeTrip.id, {
        fromMemberId: transfer.fromMemberId,
        toMemberId: transfer.toMemberId,
        amount: transfer.amount,
        currency: transfer.currency,
        note: `${transfer.fromMemberName} 结清给 ${transfer.toMemberName}`,
      });
      await refreshActiveTrip();
    } catch (err: any) {
      alert(`结清失败: ${err.message}`);
    }
  };

  // Quick settle a single expense (dedicated shortcut to settlement module)
  const handleQuickSettleExpense = (exp: Expense, payerId: string, myShare: number) => {
    if (!activeTrip) return;
    const payer = activeTrip.members.find(m => m.id === payerId);
    if (!payer) return;
    setQuickSettleTarget({
      expense: exp,
      payer,
      amount: myShare,
    });
  };

  const handleExecuteQuickSettle = async (data: {
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    currency: Currency;
    note: string;
  }) => {
    if (!activeTrip) return;
    await recordSettlement(activeTrip.id, data);
    await refreshActiveTrip();
  };

  // Delete settlement
  const handleDeleteSettlement = async (settlementId: string) => {
    try {
      await deleteSettlement(settlementId);
      await refreshActiveTrip();
    } catch (err: any) {
      alert(`撤销失败: ${err.message}`);
    }
  };

  // Add member
  const handleAddMember = async (name: string) => {
    if (!activeTrip) return;
    try {
      await addTripMember(activeTrip.id, name);
      await refreshActiveTrip();
    } catch (err: any) {
      alert(`添加成员失败: ${err.message}`);
    }
  };

  // Remove member
  const handleRemoveMember = async (memberId: string) => {
    if (!activeTrip) return;
    try {
      await removeTripMember(activeTrip.id, memberId);
      await refreshActiveTrip();
    } catch (err: any) {
      alert(`移除成员失败: ${err.message}`);
    }
  };

  // Delete expense
  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      await refreshActiveTrip();
    } catch (err: any) {
      alert(`删除账单失败: ${err.message}`);
    }
  };

  // Save edited expense
  const handleSaveEditedExpense = async (updated: Partial<Expense>) => {
    if (!updated.id) return;
    try {
      await updateExpense(updated.id, updated);
      await refreshActiveTrip();
    } catch (err: any) {
      alert(`保存修改失败: ${err.message}`);
    }
  };

  // Open share modal
  const handleOpenShare = (trip: Trip, isNew: boolean = false) => {
    setShareModalTrip(trip);
    setIsNewlyCreatedTrip(isNew);
    setIsShareModalOpen(true);
  };

  // Delete trip completely
  const handleDeleteTrip = async (tripId: string, accessCode: string) => {
    await deleteTrip(tripId);
    removeStoredJoinedCode(accessCode);
    localStorage.removeItem(`tripsplit_perspective_${tripId}`);
    if (activeTripId === tripId) {
      sessionStorage.removeItem('tripsplit_active_trip_id');
      setActiveTripId('');
      setActiveTrip(null);
    }
    await loadTrips();
  };

  // Create new trip
  const handleCreateTrip = async (tripData: any) => {
    const res = await createTrip(tripData);
    if (res.accessCode) {
      addStoredJoinedCode(res.accessCode);
    }
    sessionStorage.setItem('tripsplit_active_trip_id', res.tripId);
    // Pre-save creator's perspective so creator is already bound on this device
    try {
      const detail = await fetchTrip(res.tripId);
      const creator = detail.members.find(m => m.isCurrentUser) || detail.members[0];
      if (creator) {
        localStorage.setItem(`tripsplit_perspective_${res.tripId}`, creator.id);
        setCurrentMemberId(creator.id);
        setIsClaimIdentityOpen(false);
      }
      await loadTrips(res.tripId);

      // Auto pop-up share modal so user immediately gets the share link!
      handleOpenShare(detail, true);
    } catch (e) {
      console.warn('Pre-save creator perspective failed', e);
      await loadTrips(res.tripId);
    }
  };

  // Join trip by code
  const handleJoinTripByCode = async (code: string) => {
    const res = await joinTripByCode(code.trim().toUpperCase());
    addStoredJoinedCode(res.accessCode);
    sessionStorage.setItem('tripsplit_active_trip_id', res.tripId);
    await loadTrips(res.tripId);
  };

  const effectiveTrip = useMemo(() => {
    if (!activeTrip) return null;
    return {
      ...activeTrip,
      members: activeTrip.members.map(m => ({
        ...m,
        isCurrentUser: currentMemberId ? m.id === currentMemberId : false,
      })),
    };
  }, [activeTrip, currentMemberId]);

  // Calculate balances & debt simplification
  const { balances, suggestedTransfers, rawTransfers, summary } = effectiveTrip
    ? calculateBalancesAndTransfers(
        effectiveTrip,
        effectiveTrip.expenses || [],
        effectiveTrip.settlements || [],
        currentMemberId
      )
    : {
        balances: [],
        suggestedTransfers: [],
        rawTransfers: [],
        summary: {
          totalExpense: 0,
          myPaid: 0,
          myShare: 0,
          myNetBalance: 0,
          billCount: 0,
          memberCount: 0,
        },
      };

  const currentMember = effectiveTrip?.members.find(m => m.id === currentMemberId) || effectiveTrip?.members[0] || null;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col selection:bg-neutral-900 selection:text-white pb-32 pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* Top Navigation */}
      <Navbar
        currentTrip={effectiveTrip}
        currentMember={currentMember}
        isSyncing={isSyncing}
        onRefresh={() => refreshActiveTrip(false)}
        onOpenTripSwitcher={() => setIsTripSwitcherOpen(true)}
        onOpenCreateTrip={() => setIsCreateTripOpen(true)}
        onOpenPerspective={() => setIsPerspectiveOpen(true)}
        onOpenDevAuth={() => setIsDevAuthOpen(true)}
        onOpenShare={() => effectiveTrip && handleOpenShare(effectiveTrip, false)}
        onGoHome={handleGoHome}
      />

      {isLoading && !effectiveTrip && trips.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-24">
          <div className="text-center space-y-3">
            <div className="text-3xl animate-bounce">✈️</div>
            <p className="text-xs text-neutral-400 font-medium">正在准备 TripSplit 账本...</p>
          </div>
        </div>
      ) : effectiveTrip ? (
        <main className="flex-1 max-w-4xl w-full mx-auto">
          {/* Header Summary Cards */}
          <TripSummaryHeader
            trip={effectiveTrip}
            summary={summary}
            onOpenSettlement={() => setActiveTab('settlement')}
          />

          {/* 4 Navigation Tabs */}
          <TabNav
            activeTab={activeTab}
            onChangeTab={tab => {
              setActiveTab(tab);
              refreshActiveTrip(true);
            }}
            pendingTransferCount={suggestedTransfers.length}
          />

          {/* Tab Views */}
          <div className="p-4">
            {activeTab === 'expenses' && (
              <ExpenseTimeline
                expenses={effectiveTrip.expenses || []}
                settlements={effectiveTrip.settlements || []}
                members={effectiveTrip.members}
                settlementCurrency={effectiveTrip.settlementCurrency}
                currentMemberId={currentMemberId}
                onEditExpense={exp => setEditingExpense(exp)}
                onDeleteExpense={handleDeleteExpense}
                onDeleteSettlement={handleDeleteSettlement}
                onQuickSettleExpense={handleQuickSettleExpense}
              />
            )}

            {activeTab === 'statistics' && (
              <StatisticsView
                trip={effectiveTrip}
                expenses={effectiveTrip.expenses || []}
                balances={balances}
              />
            )}

            {activeTab === 'settlement' && (
              <SettlementView
                trip={effectiveTrip}
                balances={balances}
                suggestedTransfers={suggestedTransfers}
                rawTransfers={rawTransfers}
                settlements={effectiveTrip.settlements || []}
                onSettleTransfer={handleSettleTransfer}
                onDeleteSettlement={handleDeleteSettlement}
              />
            )}

            {activeTab === 'members' && (
              <MembersView
                trip={effectiveTrip}
                balances={balances}
                onRenameMember={handleRenameMember}
                onAddMember={handleAddMember}
                onRemoveMember={handleRemoveMember}
              />
            )}
          </div>

          {/* AI Expense Chat Bar (Docked at Bottom) */}
          <AiExpenseBar
            onParse={handleAiParse}
            isLoading={isAiLoading}
            members={effectiveTrip.members}
            clarificationState={clarificationState}
            onClearClarification={() => setClarificationState(null)}
          />
        </main>
      ) : (
        <WelcomeView
          trips={trips}
          onOpenCreateTrip={() => setIsCreateTripOpen(true)}
          onJoinByCode={handleJoinTripByCode}
          onSelectTrip={handleSelectTrip}
          onOpenShare={trip => handleOpenShare(trip, false)}
          onDeleteTrip={handleDeleteTrip}
        />
      )}

      {/* Perspective Switcher Modal */}
      {isPerspectiveOpen && effectiveTrip && (
        <PerspectiveModal
          members={effectiveTrip.members}
          currentMemberId={currentMemberId}
          onSelectMember={handleSelectPerspective}
          onRenameMember={handleRenameMember}
          onClose={() => setIsPerspectiveOpen(false)}
        />
      )}

      {/* Claim Identity Modal (shown when room entered without local identity record) */}
      {isClaimIdentityOpen && effectiveTrip && (
        <ClaimIdentityModal
          trip={effectiveTrip}
          onClaim={handleClaimIdentity}
          onAddAndClaim={handleAddAndClaimIdentity}
          onClose={() => setIsClaimIdentityOpen(false)}
        />
      )}

      {/* AI Confirm Card Modal */}
      {aiDraft && effectiveTrip && (
        <AiConfirmCard
          draft={aiDraft}
          members={effectiveTrip.members}
          currentMemberId={currentMemberId}
          settlementCurrency={effectiveTrip.settlementCurrency}
          onConfirm={handleConfirmAiDraft}
          onCancel={() => setAiDraft(null)}
        />
      )}

      {/* Quick Settle Modal (shortcut to settlement module) */}
      {quickSettleTarget && effectiveTrip && (
        <QuickSettleModal
          expense={quickSettleTarget.expense}
          payer={quickSettleTarget.payer}
          currentMember={currentMember}
          amount={quickSettleTarget.amount}
          settlementCurrency={effectiveTrip.settlementCurrency}
          onConfirm={handleExecuteQuickSettle}
          onClose={() => setQuickSettleTarget(null)}
        />
      )}

      {/* Edit Expense Modal */}
      {editingExpense && effectiveTrip && (
        <ExpenseDetailModal
          expense={editingExpense}
          members={effectiveTrip.members}
          currentMemberId={currentMemberId}
          settlementCurrency={effectiveTrip.settlementCurrency}
          onSave={handleSaveEditedExpense}
          onDelete={handleDeleteExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {/* Create Trip Modal */}
      {isCreateTripOpen && (
        <CreateTripModal
          onClose={() => setIsCreateTripOpen(false)}
          onCreate={handleCreateTrip}
        />
      )}

      {/* Trip Switcher Modal */}
      {isTripSwitcherOpen && (
        <TripSwitcherModal
          trips={trips}
          activeTripId={activeTripId}
          onSelectTrip={handleSelectTrip}
          onJoinByCode={handleJoinTripByCode}
          onOpenCreateTrip={() => {
            setIsTripSwitcherOpen(false);
            setIsCreateTripOpen(true);
          }}
          onOpenShare={trip => handleOpenShare(trip, false)}
          onDeleteTrip={handleDeleteTrip}
          onClose={() => setIsTripSwitcherOpen(false)}
        />
      )}

      {/* Share Trip Modal */}
      {isShareModalOpen && shareModalTrip && (
        <ShareTripModal
          trip={shareModalTrip}
          isNewlyCreated={isNewlyCreatedTrip}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}

      {/* Developer Auth Modal */}
      {isDevAuthOpen && (
        <DevAuthModal
          onSuccess={() => {
            setIsDevAuthOpen(false);
            setIsSettingsOpen(true);
          }}
          onClose={() => setIsDevAuthOpen(false)}
        />
      )}

      {/* Settings Modal (only accessible via Developer Mode) */}
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onKeyUpdated={checkSettings}
        />
      )}
    </div>
  );
};

export default App;

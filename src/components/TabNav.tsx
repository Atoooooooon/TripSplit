import React from 'react';
import { Receipt, PieChart, Scale, Users } from 'lucide-react';

export type TabType = 'expenses' | 'statistics' | 'settlement' | 'members';

interface TabNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  pendingTransferCount?: number;
}

export const TabNav: React.FC<TabNavProps> = ({
  activeTab,
  onChangeTab,
  pendingTransferCount = 0,
}) => {
  const tabs = [
    { id: 'expenses', label: '账单', icon: Receipt },
    { id: 'statistics', label: '统计', icon: PieChart },
    { id: 'settlement', label: '结算', icon: Scale, badge: pendingTransferCount },
    { id: 'members', label: '成员', icon: Users },
  ];

  return (
    <div className="bg-white border-b border-neutral-200/80 px-4">
      <div className="max-w-4xl mx-auto flex items-center gap-1 sm:gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id as TabType)}
              className={`relative flex items-center gap-1.5 py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? 'border-neutral-900 text-neutral-900 font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && tab.badge > 0 ? (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};

import React from 'react';
import { X, Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../utils/chartMath';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const topTraders = [
    { rank: 1, name: 'Alexandre_V', country: '🇧🇷 Brazil', profit: 42890.5, winRate: '89.4%' },
    { rank: 2, name: 'Tariq_Trader_PK', country: '🇵🇰 Pakistan', profit: 34120.0, winRate: '87.1%' },
    { rank: 3, name: 'Hiroshi_FX', country: '🇯🇵 Japan', profit: 28450.2, winRate: '84.8%' },
    { rank: 4, name: 'Viktor_M', country: '🇩🇪 Germany', profit: 21300.0, winRate: '82.5%' },
    { rank: 5, name: 'AlphaTrade_Pro', country: '🇬🇧 UK', profit: 18950.4, winRate: '81.2%' },
    { rank: 6, name: 'Sultan_Crypto', country: '🇦🇪 UAE', profit: 16400.0, winRate: '79.9%' },
    { rank: 7, name: 'David_Scalp', country: '🇺🇸 USA', profit: 14220.8, winRate: '78.3%' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#111723] border border-[#232f45] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f2a3d] bg-[#141b29]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Top Traders Leaderboard
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  DAILY CUP
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Top performers of today's binary market sessions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1f283a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[70vh] space-y-2">
          {topTraders.map((trader) => {
            const isTop3 = trader.rank <= 3;
            return (
              <div
                key={trader.rank}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  trader.rank === 1
                    ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                    : trader.rank === 2
                    ? 'bg-slate-800/40 border-slate-400/30 text-slate-200'
                    : trader.rank === 3
                    ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
                    : 'bg-[#151c2a] border-[#222e42] text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs font-mono-num">
                    {trader.rank === 1 ? (
                      <Medal className="w-5 h-5 text-amber-400" />
                    ) : trader.rank === 2 ? (
                      <Medal className="w-5 h-5 text-slate-300" />
                    ) : trader.rank === 3 ? (
                      <Medal className="w-5 h-5 text-amber-600" />
                    ) : (
                      <span className="text-slate-500">#{trader.rank}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-white flex items-center gap-1.5">
                      {trader.name}
                      <span className="text-[10px] text-slate-400">{trader.country}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Win Rate: {trader.winRate}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-extrabold font-mono-num text-emerald-400">
                    +{formatCurrency(trader.profit)}
                  </div>
                  <div className="text-[10px] text-slate-500">Today's Profit</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

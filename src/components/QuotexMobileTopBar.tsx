import React, { useState } from 'react';
import { useTrading } from '../context/TradingContext';
import { FoxLogo } from './FoxLogo';
import {
  Bell,
  ChevronDown,
  RotateCcw,
  X,
  CreditCard,
  History,
  Wifi,
  Sparkles
} from 'lucide-react';
import { formatCurrency } from '../utils/chartMath';

interface QuotexMobileTopBarProps {
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenHistory: () => void;
  onOpenNotifications: () => void;
}

export const QuotexMobileTopBar: React.FC<QuotexMobileTopBarProps> = ({
  onOpenDeposit,
  onOpenWithdraw,
  onOpenHistory,
  onOpenNotifications
}) => {
  const {
    accountType,
    setAccountType,
    demoBalance,
    realBalance,
    resetDemoBalance,
    marketBehaviorMode
  } = useTrading();

  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showPromoBanner, setShowPromoBanner] = useState(true);

  return (
    <div className="flex flex-col z-30 select-none bg-[#0a0d14]">
      {/* 1. Header Row with Trade Fox Brand */}
      <div className="h-13 px-2.5 sm:px-3 flex items-center justify-between border-b border-[#18212f]">
        {/* Left Side: Fox Brand + Account Selector */}
        <div className="flex items-center gap-2">
          {/* Trade Fox Brand Badge with Fox Logo */}
          <div className="flex items-center gap-1.5 pr-1 border-r border-[#1e2738]/80 hidden xs:flex">
            <FoxLogo size={24} glow={true} />
            <span className="text-xs font-black tracking-wider text-orange-400 hidden sm:inline">
              TRADE FOX
            </span>
          </div>

          {/* Account Selector Pill (🎓 DEMO $10,000.00 ▾ or 💵 LIVE $500.00 ▾) */}
          <div className="relative">
            <button
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="flex items-center gap-1.5 bg-[#141b27] hover:bg-[#1a2333] border border-[#232f44] rounded-xl px-2 sm:px-2.5 py-1.5 transition-colors cursor-pointer"
            >
              <span className="text-xs sm:text-sm">{accountType === 'REAL' ? '💵' : '🎓'}</span>
              <span
                className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${
                  accountType === 'REAL' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {accountType === 'REAL' ? 'LIVE' : 'DEMO'}
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono-num text-white">
                {accountType === 'REAL'
                  ? formatCurrency(realBalance)
                  : formatCurrency(demoBalance)}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {/* Account Dropdown */}
            {showAccountDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/20"
                  onClick={() => setShowAccountDropdown(false)}
                />
                <div className="absolute left-0 mt-2 w-64 bg-[#141b26] border border-[#273245] rounded-xl shadow-2xl p-3 z-50 animate-scaleUp">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-2">
                  Switch Trading Account
                </div>

                {/* Demo Account */}
                <div
                  onClick={() => {
                    setAccountType('DEMO');
                    setShowAccountDropdown(false);
                  }}
                  className={`p-2.5 rounded-lg border mb-2 cursor-pointer transition-colors ${
                    accountType === 'DEMO'
                      ? 'bg-[#1b263b] border-cyan-500 text-white'
                      : 'bg-[#151c2a] border-[#222e42] text-slate-300 hover:bg-[#1b2536]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300">🎓 Demo Account</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resetDemoBalance();
                      }}
                      className="p-1 rounded hover:bg-[#283850] text-slate-400 hover:text-cyan-300"
                      title="Reset to $10,000"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-base font-extrabold font-mono-num text-white mt-1">
                    {formatCurrency(demoBalance)}
                  </div>
                </div>

                {/* Live Account (Changed from Real to LIVE) */}
                <div
                  onClick={() => {
                    setAccountType('REAL');
                    setShowAccountDropdown(false);
                  }}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    accountType === 'REAL'
                      ? 'bg-[#1b263b] border-emerald-500 text-white'
                      : 'bg-[#151c2a] border-[#222e42] text-slate-300 hover:bg-[#1b2536]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">💵 Live Account</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-black tracking-wider">
                      LIVE
                    </span>
                  </div>
                  <div className="text-base font-extrabold font-mono-num text-white mt-1">
                    {formatCurrency(realBalance)}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-[#222c3d] flex gap-2">
                  <button
                    onClick={() => {
                      setShowAccountDropdown(false);
                      onOpenDeposit();
                    }}
                    className="flex-1 py-1.5 bg-[#00e599] hover:bg-[#00d084] rounded-lg text-xs font-black text-slate-950 transition-colors"
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() => {
                      setShowAccountDropdown(false);
                      onOpenWithdraw();
                    }}
                    className="flex-1 py-1.5 bg-[#1f2838] hover:bg-[#28354a] rounded-lg text-xs font-bold text-slate-200 transition-colors"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>

        {/* Right side: Bell icon with badge + Deposit button */}
        <div className="flex items-center gap-2">
          {/* Notification Bell with red badge 1 (Matches screenshot: 🔔 1) */}
          <button
            onClick={onOpenNotifications}
            className="relative w-8 h-8 rounded-lg bg-[#141b27] border border-[#232f44] flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              1
            </span>
          </button>

          {/* Deposit Button (Matches screenshot: Green solid button) */}
          <button
            onClick={onOpenDeposit}
            className="px-4 py-1.5 rounded-lg bg-[#00e599] hover:bg-[#00f7a5] active:scale-95 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-[0_2px_12px_rgba(0,229,153,0.35)] transition-all cursor-pointer"
          >
            Deposit
          </button>
        </div>
      </div>

      {/* 2. Promo Banner (Matches screenshot: 🚀 Get a 50% bonus on your deposit! [50%] ✕) */}
      {showPromoBanner && (
        <div className="bg-[#00c874] text-slate-950 px-3 py-1.5 flex items-center justify-between text-xs font-bold shadow-sm animate-fadeIn">
          <div
            onClick={onOpenDeposit}
            className="flex items-center gap-2 cursor-pointer flex-1"
          >
            <span className="text-base">🚀</span>
            <span className="text-[11px] sm:text-xs">
              Get a 50% bonus on your deposit!
            </span>
            <span className="bg-[#009e5b] text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              50%
            </span>
          </div>

          <button
            onClick={() => setShowPromoBanner(false)}
            className="p-1 text-slate-900 hover:text-black transition-colors"
            title="Close Banner"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};

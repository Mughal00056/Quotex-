import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Asset,
  Candle,
  Trade,
  TradeDirection,
  TradeStatus,
  AccountType,
  DepositTransaction,
  WithdrawalTransaction,
  ChartType,
  IndicatorSettings,
  MarketBehaviorMode,
  DrawnLine,
  DrawingToolType,
  OrderToast
} from '../types/trading';
import { INITIAL_ASSETS, generateHistoricalCandles } from '../constants/assets';
import { sounds } from '../utils/audio';

interface TradingContextType {
  // Accounts
  accountType: AccountType;
  setAccountType: (type: AccountType) => void;
  demoBalance: number;
  realBalance: number;
  resetDemoBalance: () => void;

  // Assets & Separate Graphs per Asset
  assets: Asset[];
  activeAsset: Asset;
  setActiveAsset: (asset: Asset) => void;
  candles: Candle[];
  timeframe: number;
  setTimeframe: (seconds: number) => void;
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  indicators: IndicatorSettings;
  setIndicators: React.Dispatch<React.SetStateAction<IndicatorSettings>>;

  // Drawing Tools (Hum khud lines lagayein)
  drawnLines: DrawnLine[];
  addDrawnLine: (line: Omit<DrawnLine, 'id'>) => void;
  removeDrawnLine: (id: string) => void;
  clearDrawnLines: () => void;
  activeDrawingTool: DrawingToolType;
  setActiveDrawingTool: (tool: DrawingToolType) => void;

  // Market & Engine Mode
  isOnlineMode: boolean;
  setIsOnlineMode: (online: boolean) => void;
  marketBehaviorMode: MarketBehaviorMode;
  setMarketBehaviorMode: (mode: MarketBehaviorMode) => void;

  // Trading Actions
  activeTrades: Trade[];
  tradeHistory: Trade[];
  placeTrade: (direction: TradeDirection, amount: number, durationSeconds: number) => boolean;
  lastClosedTrade: Trade | null;
  clearLastClosedTrade: () => void;
  orderToast: OrderToast | null;
  clearOrderToast: () => void;

  // Cashier
  deposits: DepositTransaction[];
  withdrawals: WithdrawalTransaction[];
  depositFunds: (amount: number, method: string, promoCode?: string) => DepositTransaction;
  withdrawFunds: (amount: number, method: string, destinationAccount: string) => { success: boolean; message: string; transaction?: WithdrawalTransaction };
  approveWithdrawal: (id: string) => void;
  clearAllHistory: () => void;

  // Zoom (Pinch Chota / Kholo)
  zoomVisibleCount: number;
  setZoomVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  // Sound
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;

  // Loading state
  isAssetLoading: boolean;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

const STORAGE_KEYS = {
  DEMO_BALANCE: 'quotex_demo_balance',
  REAL_BALANCE: 'quotex_real_balance',
  ACCOUNT_TYPE: 'quotex_account_type',
  ACTIVE_ASSET_ID: 'quotex_active_asset_id',
  TRADE_HISTORY: 'quotex_trade_history',
  DEPOSITS: 'quotex_deposits_history',
  WITHDRAWALS: 'quotex_withdrawals_history',
  MARKET_MODE: 'quotex_market_mode',
  SOUND_ENABLED: 'quotex_sound_enabled',
  DRAWN_LINES: 'quotex_drawn_lines',
};

export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Account balances
  const [accountType, setAccountTypeState] = useState<AccountType>(() => {
    return (localStorage.getItem(STORAGE_KEYS.ACCOUNT_TYPE) as AccountType) || 'DEMO';
  });

  const [demoBalance, setDemoBalance] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DEMO_BALANCE);
    return saved !== null ? parseFloat(saved) : 10000;
  });

  const [realBalance, setRealBalance] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REAL_BALANCE);
    return saved !== null ? parseFloat(saved) : 1000.00;
  });

  // 2. Assets & Active Asset
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [activeAssetId, setActiveAssetId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_ASSET_ID) || INITIAL_ASSETS[0].id;
  });

  const activeAsset = assets.find((a) => a.id === activeAssetId) || assets[0];
  const [isAssetLoading, setIsAssetLoading] = useState<boolean>(false);

  // 3. Timeframe & Chart (Default: 60s / 1 min per candle as requested)
  const [timeframe, setTimeframe] = useState<number>(60);
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [indicators, setIndicators] = useState<IndicatorSettings>({
    sma: true,
    smaPeriod: 10,
    ema: false,
    emaPeriod: 21,
    bbands: false,
    bbandsPeriod: 20,
    bbandsStdDev: 2,
    rsi: false,
    rsiPeriod: 14,
    macd: false,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    stoch: false,
    stochK: 14,
    stochD: 3,
    parabolicSar: false
  });

  // 4. Market Mode & Engine behavior
  const [marketBehaviorMode, setMarketBehaviorModeState] = useState<MarketBehaviorMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MARKET_MODE);
    return (saved as MarketBehaviorMode) || 'smart_push';
  });

  const [isOnlineMode, setIsOnlineMode] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    return saved !== null ? saved === 'true' : true;
  });

  // 5. INDEPENDENT GRAPH PER ASSET: Dictionary storing candles map per assetId
  const [assetCandlesMap, setAssetCandlesMap] = useState<Record<string, Candle[]>>(() => {
    const map: Record<string, Candle[]> = {};
    INITIAL_ASSETS.forEach((ast) => {
      map[ast.id] = generateHistoricalCandles(ast, 60, 180);
    });
    return map;
  });

  const candles = assetCandlesMap[activeAsset.id] || generateHistoricalCandles(activeAsset, timeframe, 180);

  // 6. Trades & Drawing Tools
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRADE_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [lastClosedTrade, setLastClosedTrade] = useState<Trade | null>(null);

  // Order Placement Toast (Red for Sell, Green for Buy)
  const [orderToast, setOrderToast] = useState<OrderToast | null>(null);
  const orderToastTimerRef = useRef<any>(null);

  const clearOrderToast = useCallback(() => {
    if (orderToastTimerRef.current) clearTimeout(orderToastTimerRef.current);
    setOrderToast(null);
  }, []);

  // Drawing Tools (Hum khud lines lagayein - Support, Resistance, Trendlines)
  const [drawnLines, setDrawnLines] = useState<DrawnLine[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DRAWN_LINES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolType>('none');

  const addDrawnLine = useCallback((line: Omit<DrawnLine, 'id'>) => {
    const newLine: DrawnLine = {
      ...line,
      id: 'LINE-' + Math.random().toString(36).substring(2, 9)
    };
    setDrawnLines((prev) => {
      const updated = [...prev, newLine];
      localStorage.setItem(STORAGE_KEYS.DRAWN_LINES, JSON.stringify(updated));
      return updated;
    });
    sounds.playBeep(600, 0.08);
  }, []);

  const removeDrawnLine = useCallback((id: string) => {
    setDrawnLines((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      localStorage.setItem(STORAGE_KEYS.DRAWN_LINES, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearDrawnLines = useCallback(() => {
    setDrawnLines([]);
    localStorage.removeItem(STORAGE_KEYS.DRAWN_LINES);
  }, []);

  // Zoom Controls (Pinch to zoom chota / kholo - 14 to 120 visible candles)
  const [zoomVisibleCount, setZoomVisibleCount] = useState<number>(42);

  const zoomIn = useCallback(() => {
    setZoomVisibleCount((prev) => Math.max(14, prev - 6));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomVisibleCount((prev) => Math.min(120, prev + 6));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomVisibleCount(42);
  }, []);

  // 7. Cashier History
  const [deposits, setDeposits] = useState<DepositTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DEPOSITS);
      if (saved) return JSON.parse(saved);
      return [
        {
          id: 'DEP-892147',
          amount: 1000,
          bonusAmount: 0,
          totalCredited: 1000,
          method: 'USDT (TRC20)',
          txHash: '0x8f72a4c8e19230bd764b81023d8c119e7a9b',
          status: 'APPROVED',
          createdAt: Date.now() - 3600 * 1000 * 24,
          accountType: 'REAL'
        }
      ];
    } catch {
      return [];
    }
  });

  const [withdrawals, setWithdrawals] = useState<WithdrawalTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WITHDRAWALS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const activeBiasRef = useRef<number>(0);
  const activeTradesRef = useRef<Trade[]>(activeTrades);
  activeTradesRef.current = activeTrades;

  const currentPriceRef = useRef<number>(activeAsset.currentPrice);
  currentPriceRef.current = activeAsset.currentPrice;

  // Persist State helpers
  const setAccountType = (type: AccountType) => {
    setAccountTypeState(type);
    localStorage.setItem(STORAGE_KEYS.ACCOUNT_TYPE, type);
  };

  const setMarketBehaviorMode = (mode: MarketBehaviorMode) => {
    setMarketBehaviorModeState(mode);
    localStorage.setItem(STORAGE_KEYS.MARKET_MODE, mode);
  };

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    sounds.setEnabled(enabled);
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(enabled));
  };

  // Switch Active Asset with individual unique graph and quick loading transition
  const setActiveAsset = (asset: Asset) => {
    setIsAssetLoading(true);
    setActiveAssetId(asset.id);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ASSET_ID, asset.id);

    // If candles don't exist yet for this asset, generate them
    if (!assetCandlesMap[asset.id]) {
      const newCandles = generateHistoricalCandles(asset, timeframe, 180);
      setAssetCandlesMap((prev) => ({ ...prev, [asset.id]: newCandles }));
    }

    setTimeout(() => {
      setIsAssetLoading(false);
    }, 280);
  };

  // Re-generate historical candles when timeframe changes
  useEffect(() => {
    setAssetCandlesMap((prev) => ({
      ...prev,
      [activeAsset.id]: generateHistoricalCandles(activeAsset, timeframe, 180)
    }));
  }, [timeframe, activeAsset.id]);

  // Balance persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEMO_BALANCE, demoBalance.toString());
  }, [demoBalance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REAL_BALANCE, realBalance.toString());
  }, [realBalance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRADE_HISTORY, JSON.stringify(tradeHistory.slice(0, 200)));
  }, [tradeHistory]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(deposits));
  }, [deposits]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(withdrawals));
  }, [withdrawals]);

  const resetDemoBalance = () => {
    setDemoBalance(10000);
    sounds.playCashRegister();
  };

  const clearAllHistory = () => {
    setTradeHistory([]);
    setDeposits([]);
    setWithdrawals([]);
    localStorage.removeItem(STORAGE_KEYS.TRADE_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.DEPOSITS);
    localStorage.removeItem(STORAGE_KEYS.WITHDRAWALS);
  };

  // Realistic gentle market bias (Calm, organic, realistic tick movement like real trading)
  useEffect(() => {
    if (activeTrades.length === 0) {
      activeBiasRef.current = 0;
      return;
    }

    if (marketBehaviorMode === 'smart_push') {
      let bias = 0;
      activeTrades.forEach((t) => {
        if (t.assetId === activeAsset.id) {
          // Subtle realistic nudge (0.12 instead of 1.0, so market moves calmly and naturally)
          bias += t.direction === 'UP' ? 0.12 : -0.12;
        }
      });
      activeBiasRef.current = Math.max(-0.25, Math.min(0.25, bias));
    } else if (marketBehaviorMode === 'bull_trend') {
      activeBiasRef.current = 0.15;
    } else if (marketBehaviorMode === 'bear_trend') {
      activeBiasRef.current = -0.15;
    } else {
      activeBiasRef.current = 0;
    }
  }, [activeTrades, marketBehaviorMode, activeAsset.id]);

  // Real-time Tick Engine: Smooth, gentle, realistic tick formation (Authentic Quotex price action)
  useEffect(() => {
    const tickInterval = 120; // ms - realistic tick frequency
    const timer = setInterval(() => {
      setAssetCandlesMap((prevMap) => {
        const curCandles = prevMap[activeAsset.id];
        if (!curCandles || curCandles.length === 0) return prevMap;

        const now = Date.now();
        const lastCandle = curCandles[curCandles.length - 1];
        const timeframeMs = timeframe * 1000;
        const currentCandleDuration = now - lastCandle.time;

        const volatility = activeAsset.volatility;
        // Calm, realistic micro-noise (not fast plunge or erratic jumps)
        let delta = (Math.random() - 0.498) * volatility * 0.06;

        // Subtle organic drift
        if (activeBiasRef.current !== 0) {
          delta += activeBiasRef.current * volatility * 0.015;
        }

        const newPrice = Number((lastCandle.close + delta).toFixed(activeAsset.decimalPlaces));

        setAssets((prev) =>
          prev.map((a) => (a.id === activeAsset.id ? { ...a, currentPrice: newPrice } : a))
        );

        let updatedList: Candle[];
        if (currentCandleDuration >= timeframeMs) {
          const newCandle: Candle = {
            time: Math.floor(now / timeframeMs) * timeframeMs,
            open: newPrice,
            high: newPrice,
            low: newPrice,
            close: newPrice,
            volume: 15 + Math.floor(Math.random() * 20)
          };
          updatedList = [...curCandles.slice(-240), newCandle];
        } else {
          const updatedCandle: Candle = {
            ...lastCandle,
            high: Math.max(lastCandle.high, newPrice),
            low: Math.min(lastCandle.low, newPrice),
            close: newPrice,
            volume: lastCandle.volume + 1
          };
          updatedList = [...curCandles.slice(0, -1), updatedCandle];
        }

        return { ...prevMap, [activeAsset.id]: updatedList };
      });
    }, tickInterval);

    return () => clearInterval(timer);
  }, [timeframe, activeAsset.id, activeAsset.volatility, activeAsset.decimalPlaces]);

  // Trade Expiration Monitor
  useEffect(() => {
    const checkInterval = 100;
    const interval = setInterval(() => {
      const now = Date.now();
      const currentTrades = activeTradesRef.current;
      if (currentTrades.length === 0) return;

      const expiringTrades: Trade[] = [];
      const remainingTrades: Trade[] = [];

      currentTrades.forEach((trade) => {
        const remainingSeconds = Math.ceil((trade.closeTime - now) / 1000);
        if (remainingSeconds <= 3 && remainingSeconds > 0 && Math.random() < 0.15) {
          sounds.playCountdownTick(remainingSeconds === 1 ? 950 : 750);
        }

        if (now >= trade.closeTime) {
          expiringTrades.push(trade);
        } else {
          remainingTrades.push(trade);
        }
      });

      if (expiringTrades.length > 0) {
        setActiveTrades(remainingTrades);

        expiringTrades.forEach((trade) => {
          const exitPrice = currentPriceRef.current;
          let status: TradeStatus = 'LOST';
          let actualProfit = 0;

          if (trade.direction === 'UP') {
            if (exitPrice > trade.entryPrice) {
              status = 'WON';
              actualProfit = Number((trade.amount * (trade.payoutRate / 100)).toFixed(2));
            } else if (exitPrice === trade.entryPrice) {
              status = 'TIE';
              actualProfit = 0;
            } else {
              status = 'LOST';
              actualProfit = -trade.amount;
            }
          } else {
            if (exitPrice < trade.entryPrice) {
              status = 'WON';
              actualProfit = Number((trade.amount * (trade.payoutRate / 100)).toFixed(2));
            } else if (exitPrice === trade.entryPrice) {
              status = 'TIE';
              actualProfit = 0;
            } else {
              status = 'LOST';
              actualProfit = -trade.amount;
            }
          }

          const resolvedTrade: Trade = {
            ...trade,
            status,
            exitPrice,
            actualProfit
          };

          if (status === 'WON') {
            const returnAmount = trade.amount + actualProfit;
            if (trade.accountType === 'DEMO') {
              setDemoBalance((b) => Number((b + returnAmount).toFixed(2)));
            } else {
              setRealBalance((b) => Number((b + returnAmount).toFixed(2)));
            }
            sounds.playWin();
            try {
              confetti({
                particleCount: 45,
                spread: 55,
                origin: { y: 0.4 }
              });
            } catch {
              // ignore
            }
          } else if (status === 'TIE') {
            if (trade.accountType === 'DEMO') {
              setDemoBalance((b) => Number((b + trade.amount).toFixed(2)));
            } else {
              setRealBalance((b) => Number((b + trade.amount).toFixed(2)));
            }
          } else {
            sounds.playLoss();
          }

          setTradeHistory((prev) => [resolvedTrade, ...prev]);
          setLastClosedTrade(resolvedTrade);
        });
      }
    }, checkInterval);

    return () => clearInterval(interval);
  }, []);

  // Place Trade Action: Controlled gentle nudge
  const placeTrade = useCallback(
    (direction: TradeDirection, amount: number, durationSeconds: number): boolean => {
      const balance = accountType === 'DEMO' ? demoBalance : realBalance;
      if (amount <= 0 || balance < amount) {
        return false;
      }

      if (accountType === 'DEMO') {
        setDemoBalance((b) => Number((b - amount).toFixed(2)));
      } else {
        setRealBalance((b) => Number((b - amount).toFixed(2)));
      }

      const now = Date.now();
      const currentPrice = currentPriceRef.current;
      const payoutAmount = Number((amount * (activeAsset.payout / 100)).toFixed(2));

      const newTrade: Trade = {
        id: 'TRD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        assetId: activeAsset.id,
        assetName: activeAsset.name,
        direction,
        amount,
        entryPrice: currentPrice,
        payoutRate: activeAsset.payout,
        potentialProfit: payoutAmount,
        status: 'OPEN',
        openTime: now,
        closeTime: now + durationSeconds * 1000,
        durationSeconds,
        accountType
      };

      sounds.playTradePlaced();

      // Trigger Red for Sell, Green for Buy notification toast
      const newOrderToast: OrderToast = {
        id: 'ORD-' + Math.random().toString(36).substring(2, 8),
        direction,
        amount,
        assetSymbol: activeAsset.symbol,
        price: currentPrice,
        payoutRate: activeAsset.payout,
        timestamp: now
      };
      setOrderToast(newOrderToast);
      if (orderToastTimerRef.current) clearTimeout(orderToastTimerRef.current);
      orderToastTimerRef.current = setTimeout(() => {
        setOrderToast(null);
      }, 3500);

      // Smooth subtle visual response (controlled, not fast!)
      if (marketBehaviorMode === 'smart_push') {
        const step = activeAsset.volatility * (direction === 'UP' ? 0.25 : -0.25);
        const nudgedPrice = Number((currentPrice + step).toFixed(activeAsset.decimalPlaces));
        currentPriceRef.current = nudgedPrice;
        setAssetCandlesMap((prev) => {
          const list = prev[activeAsset.id] || [];
          if (list.length === 0) return prev;
          const last = list[list.length - 1];
          const updated: Candle = {
            ...last,
            high: Math.max(last.high, nudgedPrice),
            low: Math.min(last.low, nudgedPrice),
            close: nudgedPrice
          };
          return { ...prev, [activeAsset.id]: [...list.slice(0, -1), updated] };
        });
      }

      setActiveTrades((prev) => [newTrade, ...prev]);
      return true;
    },
    [accountType, demoBalance, realBalance, activeAsset, marketBehaviorMode]
  );

  const clearLastClosedTrade = () => {
    setLastClosedTrade(null);
  };

  // Cashier: Deposit (Clean professional record without "offline" text)
  const depositFunds = useCallback(
    (amount: number, method: string, promoCode?: string): DepositTransaction => {
      let bonusPercent = 0;
      if (promoCode && promoCode.toUpperCase() === 'BONUS50') {
        bonusPercent = 50;
      } else if (promoCode && promoCode.toUpperCase() === 'QUOTEX100') {
        bonusPercent = 100;
      }

      const bonusAmount = Number((amount * (bonusPercent / 100)).toFixed(2));
      const totalCredited = amount + bonusAmount;

      const tx: DepositTransaction = {
        id: 'DEP-' + Math.floor(100000 + Math.random() * 900000),
        amount,
        bonusAmount,
        totalCredited,
        method,
        txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        status: 'APPROVED',
        createdAt: Date.now(),
        accountType: 'REAL',
        promoCode
      };

      setRealBalance((b) => Number((b + totalCredited).toFixed(2)));
      setDeposits((prev) => [tx, ...prev]);
      sounds.playCashRegister();

      return tx;
    },
    []
  );

  // Cashier: Withdrawal (Clean professional record)
  const withdrawFunds = useCallback(
    (amount: number, method: string, destinationAccount: string) => {
      if (amount <= 0) {
        return { success: false, message: 'Invalid withdrawal amount' };
      }
      if (realBalance < amount) {
        return { success: false, message: 'Insufficient live balance' };
      }

      setRealBalance((b) => Number((b - amount).toFixed(2)));

      const tx: WithdrawalTransaction = {
        id: 'WTH-' + Math.floor(100000 + Math.random() * 900000),
        amount,
        method,
        destinationAccount,
        status: 'APPROVED',
        createdAt: Date.now(),
        accountType: 'REAL',
        txId: 'TXW-' + Math.random().toString(36).substring(2, 10).toUpperCase()
      };

      setWithdrawals((prev) => [tx, ...prev]);
      sounds.playCashRegister();

      return {
        success: true,
        message: `Withdrawal of $${amount.toFixed(2)} to ${method} processed successfully!`,
        transaction: tx
      };
    },
    [realBalance]
  );

  const approveWithdrawal = useCallback((id: string) => {
    setWithdrawals((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: 'APPROVED' } : w))
    );
    sounds.playCashRegister();
  }, []);

  return (
    <TradingContext.Provider
      value={{
        accountType,
        setAccountType,
        demoBalance,
        realBalance,
        resetDemoBalance,
        assets,
        activeAsset,
        setActiveAsset,
        candles,
        timeframe,
        setTimeframe,
        chartType,
        setChartType,
        indicators,
        setIndicators,
        isOnlineMode,
        setIsOnlineMode,
        marketBehaviorMode,
        setMarketBehaviorMode,
        activeTrades,
        tradeHistory,
        placeTrade,
        lastClosedTrade,
        clearLastClosedTrade,
        orderToast,
        clearOrderToast,
        drawnLines,
        addDrawnLine,
        removeDrawnLine,
        clearDrawnLines,
        activeDrawingTool,
        setActiveDrawingTool,
        zoomVisibleCount,
        setZoomVisibleCount,
        zoomIn,
        zoomOut,
        resetZoom,
        deposits,
        withdrawals,
        depositFunds,
        withdrawFunds,
        approveWithdrawal,
        clearAllHistory,
        soundEnabled,
        setSoundEnabled,
        isAssetLoading
      }}
    >
      {children}
    </TradingContext.Provider>
  );
};

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
};

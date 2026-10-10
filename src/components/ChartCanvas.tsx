import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useTrading } from '../context/TradingContext';
import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  toHeikinAshi,
  formatPrice
} from '../utils/chartMath';
import { Candle } from '../types/trading';
import {
  MoreHorizontal,
  Briefcase,
  Sliders,
  Plus,
  Minus,
  Maximize2,
  PenTool,
  Trophy,
  CheckCircle2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Radio
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ChartCanvasProps {
  className?: string;
  onOpenSettings?: () => void;
  onOpenIndicators?: (tab?: 'ALL' | 'TREND' | 'VOLATILITY' | 'OSCILLATORS' | 'DRAWING') => void;
  onOpenActiveTrades?: () => void;
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({
  className,
  onOpenSettings,
  onOpenIndicators,
  onOpenActiveTrades
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    activeAsset,
    candles,
    chartType,
    indicators,
    activeTrades,
    timeframe,
    accountType,
    isAssetLoading,
    zoomVisibleCount,
    setZoomVisibleCount,
    zoomIn,
    zoomOut,
    resetZoom,
    drawnLines,
    addDrawnLine,
    removeDrawnLine,
    activeDrawingTool,
    setActiveDrawingTool,
    lastClosedTrade,
    clearLastClosedTrade,
    clearOrderToast
  } = useTrading();

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [panOffset, setPanOffset] = useState<number>(0); // 0 = at live candle, > 0 = shifted back into history
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; initialPan: number } | null>(null);
  const touchStartDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(zoomVisibleCount);
  const chartDimsRef = useRef<{ minPrice: number; maxPrice: number; topPadding: number; chartHeight: number; expandedRange: number; candleWidth: number } | null>(null);
  const [showWinCelebration, setShowWinCelebration] = useState(false);

  // Prepare display candles (Heikin Ashi or standard)
  const displayCandles = useMemo<Candle[]>(() => {
    if (chartType === 'heikinAshi') {
      return toHeikinAshi(candles);
    }
    return candles;
  }, [candles, chartType]);

  // Compute indicators
  const smaValues = useMemo(() => {
    if (!indicators.sma) return [];
    return calculateSMA(displayCandles, indicators.smaPeriod);
  }, [displayCandles, indicators.sma, indicators.smaPeriod]);

  const emaValues = useMemo(() => {
    if (!indicators.ema) return [];
    return calculateEMA(displayCandles, indicators.emaPeriod);
  }, [displayCandles, indicators.ema, indicators.emaPeriod]);

  const bbands = useMemo(() => {
    if (!indicators.bbands) return null;
    return calculateBollingerBands(displayCandles, indicators.bbandsPeriod, indicators.bbandsStdDev);
  }, [displayCandles, indicators.bbands, indicators.bbandsPeriod, indicators.bbandsStdDev]);

  const rsiValues = useMemo(() => {
    if (!indicators.rsi) return [];
    return calculateRSI(displayCandles, indicators.rsiPeriod);
  }, [displayCandles, indicators.rsi, indicators.rsiPeriod]);

  const macdValues = useMemo(() => {
    if (!indicators.macd) return null;
    return calculateMACD(displayCandles, indicators.macdFast, indicators.macdSlow, indicators.macdSignal);
  }, [displayCandles, indicators.macd, indicators.macdFast, indicators.macdSlow, indicators.macdSignal]);

  const stochValues = useMemo(() => {
    if (!indicators.stoch) return null;
    return calculateStochastic(displayCandles, indicators.stochK, indicators.stochD);
  }, [displayCandles, indicators.stoch, indicators.stochK, indicators.stochD]);

  // Main rendering loop on high-DPI canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Deep dark background
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, width, height);

    if (displayCandles.length < 2) {
      ctx.restore();
      return;
    }

    // Allocate sub-chart space for oscillators
    let subChartTotal = 0;
    if (indicators.rsi) subChartTotal += 55;
    if (indicators.macd) subChartTotal += 55;
    if (indicators.stoch) subChartTotal += 55;

    const rightPadding = 75; // for price axis
    const bottomPadding = 30 + subChartTotal; // for time axis + oscillators
    const topPadding = 18;
    const chartWidth = width - rightPadding;
    const chartHeight = height - bottomPadding - topPadding;

    // Dynamic visible candles & horizontal panning (aage peeche candles shift: 14 to 130)
    const visibleCount = Math.max(14, Math.min(130, zoomVisibleCount));
    const maxPan = Math.max(0, displayCandles.length - visibleCount);
    const clampedPan = Math.max(0, Math.min(maxPan, panOffset));
    const endIdx = displayCandles.length - clampedPan;
    const startIdx = Math.max(0, endIdx - visibleCount);
    const candleSlice = displayCandles.slice(startIdx, endIdx);
    const startIndex = startIdx;

    // Calculate Min & Max Price
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let minPriceIndex = 0;

    candleSlice.forEach((c, idx) => {
      if (c.low < minPrice) {
        minPrice = c.low;
        minPriceIndex = idx;
      }
      if (c.high > maxPrice) {
        maxPrice = c.high;
      }
    });

    if (bbands) {
      for (let i = startIndex; i < displayCandles.length; i++) {
        const u = bbands.upper[i];
        const l = bbands.lower[i];
        if (u !== null && u > maxPrice) maxPrice = u;
        if (l !== null && l < minPrice) minPrice = l;
      }
    }

    // Add vertical headroom
    const priceRange = maxPrice - minPrice || 0.0005;
    minPrice -= priceRange * 0.14;
    maxPrice += priceRange * 0.14;
    const expandedRange = maxPrice - minPrice;

    // Coordinates helpers
    const candleWidth = chartWidth / visibleCount;
    const bodyWidth = Math.max(3, candleWidth * 0.68);

    chartDimsRef.current = { minPrice, maxPrice, topPadding, chartHeight, expandedRange, candleWidth };

    const getY = (price: number) => {
      return topPadding + chartHeight - ((price - minPrice) / expandedRange) * chartHeight;
    };

    const getX = (indexInSlice: number) => {
      return indexInSlice * candleWidth + candleWidth / 2;
    };

    // 1. WATERMARK: Large faint 'TRADE FOX' and 'DEMO / LIVE' branding watermark
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.032)';
    ctx.font = '900 68px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '8px';
    ctx.fillText('TRADE FOX', chartWidth / 2, topPadding + chartHeight / 2 - 20);

    ctx.font = '800 24px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.022)';
    ctx.letterSpacing = '10px';
    ctx.fillText(accountType === 'REAL' ? 'LIVE ACCOUNT' : 'DEMO ACCOUNT', chartWidth / 2, topPadding + chartHeight / 2 + 26);
    ctx.restore();

    // 2. Subtle Grid Lines
    ctx.strokeStyle = '#141a24';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    // Horizontal price grid lines
    const gridRows = 5;
    for (let i = 0; i <= gridRows; i++) {
      const y = topPadding + (chartHeight / gridRows) * i;
      const priceAtY = maxPrice - (i / gridRows) * expandedRange;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      // Price labels on right axis
      ctx.fillStyle = '#64748b';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(formatPrice(priceAtY, activeAsset.decimalPlaces), chartWidth + 8, y + 4);
    }

    // Vertical time grid lines
    const gridCols = 5;
    for (let i = 0; i <= gridCols; i++) {
      const x = (chartWidth / gridCols) * i;
      ctx.beginPath();
      ctx.moveTo(x, topPadding);
      ctx.lineTo(x, topPadding + chartHeight);
      ctx.stroke();

      const candleIndex = Math.min(
        candleSlice.length - 1,
        Math.floor((i / gridCols) * candleSlice.length)
      );
      if (candleSlice[candleIndex]) {
        const date = new Date(candleSlice[candleIndex].time);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        ctx.fillStyle = '#64748b';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${hours}:${minutes}`, x, topPadding + chartHeight + 18);
      }
    }

    // 3. Bollinger Bands Fill
    if (bbands) {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.05)';
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < candleSlice.length; i++) {
        const u = bbands.upper[startIndex + i];
        if (u !== null) {
          const x = getX(i);
          const y = getY(u);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      for (let i = candleSlice.length - 1; i >= 0; i--) {
        const l = bbands.lower[startIndex + i];
        if (l !== null) {
          const x = getX(i);
          const y = getY(l);
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();

      // Lines
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
      ctx.lineWidth = 1;
      ['upper', 'lower'].forEach((b) => {
        ctx.beginPath();
        let s = false;
        for (let i = 0; i < candleSlice.length; i++) {
          const bandsRecord = bbands as unknown as Record<string, (number | null)[]>;
          const val = bandsRecord[b][startIndex + i];
          if (val !== null) {
            const x = getX(i);
            const y = getY(val);
            if (!s) { ctx.moveTo(x, y); s = true; } else { ctx.lineTo(x, y); }
          }
        }
        ctx.stroke();
      });
    }

    // 4. Moving Averages
    if (indicators.sma && smaValues.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.6;
      let started = false;
      for (let i = 0; i < candleSlice.length; i++) {
        const val = smaValues[startIndex + i];
        if (val !== null) {
          const x = getX(i);
          const y = getY(val);
          if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
      }
      ctx.stroke();
    }

    if (indicators.ema && emaValues.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.6;
      let started = false;
      for (let i = 0; i < candleSlice.length; i++) {
        const val = emaValues[startIndex + i];
        if (val !== null) {
          const x = getX(i);
          const y = getY(val);
          if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
      }
      ctx.stroke();
    }

    // 5. Draw Candlesticks (Green and Red)
    candleSlice.forEach((c, idx) => {
      const x = getX(idx);
      const isBullish = c.close >= c.open;
      const color = isBullish ? '#00e599' : '#ff4766';

      const openY = getY(c.open);
      const closeY = getY(c.close);
      const highY = getY(c.high);
      const lowY = getY(c.low);

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.8, Math.abs(closeY - openY));

      ctx.fillStyle = color;
      ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    });

    // 6. Vertical Lines: Beginning of trade & End of trade (exact screenshot match)
    const beginningX = getX(Math.floor(candleSlice.length * 0.42));
    const endX = getX(Math.floor(candleSlice.length * 0.72));

    // Beginning of trade line
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(beginningX, topPadding);
    ctx.lineTo(beginningX, topPadding + chartHeight);
    ctx.stroke();

    const tradeTime = new Date().toTimeString().substring(0, 8);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(beginningX - 45, topPadding + 6, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${tradeTime} Beginning of trade`, beginningX - 35, topPadding + 9);
    ctx.restore();

    // End of trade line
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(endX, topPadding);
    ctx.lineTo(endX, topPadding + chartHeight);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('◀ End of trade', endX + 8, topPadding + 9);
    ctx.restore();

    // 7. Lowest Price Tag (Matches screenshot: e.g. 0.92933)
    if (minPriceIndex >= 0 && minPriceIndex < candleSlice.length) {
      const minX = getX(minPriceIndex);
      const lowestActual = candleSlice[minPriceIndex].low;
      const minY = getY(lowestActual);

      ctx.fillStyle = '#18202c';
      ctx.beginPath();
      ctx.roundRect(minX - 25, minY + 8, 50, 16, 4);
      ctx.fill();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatPrice(lowestActual, activeAsset.decimalPlaces), minX, minY + 20);
    }

    // 7.5 Drawn Lines (Support, Resistance, Trendlines)
    drawnLines.forEach((line) => {
      if (line.type === 'horizontal') {
        const lineY = getY(line.price1);
        if (lineY >= topPadding && lineY <= topPadding + chartHeight) {
          ctx.save();
          ctx.strokeStyle = line.color || '#eab308';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 3]);
          ctx.beginPath();
          ctx.moveTo(0, lineY);
          ctx.lineTo(chartWidth, lineY);
          ctx.stroke();

          // Left label badge
          if (line.label) {
            ctx.fillStyle = line.color || '#eab308';
            ctx.beginPath();
            ctx.roundRect(6, lineY - 9, 68, 18, 4);
            ctx.fill();

            ctx.fillStyle = '#0a0d14';
            ctx.font = 'bold 9px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(line.label, 40, lineY + 4);
          }

          // Right price tag on axis
          ctx.fillStyle = line.color || '#eab308';
          ctx.beginPath();
          ctx.roundRect(chartWidth + 3, lineY - 10, 68, 20, 4);
          ctx.fill();

          ctx.fillStyle = '#0a0d14';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(formatPrice(line.price1, activeAsset.decimalPlaces), chartWidth + 37, lineY + 4);
          ctx.restore();
        }
      } else if (line.type === 'trendline' && line.price2 !== undefined) {
        const y1 = getY(line.price1);
        const y2 = getY(line.price2);
        const x1 = candleWidth * 2;
        const x2 = chartWidth - candleWidth * 2;

        ctx.save();
        ctx.strokeStyle = line.color || '#eab308';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.fillStyle = line.color || '#eab308';
        ctx.beginPath();
        ctx.arc(x1, y1, 4.5, 0, Math.PI * 2);
        ctx.arc(x2, y2, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // 8. Active Trades Strike Lines
    activeTrades.forEach((trade) => {
      if (trade.assetId !== activeAsset.id) return;
      const tradeY = getY(trade.entryPrice);
      const isUp = trade.direction === 'UP';
      const color = isUp ? '#00e599' : '#ff4766';

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(0, tradeY);
      ctx.lineTo(chartWidth, tradeY);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(8, tradeY - 10, 70, 20, 4);
      ctx.fill();

      ctx.fillStyle = '#0b0e14';
      ctx.font = 'bold 10px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${isUp ? '▲ BUY' : '▼ SELL'} $${trade.amount}`, 43, tradeY + 4);
      ctx.restore();
    });

    // 9. Live Strike Price Line & Timer Countdown (00:52 countdown + 0.93093 cyan badge)
    const currentPrice = activeAsset.currentPrice;
    const currentY = getY(currentPrice);

    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(0, currentY);
    ctx.lineTo(chartWidth, currentY);
    ctx.stroke();
    ctx.restore();

    // Countdown pill on current strike line (Matches screenshot!)
    let activeSec = 60 - (Math.floor(Date.now() / 1000) % 60);
    if (activeTrades.length > 0) {
      const latestTrade = activeTrades[0];
      const rem = Math.max(0, Math.ceil((latestTrade.closeTime - Date.now()) / 1000));
      activeSec = rem;
    }
    const mins = Math.floor(activeSec / 60);
    const secs = activeSec % 60;
    const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const timerPillWidth = 46;
    const timerPillHeight = 18;
    const timerPillX = chartWidth - timerPillWidth - 10;
    const timerPillY = currentY - timerPillHeight / 2;

    ctx.fillStyle = '#1c2430';
    ctx.beginPath();
    ctx.roundRect(timerPillX, timerPillY, timerPillWidth, timerPillHeight, 4);
    ctx.fill();

    ctx.strokeStyle = '#2b3648';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(timeFormatted, timerPillX + timerPillWidth / 2, timerPillY + 13);

    // Cyan Price Badge on Right Axis
    const tagWidth = 66;
    const tagHeight = 22;
    const tagX = chartWidth + 3;
    const tagY = currentY - tagHeight / 2;

    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagWidth, tagHeight, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(formatPrice(currentPrice, activeAsset.decimalPlaces), tagX + tagWidth / 2, tagY + 15);

    // 10. Sub-charts: RSI, MACD, Stochastic
    let currentSubY = topPadding + chartHeight + 25;

    // RSI Sub-chart
    if (indicators.rsi && rsiValues.length > 0) {
      const subH = 50;
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, currentSubY, chartWidth, subH);
      ctx.strokeStyle = '#1b2332';
      ctx.strokeRect(0, currentSubY, chartWidth, subH);

      // 70 and 30 levels
      const y70 = currentSubY + subH * 0.3;
      const y30 = currentSubY + subH * 0.7;
      ctx.strokeStyle = '#ef444455';
      ctx.beginPath(); ctx.moveTo(0, y70); ctx.lineTo(chartWidth, y70); ctx.stroke();
      ctx.strokeStyle = '#22c55e55';
      ctx.beginPath(); ctx.moveTo(0, y30); ctx.lineTo(chartWidth, y30); ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px "Inter", sans-serif';
      ctx.textAlign = 'left';
      const curRsi = rsiValues[rsiValues.length - 1];
      ctx.fillText(`RSI (${indicators.rsiPeriod}): ${curRsi ? curRsi.toFixed(1) : '--'}`, 6, currentSubY + 12);

      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.4;
      let s = false;
      for (let i = 0; i < candleSlice.length; i++) {
        const val = rsiValues[startIndex + i];
        if (val !== null) {
          const x = getX(i);
          const y = currentSubY + subH - (val / 100) * subH;
          if (!s) { ctx.moveTo(x, y); s = true; } else { ctx.lineTo(x, y); }
        }
      }
      ctx.stroke();
      currentSubY += 55;
    }

    // MACD Sub-chart
    if (indicators.macd && macdValues) {
      const subH = 50;
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, currentSubY, chartWidth, subH);
      ctx.strokeStyle = '#1b2332';
      ctx.strokeRect(0, currentSubY, chartWidth, subH);

      ctx.fillStyle = '#10b981';
      ctx.font = '10px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('MACD (12, 26, 9)', 6, currentSubY + 12);

      const midY = currentSubY + subH / 2;
      ctx.strokeStyle = '#334155';
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(chartWidth, midY); ctx.stroke();

      // Histogram
      for (let i = 0; i < candleSlice.length; i++) {
        const h = macdValues.histogram[startIndex + i];
        if (h !== null) {
          const x = getX(i);
          const barH = Math.min(22, Math.max(-22, h * 1200));
          ctx.fillStyle = barH >= 0 ? '#10b981' : '#f43f5e';
          ctx.fillRect(x - 1.5, midY - barH, 3, barH);
        }
      }
      currentSubY += 55;
    }

    // Stochastic Sub-chart
    if (indicators.stoch && stochValues) {
      const subH = 50;
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, currentSubY, chartWidth, subH);
      ctx.strokeStyle = '#1b2332';
      ctx.strokeRect(0, currentSubY, chartWidth, subH);

      ctx.fillStyle = '#fb7185';
      ctx.font = '10px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Stochastic (14, 3)', 6, currentSubY + 12);

      // %K Line
      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.3;
      let s = false;
      for (let i = 0; i < candleSlice.length; i++) {
        const val = stochValues.k[startIndex + i];
        if (val !== null) {
          const x = getX(i);
          const y = currentSubY + subH - (val / 100) * subH;
          if (!s) { ctx.moveTo(x, y); s = true; } else { ctx.lineTo(x, y); }
        }
      }
      ctx.stroke();
    }

    // 11. Crosshair on touch / mouse
    if (mousePos && mousePos.x >= 0 && mousePos.x <= chartWidth && mousePos.y >= topPadding && mousePos.y <= topPadding + chartHeight) {
      ctx.save();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);

      ctx.beginPath();
      ctx.moveTo(mousePos.x, topPadding);
      ctx.lineTo(mousePos.x, topPadding + chartHeight);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, mousePos.y);
      ctx.lineTo(chartWidth, mousePos.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [
    displayCandles,
    activeAsset,
    chartType,
    indicators,
    activeTrades,
    mousePos,
    smaValues,
    emaValues,
    bbands,
    rsiValues,
    macdValues,
    stochValues,
    timeframe,
    accountType,
    drawnLines,
    zoomVisibleCount,
    panOffset,
    lastClosedTrade
  ]);

  // ResizeObserver for reliable mobile layout changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width > 0 && height > 0) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeDrawingTool === 'none') {
      isDraggingRef.current = true;
      dragStartRef.current = { startX: e.clientX, initialPan: panOffset };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (isDraggingRef.current && dragStartRef.current && chartDimsRef.current) {
      const deltaX = e.clientX - dragStartRef.current.startX;
      const candleW = Math.max(4, chartDimsRef.current.candleWidth || 8);
      // Dragging right pulls older candles into view (increases panOffset)
      // Dragging left pulls newer candles into view (decreases panOffset towards 0)
      const deltaCandles = Math.round(deltaX / candleW);
      const newPan = Math.max(0, dragStartRef.current.initialPan + deltaCandles);
      setPanOffset(newPan);
    }

    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    setMousePos(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 2) {
      // 2 finger pinch start (pinch chota / kholo)
      isDraggingRef.current = false;
      dragStartRef.current = null;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStartDistRef.current = dist;
      initialZoomRef.current = zoomVisibleCount;
    } else if (e.touches.length === 1) {
      const clickY = e.touches[0].clientY - rect.top;
      const clickX = e.touches[0].clientX - rect.left;

      // If in tap-to-draw line mode (Pen tool)
      if (activeDrawingTool === 'horizontal' && chartDimsRef.current) {
        const { maxPrice, topPadding, chartHeight, expandedRange } = chartDimsRef.current;
        const priceAtY = maxPrice - ((clickY - topPadding) / chartHeight) * expandedRange;
        addDrawnLine({
          type: 'horizontal',
          price1: Number(priceAtY.toFixed(activeAsset.decimalPlaces)),
          color: '#eab308',
          label: 'PRICE LEVEL'
        });
        setActiveDrawingTool('none');
        // As requested: Dismiss win & order notifications on pen drawing!
        clearLastClosedTrade();
        clearOrderToast();
        return;
      }

      // Single finger drag for horizontal candles pan (aage peeche)
      isDraggingRef.current = true;
      dragStartRef.current = { startX: e.touches[0].clientX, initialPan: panOffset };

      setMousePos({
        x: clickX,
        y: clickY
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 2 && touchStartDistRef.current) {
      // Pinch gesture: distance shrinks (chota / zoom out) or spreads (kholo / zoom in)
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (currentDist > 10 && touchStartDistRef.current > 10) {
        const scale = currentDist / touchStartDistRef.current;
        const targetCount = Math.round(initialZoomRef.current / scale);
        const clamped = Math.max(14, Math.min(130, targetCount));
        setZoomVisibleCount(clamped);
      }
    } else if (e.touches.length === 1 && isDraggingRef.current && dragStartRef.current && chartDimsRef.current) {
      // 1-finger horizontal swipe pan
      const deltaX = e.touches[0].clientX - dragStartRef.current.startX;
      const candleW = Math.max(4, chartDimsRef.current.candleWidth || 8);
      const deltaCandles = Math.round(deltaX / candleW);
      const newPan = Math.max(0, dragStartRef.current.initialPan + deltaCandles);
      setPanOffset(newPan);

      setMousePos({
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      });
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
    isDraggingRef.current = false;
    dragStartRef.current = null;
    setTimeout(() => {
      setMousePos(null);
    }, 1500);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomIn(); // Kholo / fewer candles
    } else {
      zoomOut(); // Chota / more candles
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeDrawingTool === 'horizontal' && chartDimsRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clickY = e.clientY - rect.top;
      const { maxPrice, topPadding, chartHeight, expandedRange } = chartDimsRef.current;
      const priceAtY = maxPrice - ((clickY - topPadding) / chartHeight) * expandedRange;
      addDrawnLine({
        type: 'horizontal',
        price1: Number(priceAtY.toFixed(activeAsset.decimalPlaces)),
        color: '#eab308',
        label: 'PRICE LEVEL'
      });
      setActiveDrawingTool('none');
      // Dismiss win and order toast on pen click
      clearLastClosedTrade();
      clearOrderToast();
    }
  };

  const anyIndicatorActive = indicators.sma || indicators.ema || indicators.bbands || indicators.rsi || indicators.macd || indicators.stoch;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full select-none overflow-hidden touch-none ${className || ''}`}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className="block w-full h-full cursor-crosshair touch-none"
      />

      {/* Floating Buttons on the Left (Identical to screenshot + Drawing tool + Indicators tool) */}
      <div className="absolute left-3 top-3.5 flex flex-col gap-2 z-10">
        {/* Three dots options */}
        <button
          onClick={onOpenSettings}
          className="w-10 h-10 rounded-xl bg-[#1b2332]/90 backdrop-blur-md border border-[#2b374c] text-slate-300 hover:text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
          title="Chart Options & Settings"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>

        {/* Indicators Manager Tool */}
        <button
          onClick={() => onOpenIndicators && onOpenIndicators('ALL')}
          className={`relative w-10 h-10 rounded-xl backdrop-blur-md border flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ${
            anyIndicatorActive
              ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-400'
              : 'bg-[#1b2332]/90 border-[#2b374c] text-slate-300 hover:text-white'
          }`}
          title="Technical Indicators Section"
        >
          <Sliders className="w-4 h-4" />
          {anyIndicatorActive && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          )}
        </button>

        {/* Drawing Tools (Pencil Tool to draw lines) */}
        <button
          onClick={() => onOpenIndicators && onOpenIndicators('DRAWING')}
          className={`relative w-10 h-10 rounded-xl backdrop-blur-md border flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ${
            drawnLines.length > 0 || activeDrawingTool !== 'none'
              ? 'bg-amber-950/80 border-amber-500/60 text-amber-400'
              : 'bg-[#1b2332]/90 border-[#2b374c] text-slate-300 hover:text-white'
          }`}
          title="Drawing Tools (Draw Custom Lines on Chart)"
        >
          <PenTool className="w-4 h-4" />
          {drawnLines.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
              {drawnLines.length}
            </span>
          )}
        </button>

        {/* Briefcase active trades button with badge */}
        <button
          onClick={onOpenActiveTrades}
          className="relative w-10 h-10 rounded-xl bg-[#1b2332]/90 backdrop-blur-md border border-[#2b374c] text-slate-300 hover:text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
          title="Active Orders"
        >
          <Briefcase className="w-5 h-5 text-slate-300" />
          <span className="absolute -top-1.5 -right-1.5 bg-[#0284c7] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
            {activeTrades.length}
          </span>
        </button>
      </div>

      {/* Floating Zoom & Pan Controls (Pinch chota / kholo & candles aage peeche controls) */}
      <div className="absolute right-3 bottom-12 flex flex-col items-center gap-1.5 z-10 bg-[#121824]/90 backdrop-blur-md p-1 rounded-xl border border-[#232f42] shadow-2xl">
        {/* Zoom In (Kholo) */}
        <button
          onClick={zoomIn}
          className="w-8 h-8 rounded-lg bg-[#1a2332] hover:bg-[#253348] text-slate-200 hover:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer"
          title="Zoom In (Kholo - Bigger candles)"
        >
          <Plus className="w-4 h-4" />
        </button>

        <span className="text-[9px] font-mono font-bold text-cyan-400 px-0.5 select-none" title="Candles visible">
          {zoomVisibleCount}b
        </span>

        {/* Zoom Out (Chota) */}
        <button
          onClick={zoomOut}
          className="w-8 h-8 rounded-lg bg-[#1a2332] hover:bg-[#253348] text-slate-200 hover:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer"
          title="Zoom Out (Chota - More candles)"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Pan Backward into history (Aage candles) */}
        <button
          onClick={() => setPanOffset((prev) => prev + 12)}
          className="w-8 h-7 rounded-lg bg-[#161f2e] hover:bg-[#223046] text-slate-300 hover:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer border-t border-[#222e40]"
          title="Scroll Back in Time (Peeche candles dekho)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Pan Forward towards live (Peeche candles wapis live ki taraf) */}
        <button
          onClick={() => setPanOffset((prev) => Math.max(0, prev - 12))}
          disabled={panOffset === 0}
          className={`w-8 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
            panOffset === 0
              ? 'opacity-40 text-slate-600 bg-transparent'
              : 'bg-[#161f2e] hover:bg-[#223046] text-slate-300 hover:text-white'
          }`}
          title="Scroll Forward towards Live"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Reset Zoom & Pan */}
        <button
          onClick={() => {
            resetZoom();
            setPanOffset(0);
          }}
          className="w-8 h-6 rounded-md bg-[#141b27] hover:bg-[#1d2738] text-slate-400 hover:text-slate-200 text-[10px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer"
          title="Reset Zoom & Snap to Live"
        >
          1:1
        </button>
      </div>

      {/* Snap-to-Live Badge when scrolled back in time */}
      {panOffset > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => setPanOffset(0)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121c2c]/95 border border-cyan-400 text-cyan-200 text-[11px] font-mono font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>Viewing History ({panOffset} bars ago)</span>
            <span className="bg-cyan-400 text-slate-950 px-2 py-0.5 rounded font-black text-[10px]">
              ▶ LIVE
            </span>
          </button>
        </div>
      )}

      {/* WIN BUTTON ON TRADING CHART: Red for Sell Win, Green for Buy Win! */}
      {lastClosedTrade && lastClosedTrade.status === 'WON' && (
        <div className="absolute top-3.5 right-3 z-20 animate-scaleUp select-none">
          <button
            onClick={() => {
              confetti({ particleCount: 40, spread: 60, origin: { y: 0.3 } });
            }}
            className={`flex items-center gap-2 font-black text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-2xl border hover:scale-105 active:scale-95 transition-transform cursor-pointer ${
              lastClosedTrade.direction === 'DOWN'
                ? 'bg-gradient-to-r from-[#ff3355] to-[#e11d48] text-white border-rose-300 shadow-[0_4px_25px_rgba(255,51,85,0.65)]' // SELL WIN -> RED
                : 'bg-gradient-to-r from-[#00c874] to-[#00e599] text-slate-950 border-emerald-300 shadow-[0_4px_25px_rgba(0,229,153,0.65)]' // BUY WIN -> GREEN
            }`}
          >
            <Trophy className="w-4 h-4 stroke-[2.5]" />
            <span>
              {lastClosedTrade.direction === 'DOWN' ? 'SELL WIN' : 'BUY WIN'} +${Number((lastClosedTrade.amount + (lastClosedTrade.actualProfit || 0)).toFixed(2)).toLocaleString()}
            </span>
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
              lastClosedTrade.direction === 'DOWN' ? 'bg-black/30 text-white' : 'bg-slate-950 text-[#00e599]'
            }`}>
              WIN
            </span>
          </button>
        </div>
      )}

      {/* Active Trades live status badge right on top of chart */}
      {activeTrades.length > 0 && (
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-[#121824]/90 backdrop-blur-md border border-[#253246] px-3.5 py-1 rounded-full flex items-center gap-2 shadow-xl text-[11px] font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-bold text-white">
              {activeTrades[0].direction === 'UP' ? '▲ BUY' : '▼ SELL'} ${activeTrades[0].amount}
            </span>
            <span className="text-slate-400">
              {Math.max(0, Math.ceil((activeTrades[0].closeTime - Date.now()) / 1000))}s
            </span>
          </div>
        </div>
      )}

      {/* Tap-to-place line banner */}
      {activeDrawingTool === 'horizontal' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-cyan-950/95 border border-cyan-400 text-white px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-2xl animate-pulse">
          <PenTool className="w-3.5 h-3.5 text-cyan-400" />
          <span>Tap anywhere on the chart to place line</span>
          <button
            onClick={() => setActiveDrawingTool('none')}
            className="ml-1 px-1.5 py-0.5 rounded bg-cyan-900 text-cyan-200 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Mini Asset Switching Loading Overlay */}
      {isAssetLoading && (
        <div className="absolute inset-0 bg-[#0a0d14]/70 backdrop-blur-xs flex items-center justify-center z-20 animate-fadeIn">
          <div className="bg-[#141b27] px-4 py-2 rounded-xl border border-[#253246] flex items-center gap-2 text-xs font-bold text-cyan-400 shadow-xl">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span>Loading {activeAsset.symbol} Market...</span>
          </div>
        </div>
      )}
    </div>
  );
};

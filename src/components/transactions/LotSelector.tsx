'use client';

import { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { formatCostBasisMethod, type CostBasisMethod } from '@/lib/cost-basis';

interface TaxLot {
  id: string;
  symbol: string;
  quantity: number;
  remainingQty: number;
  costBasis: number;
  acquiredDate: string;
}

interface LotSelectorProps {
  symbol: string;
  maxQuantity: number;
  sellPrice: number;
  sellDate: Date;
  onSelect: (lotIds: string[], method: CostBasisMethod) => void;
  onCancel: () => void;
}

export function LotSelector({
  symbol,
  maxQuantity,
  sellPrice,
  sellDate,
  onSelect,
  onCancel,
}: LotSelectorProps) {
  const [lots, setLots] = useState<TaxLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<CostBasisMethod>('FIFO');
  const [selectedLots, setSelectedLots] = useState<Map<string, number>>(new Map());
  const [totalSelected, setTotalSelected] = useState(0);

  useEffect(() => {
    async function fetchLots() {
      try {
        const response = await fetch(`/api/tax-lots?symbol=${encodeURIComponent(symbol)}`);
        const data = await response.json();
        if (data.taxLots) {
          setLots(data.taxLots.filter((lot: TaxLot) => lot.remainingQty > 0));
        }
      } catch (error) {
        console.error('Failed to fetch tax lots:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchLots();
  }, [symbol]);

  useEffect(() => {
    const total = Array.from(selectedLots.values()).reduce((sum, qty) => sum + qty, 0);
    setTotalSelected(total);
  }, [selectedLots]);

  const handleLotQuantityChange = (lotId: string, qty: number, maxQty: number) => {
    const newSelected = new Map(selectedLots);
    if (qty <= 0) {
      newSelected.delete(lotId);
    } else {
      newSelected.set(lotId, Math.min(qty, maxQty));
    }
    setSelectedLots(newSelected);
  };

  const handleConfirm = () => {
    if (method === 'SPECID') {
      const lotIds = Array.from(selectedLots.keys());
      onSelect(lotIds, method);
    } else {
      onSelect([], method);
    }
  };

  const calculateGainLoss = (lot: TaxLot, qty: number): number => {
    const costPerShare = lot.costBasis / lot.quantity;
    const costBasis = costPerShare * qty;
    const proceeds = sellPrice * qty;
    return proceeds - costBasis;
  };

  const isLongTerm = (acquiredDate: string): boolean => {
    const acquired = new Date(acquiredDate);
    const days = Math.floor((sellDate.getTime() - acquired.getTime()) / (1000 * 60 * 60 * 24));
    return days > 365;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <p className="text-gray-600 dark:text-gray-400">Loading tax lots...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select Lots to Sell - {symbol}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method selector */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Cost Basis Method
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(['FIFO', 'LIFO', 'HIFO', 'SPECID'] as CostBasisMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  method === m
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {formatCostBasisMethod(method)}
          </p>
        </div>

        {/* Lots table */}
        <div className="px-6 py-4 overflow-y-auto max-h-[40vh]">
          {method === 'SPECID' ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select specific lots to sell. Enter quantity for each lot.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="pb-2">Acquired</th>
                    <th className="pb-2">Available</th>
                    <th className="pb-2">Cost/Share</th>
                    <th className="pb-2">Term</th>
                    <th className="pb-2">Sell Qty</th>
                    <th className="pb-2 text-right">Est. G/L</th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot) => {
                    const selectedQty = selectedLots.get(lot.id) || 0;
                    const gainLoss = calculateGainLoss(lot, selectedQty);
                    const longTerm = isLongTerm(lot.acquiredDate);

                    return (
                      <tr key={lot.id} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="py-2">{formatDate(lot.acquiredDate)}</td>
                        <td className="py-2">{lot.remainingQty.toFixed(4)}</td>
                        <td className="py-2">${(lot.costBasis / lot.quantity).toFixed(2)}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            longTerm
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          }`}>
                            {longTerm ? 'Long' : 'Short'}
                          </span>
                        </td>
                        <td className="py-2">
                          <input
                            type="number"
                            min="0"
                            max={lot.remainingQty}
                            step="0.0001"
                            value={selectedQty || ''}
                            onChange={(e) =>
                              handleLotQuantityChange(lot.id, parseFloat(e.target.value) || 0, lot.remainingQty)
                            }
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                          />
                        </td>
                        <td className={`py-2 text-right ${
                          gainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {selectedQty > 0 && (
                            <>${gainLoss >= 0 ? '+' : ''}{gainLoss.toFixed(2)}</>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Lots will be automatically selected using {method} method when you confirm.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {method === 'SPECID' && (
              <>
                Selected: {totalSelected.toFixed(4)} of {maxQuantity.toFixed(4)} shares
                {totalSelected > maxQuantity && (
                  <span className="ml-2 text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Exceeds sell quantity
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={method === 'SPECID' && (totalSelected <= 0 || totalSelected > maxQuantity)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

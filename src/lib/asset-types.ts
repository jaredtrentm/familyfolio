/**
 * Asset type classification utilities
 * Used to categorize holdings into investment types (stocks, bonds, etc.)
 */

export type AssetType = 'Stocks' | 'Bonds' | 'Real Estate' | 'Commodities' | 'Cash' | 'Crypto' | 'Other';

// Known bond ETFs and funds
const BOND_SYMBOLS = new Set([
  'BND', 'AGG', 'TLT', 'IEF', 'SHY', 'LQD', 'HYG', 'JNK', 'TIP', 'VCIT', 'VCSH',
  'VGIT', 'VGSH', 'VGLT', 'BIV', 'BSV', 'BLV', 'GOVT', 'MUB', 'SUB', 'VTEB',
  'BNDX', 'IAGG', 'EMB', 'PCY', 'SCHZ', 'SCHO', 'SCHR', 'SCHQ', 'SPTL', 'SPLB',
  'IGSB', 'IGIB', 'IGLB', 'FLOT', 'NEAR', 'SHV', 'MINT', 'JPST', 'GSY', 'ICSH',
]);

// Known real estate ETFs/REITs
const REAL_ESTATE_SYMBOLS = new Set([
  'VNQ', 'VNQI', 'IYR', 'XLRE', 'SCHH', 'RWR', 'USRT', 'REET', 'SRVR', 'INDS',
  'O', 'AMT', 'PLD', 'CCI', 'EQIX', 'PSA', 'SPG', 'DLR', 'WELL', 'AVB',
  'EQR', 'MAA', 'UDR', 'CPT', 'ESS', 'AIV', 'INVH', 'SUI', 'ELS', 'CUBE',
  'EXR', 'LSI', 'NSA', 'COLD', 'STAG', 'TRNO', 'FR', 'IIPR', 'VICI', 'GLPI',
]);

// Known commodity ETFs
const COMMODITY_SYMBOLS = new Set([
  'GLD', 'SLV', 'IAU', 'GLDM', 'SIVR', 'PPLT', 'PALL', 'USO', 'UNG', 'DBC',
  'GSG', 'PDBC', 'DJP', 'COMT', 'BCI', 'USCI', 'RJI', 'FTGC', 'CPER', 'JJC',
  'WEAT', 'CORN', 'SOYB', 'CANE', 'NIB', 'JO', 'BAL', 'COW', 'UGA', 'BNO',
]);

// Known crypto ETFs/trusts
const CRYPTO_SYMBOLS = new Set([
  'GBTC', 'ETHE', 'BITO', 'BTF', 'XBTF', 'BITQ', 'BLOK', 'LEGR', 'DAPP',
  'IBIT', 'FBTC', 'ARKB', 'BITB', 'HODL', 'BTCO', 'EZBC', 'BRRR', 'BTCW',
  'COIN', // Coinbase (crypto-related stock)
]);

/**
 * Classify a holding into an asset type based on symbol and sector info
 */
export function classifyAssetType(
  symbol: string,
  sector?: string | null,
  industry?: string | null
): AssetType {
  const upperSymbol = symbol.toUpperCase().trim();

  // Check specific symbol lists first (most reliable)
  if (BOND_SYMBOLS.has(upperSymbol)) return 'Bonds';
  if (REAL_ESTATE_SYMBOLS.has(upperSymbol)) return 'Real Estate';
  if (COMMODITY_SYMBOLS.has(upperSymbol)) return 'Commodities';
  if (CRYPTO_SYMBOLS.has(upperSymbol)) return 'Crypto';

  // Check sector/industry for classification
  if (sector) {
    const lowerSector = sector.toLowerCase();
    if (lowerSector.includes('real estate') || lowerSector === 'reit') {
      return 'Real Estate';
    }
  }

  if (industry) {
    const lowerIndustry = industry.toLowerCase();
    if (lowerIndustry.includes('bond')) return 'Bonds';
    if (lowerIndustry.includes('real estate') || lowerIndustry.includes('reit')) {
      return 'Real Estate';
    }
    if (
      lowerIndustry.includes('gold') ||
      lowerIndustry.includes('silver') ||
      lowerIndustry.includes('commodit') ||
      lowerIndustry.includes('precious metal')
    ) {
      return 'Commodities';
    }
  }

  // Default to stocks for everything else (including stock ETFs like VTI, SPY)
  return 'Stocks';
}

/**
 * Get a display color for each asset type
 */
export function getAssetTypeColor(assetType: AssetType): string {
  switch (assetType) {
    case 'Stocks':
      return '#3B82F6'; // blue
    case 'Bonds':
      return '#10B981'; // green
    case 'Real Estate':
      return '#8B5CF6'; // purple
    case 'Commodities':
      return '#F59E0B'; // yellow/gold
    case 'Cash':
      return '#6B7280'; // gray
    case 'Crypto':
      return '#F97316'; // orange
    case 'Other':
    default:
      return '#94A3B8'; // slate
  }
}

/**
 * Asset type display order for charts
 */
export const ASSET_TYPE_ORDER: AssetType[] = [
  'Stocks',
  'Bonds',
  'Real Estate',
  'Commodities',
  'Cash',
  'Crypto',
  'Other',
];

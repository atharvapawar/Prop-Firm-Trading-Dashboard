// Mapping of instrument -> USD pip value per 1 standard lot.
// Values are conservative approximations used for lot-suggestions.
const normalize = (p: string) => (p || "").toUpperCase().replace(/[^A-Z]/g, "");

const PIP_VALUE_PER_LOT: Record<string, number> = {
  // Precious metals (common brokers — 1 lot ≈ 100oz, pip ≈ $0.01 → ~$100 per pip per lot)
  XAUUSD: 100,
  XAGUSD: 5,

  // Majors (USD quoted): roughly $10 per pip per 1 lot (100k)
  EURUSD: 10,
  GBPUSD: 10,
  USDCHF: 10,
  AUDUSD: 10,
  USDCAD: 10,
  NZDUSD: 10,
  EURGBP: 10,

  // Additional common crosses
  EURAUD: 10,
  GBPAUD: 10,
  EURCAD: 10,
  GBPCAD: 10,

  // JPY pairs — pip is 0.01; approximate USD-equivalent per lot (depends on rate)
  USDJPY: 9.1,
  EURJPY: 9.1,
  GBPJPY: 9.1,

  // Cryptos — very approximate and volatile; used only as fallback guidance
  BTCUSD: 1000,
  ETHUSD: 100,
  BNBUSD: 50,
  SOLUSD: 30,
  LTCUSD: 15,
};

export function getPipDollarPerLot(pair: string): number {
  const key = normalize(pair);
  return PIP_VALUE_PER_LOT[key] ?? 100; // fallback to 100 to preserve previous behaviour
}

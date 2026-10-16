import { v4 as uuidv4 } from 'uuid';

// ─── Constants ───────────────────────────────────────────────────────────────

const SYMBOLS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
  'HINDUNILVR', 'SBIN', 'BHARTIARTL', 'KOTAKBANK', 'BAJFINANCE',
  'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'WIPRO',
  'HCLTECH', 'SUNPHARMA', 'POWERGRID', 'NTPC', 'TECHM',
  'ULTRACEMCO', 'TITAN', 'ADANIENT', 'JSWSTEEL', 'TATAMOTORS',
  'ONGC', 'COALINDIA', 'BPCL', 'DIVISLAB', 'CIPLA',
];

const CLIENT_NAMES = [
  'Arjun Mehta', 'Priya Sharma', 'Rohit Verma', 'Ananya Singh', 'Vikram Patel',
  'Kavitha Nair', 'Siddharth Rao', 'Deepika Joshi', 'Aakash Gupta', 'Meera Iyer',
  'Rajesh Kumar', 'Sunita Agarwal', 'Nikhil Malhotra', 'Pooja Desai', 'Amit Tiwari',
  'Lavanya Krishnan', 'Harsh Chauhan', 'Ritu Bhatia', 'Suresh Pillai', 'Nalini Reddy',
  'Karan Bajaj', 'Shweta Saxena', 'Tarun Kapoor', 'Neha Mishra', 'Vivek Pandey',
  'Ishaan Shah', 'Divya Menon', 'Rajan Shetty', 'Anita Choudhary', 'Manish Dubey',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Returns a random integer between min and max (inclusive).
 */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Returns a random float rounded to 2 decimal places between min and max.
 */
const randPrice = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

/**
 * Returns a random Date within the past `days` days from now.
 */
const randDate = (days = 30) => {
  const now = Date.now();
  const offset = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
  return new Date(now - offset).toISOString();
};

// ─── Price bands per symbol (approx BSE levels in INR) ───────────────────────

const PRICE_BANDS = {
  RELIANCE:    [2400, 3100],
  TCS:         [3500, 4200],
  HDFCBANK:    [1500, 1800],
  INFY:        [1400, 1900],
  ICICIBANK:   [1050, 1350],
  HINDUNILVR:  [2300, 2900],
  SBIN:        [700,  900],
  BHARTIARTL:  [1400, 1800],
  KOTAKBANK:   [1700, 2100],
  BAJFINANCE:  [6500, 8000],
  LT:          [3200, 3900],
  AXISBANK:    [1100, 1400],
  ASIANPAINT:  [2700, 3400],
  MARUTI:      [10000, 13000],
  WIPRO:       [480,  620],
  HCLTECH:     [1500, 1900],
  SUNPHARMA:   [1600, 2100],
  POWERGRID:   [300,  400],
  NTPC:        [350,  480],
  TECHM:       [1300, 1700],
  ULTRACEMCO:  [9500, 12000],
  TITAN:       [3200, 4100],
  ADANIENT:    [2400, 3200],
  JSWSTEEL:    [800,  1100],
  TATAMOTORS:  [900,  1200],
  ONGC:        [260,  380],
  COALINDIA:   [420,  560],
  BPCL:        [300,  420],
  DIVISLAB:    [3800, 5000],
  CIPLA:       [1400, 1900],
};

// ─── Generator ───────────────────────────────────────────────────────────────

/**
 * Generates an array of seeded mock BSE trade records.
 *
 * @param {number} [count=3000] - Number of trades to generate
 * @returns {Array<{
 *   tradeId: string,
 *   clientName: string,
 *   symbol: string,
 *   quantity: number,
 *   price: number,
 *   timestamp: string
 * }>}
 */
export const generateMockTrades = (count = 3000) => {
  const trades = [];

  for (let i = 0; i < count; i++) {
    const symbol = pick(SYMBOLS);
    const [priceMin, priceMax] = PRICE_BANDS[symbol];

    trades.push({
      tradeId:    `BSE-${uuidv4().split('-')[0].toUpperCase()}-${String(i + 1).padStart(5, '0')}`,
      clientName: pick(CLIENT_NAMES),
      symbol,
      quantity:   randInt(1, 5000),
      price:      randPrice(priceMin, priceMax),
      timestamp:  randDate(30),
    });
  }

  // Sort by timestamp descending — most recent first
  trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return trades;
};

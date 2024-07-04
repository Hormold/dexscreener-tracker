import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import cron from "node-cron";
import { DatabaseTokenData, TokenData } from "./types";
import { connectWebSockets } from "./ws";
import { detectDeepSignals } from "./analyze";
import { generateReport, sendTelegramMessage } from "./report";
import { assert } from "console";

// Inspiration: https://x.com/snipegurusolvol
dotenv.config();
assert(process.env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN is not set");
assert(process.env.TELEGRAM_CHAT_ID, "TELEGRAM_CHAT_ID is not set");

const WS_TRENDING =
  "wss://io.dexscreener.com/dex/screener/pairs/h24/1?rankBy[key]=trendingScoreH6&rankBy[order]=desc";
const WS_GAINERS =
  "wss://io.dexscreener.com/dex/screener/pairs/h24/1?rankBy[key]=priceChangeH24&rankBy[order]=desc&filters[liquidity][min]=25000&filters[txns][h24][min]=50&filters[volume][h24][min]=10000";
const WS_NEWEST =
  "wss://io.dexscreener.com/dex/screener/pairs/h24/1?rankBy[key]=volume&rankBy[order]=desc&filters[pairAge][max]=24";

const WS_CONNECTIONS = [
  //WS_TRENDING,
  WS_GAINERS,
  //WS_NEWEST,
];

let db: Database;
let veryLastData = new Map<string, DatabaseTokenData>();

async function initDatabase() {
  db = await open({
    filename: "./tokendata.sqlite",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS token_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pairAddress TEXT,
      baseTokenSymbol TEXT,
      baseTokenAddress TEXT,
      price TEXT,
      priceUsd TEXT,
      txnsBuys5m INTEGER,
      txnsSells5m INTEGER,
      volume5m REAL,
      volume1h REAL,
      priceChange5m REAL,
      priceChange1h REAL,
      liquidityUsd REAL,
      marketCap REAL,
      timestamp INTEGER
    )
  `);

  // Create indexes
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pairAddress ON token_data(pairAddress);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON token_data(timestamp);
  `);
}

async function saveTokenData(token: TokenData) {
  // Check is this data already saved
  const lastData = veryLastData.get(token.pairAddress);

  if (
    lastData &&
    lastData.price === token.price &&
    lastData.priceUsd === token.priceUsd
  ) {
    return;
  }

  await db.run(
    `
    INSERT INTO token_data (
      pairAddress, baseTokenSymbol, baseTokenAddress, price, priceUsd,
      txnsBuys5m, txnsSells5m, volume5m, volume1h,
      priceChange5m, priceChange1h, liquidityUsd, marketCap, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      token.pairAddress,
      token.baseToken.symbol,
      token.baseToken.address,
      token.price,
      token.priceUsd,
      token.txns.m5.buys,
      token.txns.m5.sells,
      token.volume.m5,
      token.volume.h1,
      token.priceChange.m5,
      token.priceChange.h1,
      token?.liquidity?.usd ?? 0,
      token.marketCap,
      Date.now(),
    ]
  );

  veryLastData.set(token.pairAddress, {
    pairAddress: token.pairAddress,
    baseTokenSymbol: token.baseToken.symbol,
    baseTokenAddress: token.baseToken.address,
    price: token.price,
    priceUsd: token.priceUsd,
    txnsBuys5m: token.txns.m5.buys,
    txnsSells5m: token.txns.m5.sells,
    volume5m: token.volume.m5,
    volume1h: token.volume.h1,
    priceChange5m: token.priceChange.m5,
    priceChange1h: token.priceChange.h1,
    liquidityUsd: token?.liquidity?.usd ?? 0,
    marketCap: token.marketCap,
    timestamp: Date.now(),
  });
}

async function deepAnalysis() {
  const tokens = await db.all<DatabaseTokenData[]>(
    `
    SELECT * FROM token_data
    WHERE timestamp > ?
    GROUP BY pairAddress
    HAVING MAX(timestamp)
  `,
    [Date.now() - 30 * 60 * 1000]
  );

  for (const token of tokens) {
    const signals = await detectDeepSignals(token, db);
    if (signals.length > 0) {
      const report = await generateReport(token, signals, false);
      await sendTelegramMessage(report);
    }
  }
}

async function main() {
  await initDatabase();
  for (const ws of WS_CONNECTIONS) {
    connectWebSockets(ws, async (pairs: TokenData[]) => {
      for (const pair of pairs) {
        if (pair.chainId !== "solana") {
          continue;
        }
        await saveTokenData(pair);
        // Uncomment this to enable fresh signals
        /*const freshSignals = await detectFreshSignals(pair, db);
        if (freshSignals.length > 0) {
          const report = await generateReport(pair, freshSignals, true);
          await sendTelegramMessage(report);
        }*/
      }
    });
  }
  cron.schedule("*/30 * * * *", deepAnalysis);
}

main().catch(console.error);

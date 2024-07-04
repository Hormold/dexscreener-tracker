import axios from "axios";
import { DatabaseTokenData, TokenData } from "./types";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SCREENSHOT_API_KEY = process.env.SCREENSHOT_API_KEY;

export async function generateReport(
  token: TokenData | DatabaseTokenData,
  signals: string[],
  isFresh: boolean
): Promise<string> {
  const pairAge = Math.floor(
    (Date.now() - ("pairCreatedAt" in token ? token.pairCreatedAt : 0)) / 60000
  );
  const liquidityUsd = (
    "liquidity" in token ? token.liquidity.usd : token.liquidityUsd
  ).toFixed(2);
  const volumeUsd5m = (
    ("volume" in token ? token.volume.m5 : token.volume5m) *
    parseFloat(token.priceUsd)
  ).toFixed(2);
  const volumeUsd1h = (
    ("volume" in token ? token.volume.h1 : token.volume1h) *
    parseFloat(token.priceUsd)
  ).toFixed(2);

  const baseTokenSymbol =
    "baseToken" in token ? token.baseToken.symbol : token.baseTokenSymbol;
  const baseTokenAddress =
    "baseToken" in token ? token.baseToken.address : token.baseTokenAddress;

  const screenshotUrl = await getScreenshot(
    `https://photon-sol.tinyastro.io/en/lp/${baseTokenAddress}`
  );

  return `
🚨 ${isFresh ? "FRESH" : "DEEP"} BUY SIGNAL DETECTED 🚨

Token: $${baseTokenSymbol}
Contract Address: ${baseTokenAddress}
Pair Address: ${"pairAddress" in token ? token.pairAddress : "N/A"}

Signals Triggered:
${signals.map((signal) => `- ${signal}`).join("\n")}

Token Info:
- Pair Age: ${pairAge} minutes
- Liquidity: $${liquidityUsd}
- Market Cap: $${token.marketCap.toFixed(0)}
- Price: $${token.priceUsd}

Volume:
- 5m: $${volumeUsd5m}
- 1h: $${volumeUsd1h}
${
  "volume" in token
    ? `- 6h: $${(token.volume.h6 * parseFloat(token.priceUsd)).toFixed(2)}
- 24h: $${(token.volume.h24 * parseFloat(token.priceUsd)).toFixed(2)}`
    : ""
}

Transactions (5m):
- Buys: ${"txns" in token ? token.txns.m5.buys : token.txnsBuys5m}
- Sells: ${"txns" in token ? token.txns.m5.sells : token.txnsSells5m}

Price Change:
- 5m: ${"priceChange" in token ? token.priceChange.m5 : token.priceChange5m}%
- 1h: ${"priceChange" in token ? token.priceChange.h1 : token.priceChange1h}%
${
  "priceChange" in token
    ? `- 6h: ${token.priceChange.h6}%
- 24h: ${token.priceChange.h24}%`
    : ""
}

Links:
- TinyAstro: https://photon-sol.tinyastro.io/en/lp/${baseTokenAddress}
- DexScreener: https://dexscreener.com/solana/${
    "pairAddress" in token ? token.pairAddress : "N/A"
  }
- RugCheck: https://rugcheck.xyz/tokens/${baseTokenAddress}

Screenshot:
${screenshotUrl}

Always DYOR before investing!`;
}

async function getScreenshot(url: string): Promise<string> {
  return "";
}

export async function sendTelegramMessage(message: string) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }
    );
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
}

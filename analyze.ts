import { Database } from "sqlite";
import { DatabaseTokenData, TokenData } from "./types";

export async function detectFreshSignals(
  token: TokenData,
  db: Database
): Promise<string[]> {
  const signals: string[] = [];

  // Получаем предыдущие данные токена
  const prevData = await db.get<DatabaseTokenData>(
    `
    SELECT * FROM token_data
    WHERE pairAddress = ? AND timestamp < ?
    ORDER BY timestamp DESC LIMIT 1
  `,
    [token.pairAddress, Date.now() - 5 * 60 * 1000]
  );

  if (prevData) {
    // Улучшенный детектор 1: Объемный всплеск с учетом цены
    const volumeUsdIncrease =
      (token.volume.m5 * parseFloat(token.priceUsd)) /
        (prevData.volume5m * parseFloat(prevData.priceUsd)) -
      1;
    if (volumeUsdIncrease > 2) {
      // 200% увеличение объема в USD
      signals.push(
        `Volume Spike: ${(volumeUsdIncrease * 100).toFixed(
          2
        )}% increase in 5-minute USD volume`
      );
    }

    // Улучшенный детектор 2: Устойчивый рост цены
    const priceIncrease =
      parseFloat(token.priceUsd) / parseFloat(prevData.priceUsd) - 1;
    if (priceIncrease > 0.1 && token.priceChange.h1 > 0) {
      // 10% рост за 5 минут и положительный рост за час
      signals.push(
        `Sustained Price Growth: ${(priceIncrease * 100).toFixed(
          2
        )}% in 5 minutes with positive 1h trend`
      );
    }

    // Улучшенный детектор 3: Соотношение покупок/продаж с учетом объема
    const buyVolume = token.txns.m5.buys * parseFloat(token.priceUsd);
    const sellVolume = token.txns.m5.sells * parseFloat(token.priceUsd);
    const buyToSellRatio = buyVolume / (sellVolume || 1);
    if (buyToSellRatio > 2 && token.volume.m5 > prevData.volume5m * 1.5) {
      signals.push(
        `High Buy Pressure: ${buyToSellRatio.toFixed(
          2
        )} buy/sell volume ratio with increased overall volume`
      );
    }

    // Улучшенный детектор 4: Ускорение роста ликвидности
    const liquidityGrowthRate =
      (token.liquidity.usd - prevData.liquidityUsd) / prevData.liquidityUsd;
    const prevLiquidityGrowthRate =
      (prevData.liquidityUsd - token.liquidity.usd) / token.liquidity.usd;
    if (
      liquidityGrowthRate > 0.1 &&
      liquidityGrowthRate > prevLiquidityGrowthRate * 2
    ) {
      signals.push(
        `Accelerating Liquidity Growth: ${(liquidityGrowthRate * 100).toFixed(
          2
        )}% increase, ${(liquidityGrowthRate / prevLiquidityGrowthRate).toFixed(
          2
        )}x acceleration`
      );
    }
  }

  // Улучшенный детектор 5: Новая пара с высокой активностью и ростом
  const pairAge = (Date.now() - token.pairCreatedAt) / (60 * 1000); // в минутах
  if (
    pairAge < 60 &&
    token.txns.h1.buys + token.txns.h1.sells > 1000 &&
    token.priceChange.h1 > 20
  ) {
    signals.push(
      `Hot New Pair: ${pairAge.toFixed(2)} minutes old, ${
        token.txns.h1.buys + token.txns.h1.sells
      } transactions, ${token.priceChange.h1.toFixed(
        2
      )}% price increase in 1 hour`
    );
  }

  return signals;
}

export async function detectDeepSignals(
  token: DatabaseTokenData,
  db: Database
): Promise<string[]> {
  const signals: string[] = [];

  // Получаем данные за последние 30 минут
  const historicalData = await db.all<DatabaseTokenData[]>(
    `
    SELECT * FROM token_data
    WHERE pairAddress = ? AND timestamp > ?
    ORDER BY timestamp ASC
  `,
    [token.pairAddress, Date.now() - 30 * 60 * 1000]
  );

  if (historicalData.length > 1) {
    const oldestData = historicalData[0];
    const newestData = historicalData[historicalData.length - 1];

    // Детектор 1: Устойчивый рост с увеличением объема
    const priceGrowth =
      (parseFloat(newestData.priceUsd) / parseFloat(oldestData.priceUsd) - 1) *
      100;
    const volumeGrowth = (newestData.volume1h / oldestData.volume1h - 1) * 100;
    if (priceGrowth > 20 && volumeGrowth > 100) {
      signals.push(
        `Sustained Growth: ${priceGrowth.toFixed(
          2
        )}% price increase and ${volumeGrowth.toFixed(
          2
        )}% volume increase over 30 minutes`
      );
    }

    // Детектор 2: Последовательное увеличение ликвидности
    const liquidityGrowth =
      (newestData.liquidityUsd / oldestData.liquidityUsd - 1) * 100;
    const consistentLiquidityGrowth = historicalData.every(
      (data, index) =>
        index === 0 ||
        data.liquidityUsd >= historicalData[index - 1].liquidityUsd
    );
    if (liquidityGrowth > 50 && consistentLiquidityGrowth) {
      signals.push(
        `Strong Liquidity Growth: ${liquidityGrowth.toFixed(
          2
        )}% increase with consistent growth over 30 minutes`
      );
    }

    // Детектор 3: Увеличение активности торгов
    const txGrowth =
      ((newestData.txnsBuys5m + newestData.txnsSells5m) /
        (oldestData.txnsBuys5m + oldestData.txnsSells5m) -
        1) *
      100;
    if (
      txGrowth > 200 &&
      newestData.txnsBuys5m > newestData.txnsSells5m * 1.5
    ) {
      signals.push(
        `Increasing Trade Activity: ${txGrowth.toFixed(
          2
        )}% more transactions with strong buying pressure`
      );
    }

    // Детектор 4: Стабильный рост рыночной капитализации
    const mcapGrowth = (newestData.marketCap / oldestData.marketCap - 1) * 100;
    const avgMcapGrowth =
      historicalData.reduce(
        (sum, data, index, array) =>
          index === 0
            ? 0
            : sum + (data.marketCap / array[index - 1].marketCap - 1) * 100,
        0
      ) /
      (historicalData.length - 1);
    if (mcapGrowth > 30 && avgMcapGrowth > 0) {
      signals.push(
        `Steady Market Cap Growth: ${mcapGrowth.toFixed(
          2
        )}% total increase with ${avgMcapGrowth.toFixed(
          2
        )}% average growth rate`
      );
    }

    // Детектор 5: Ускорение роста цены
    const priceGrowthRates = historicalData.map((data, index, array) =>
      index === 0
        ? 0
        : (parseFloat(data.priceUsd) / parseFloat(array[index - 1].priceUsd) -
            1) *
          100
    );
    const avgPriceGrowthRate =
      priceGrowthRates.reduce((sum, rate) => sum + rate, 0) /
      priceGrowthRates.length;
    const recentPriceGrowthRate = priceGrowthRates[priceGrowthRates.length - 1];
    if (
      recentPriceGrowthRate > avgPriceGrowthRate * 2 &&
      recentPriceGrowthRate > 5
    ) {
      signals.push(
        `Accelerating Price Growth: Recent growth rate ${recentPriceGrowthRate.toFixed(
          2
        )}% vs average ${avgPriceGrowthRate.toFixed(2)}%`
      );
    }
  }

  return signals;
}

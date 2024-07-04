export interface TokenData {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    name: string;
    symbol: string;
    address: string;
  };
  price: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  marketCap: number;
  pairCreatedAt: number;
}

export interface DatabaseTokenData {
  pairAddress: string;
  baseTokenSymbol: string;
  baseTokenAddress: string;
  price: string;
  priceUsd: string;
  txnsBuys5m: number;
  txnsSells5m: number;
  volume5m: number;
  volume1h: number;
  priceChange5m: number;
  priceChange1h: number;
  liquidityUsd: number;
  marketCap: number;
  timestamp: number;
}

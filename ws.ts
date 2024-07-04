import WebSocket from "ws";
import { TokenData } from "./types";
import axios from "axios";

export async function connectWebSockets(
  url: string,
  onSignal: (pair: TokenData[]) => void
) {
  const response = await axios.get("https://dd.dexscreener.com/ds-data/dexes", {
    headers: {
      "User-Agent":
        "DEX Screener/2.0.852004 Mozilla/5.0 (Linux; Android 11; sdk_gphone_x86 Build/RSR1.201013.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
    },
  });

  const cookies = response.headers["set-cookie"];
  const ws = new WebSocket(url, ["wss"], {
    origin: "https://dexscreener.com",
    protocolVersion: 13,
    headers: {
      Origin: "https://io.dexscreener.com",
      "User-Agent":
        "DEX Screener/2.0.852004 Mozilla/5.0 (Linux; Android 11; sdk_gphone_x86 Build/RSR1.201013.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36",
      "Sec-Websocket-Extensions": `permessage-deflate; client_max_window_bits`,
      "Sec-Websocket-Key": `nIVqapHSfutralw6fW7Y2Q==`,
      "Sec-Websocket-Version": `13`,
      "x-client-name": "dex-screener-app",
      cookie: cookies,
    },
  });

  ws.on("open", () => {
    console.log("WebSocket connection established");
    setInterval(() => {
      ws.send("ping");
    }, 60000);
  });

  ws.on("message", async (data) => {
    const parsedData = JSON.parse(data.toString());
    if (parsedData.pairs) {
      onSignal(parsedData.pairs);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed. Reconnecting...");
    setTimeout(() => connectWebSockets(url, onSignal), 5000);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
}

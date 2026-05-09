import { useState, useEffect, useRef } from "preact/hooks";
import { fetchLiveFirst } from "../config/api";

type LiveCoin = {
  symbol: string;
  price: number;
  change_24h: number;
  volume_24h: number;
};

type LiveData = {
  coins: LiveCoin[];
  source?: string;
  generated: string;
};

// OKX public WebSocket — no auth required for ticker channel
const OKX_WS_URL = "wss://ws.okx.com:8443/ws/v5/public";
const RECONNECT_DELAY_MS = 3_000;
const PING_INTERVAL_MS = 25_000; // OKX closes connection if no ping within 30s
const POLL_FALLBACK_MS = 30_000; // REST polling cadence when WS unavailable

export function useMarketLive() {
  const [btcPrice, setBtcPrice] = useState(0);
  const [btcChange, setBtcChange] = useState(0);
  const [ethPrice, setEthPrice] = useState(0);
  const [ethChange, setEthChange] = useState(0);
  const [generated, setGenerated] = useState("");
  const [flash, setFlash] = useState<{ btc: string; eth: string }>({
    btc: "",
    eth: "",
  });
  const [error, setError] = useState(false);

  const prevBtc = useRef(0);
  const prevEth = useRef(0);
  const flashTimers = useRef<number[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const pingTimer = useRef<number | null>(null);
  const pollTimer = useRef<number | null>(null);
  const wsAlive = useRef(false);

  const triggerFlash = (
    coin: "btc" | "eth",
    prevPrice: number,
    newPrice: number,
  ) => {
    if (!prevPrice || newPrice === prevPrice) return;
    const dir = newPrice > prevPrice ? "flash-up" : "flash-down";
    setFlash((f) => ({ ...f, [coin]: dir }));
    const tid = window.setTimeout(
      () => setFlash((f) => ({ ...f, [coin]: "" })),
      600,
    );
    flashTimers.current.push(tid);
  };

  // REST fallback — used before WS connects and when WS is down
  const fetchLive = () => {
    fetchLiveFirst<LiveData>("/market/live", "/data/coins-stats.json")
      .then((data) => {
        const coins = data.coins || [];
        const btc = coins.find((c) => c.symbol === "BTCUSDT");
        const eth = coins.find((c) => c.symbol === "ETHUSDT");

        const newBtc = btc?.price ?? 0;
        const newEth = eth?.price ?? 0;

        triggerFlash("btc", prevBtc.current, newBtc);
        triggerFlash("eth", prevEth.current, newEth);

        prevBtc.current = newBtc;
        prevEth.current = newEth;

        setBtcPrice(newBtc);
        setBtcChange(btc?.change_24h ?? 0);
        setEthPrice(newEth);
        setEthChange(eth?.change_24h ?? 0);
        setGenerated(data.generated || "");
        setError(false);
      })
      .catch(() => setError(true));
  };

  const startFallbackPoll = () => {
    if (pollTimer.current) return;
    fetchLive();
    pollTimer.current = window.setInterval(fetchLive, POLL_FALLBACK_MS);
  };

  const stopFallbackPoll = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const connectWS = () => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
    }

    const ws = new WebSocket(OKX_WS_URL);
    wsRef.current = ws;
    wsAlive.current = false;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          op: "subscribe",
          args: [
            { channel: "tickers", instId: "BTC-USDT" },
            { channel: "tickers", instId: "ETH-USDT" },
          ],
        }),
      );

      // Keep-alive ping every 25s
      if (pingTimer.current) clearInterval(pingTimer.current);
      pingTimer.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (e) => {
      if (e.data === "pong") return;

      let msg: {
        arg?: { instId?: string };
        data?: Array<Record<string, string>>;
      };
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      const ticker = msg.data?.[0];
      if (!ticker || !ticker.last || !ticker.open24h) return;

      const instId = ticker.instId ?? msg.arg?.instId ?? "";
      const price = parseFloat(ticker.last);
      const open24h = parseFloat(ticker.open24h);
      const change = open24h ? ((price - open24h) / open24h) * 100 : 0;
      const ts = ticker.ts
        ? new Date(parseInt(ticker.ts)).toISOString()
        : new Date().toISOString();

      if (instId === "BTC-USDT") {
        triggerFlash("btc", prevBtc.current, price);
        prevBtc.current = price;
        setBtcPrice(price);
        setBtcChange(change);
        setGenerated(ts);
        setError(false);
        if (!wsAlive.current) {
          wsAlive.current = true;
          stopFallbackPoll();
        }
      } else if (instId === "ETH-USDT") {
        triggerFlash("eth", prevEth.current, price);
        prevEth.current = price;
        setEthPrice(price);
        setEthChange(change);
        if (!wsAlive.current) {
          wsAlive.current = true;
          stopFallbackPoll();
        }
      }
    };

    ws.onerror = () => {
      setError(true);
      startFallbackPoll();
    };

    ws.onclose = () => {
      wsAlive.current = false;
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
      startFallbackPoll();
      // Reconnect after delay
      reconnectTimer.current = window.setTimeout(connectWS, RECONNECT_DELAY_MS);
    };
  };

  useEffect(() => {
    // Start REST fetch immediately so first-paint data arrives fast
    fetchLive();
    // Connect WebSocket (takes over once streaming starts)
    connectWS();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingTimer.current) clearInterval(pingTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
      flashTimers.current.forEach((t) => clearTimeout(t));
      flashTimers.current = [];
    };
  }, []);

  return {
    btcPrice,
    btcChange,
    ethPrice,
    ethChange,
    flash,
    generated,
    error,
    retry: fetchLive,
  };
}

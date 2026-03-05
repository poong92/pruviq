import { useState, useEffect, useRef } from 'preact/hooks';
import { fetchLiveFirst } from '../config/api';

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

const POLL_MS = 30_000; // 30 seconds

export function useMarketLive() {
  const [btcPrice, setBtcPrice] = useState(0);
  const [btcChange, setBtcChange] = useState(0);
  const [ethPrice, setEthPrice] = useState(0);
  const [ethChange, setEthChange] = useState(0);
  const [generated, setGenerated] = useState('');
  const [flash, setFlash] = useState<{ btc: string; eth: string }>({ btc: '', eth: '' });
  const [error, setError] = useState(false);

  const prevBtc = useRef(0);
  const prevEth = useRef(0);
  const flashTimers = useRef<number[]>([]);

  const fetchLive = () => {
    // NOTE: coins-stats.json has a superset schema (name, image, sparkline_7d, etc.)
    // but shares the fields we use: symbol, price, change_24h, generated.
    fetchLiveFirst('/market/live', '/data/coins-stats.json')
      .then((data: LiveData) => {
        const coins = data.coins || [];
        const btc = coins.find(c => c.symbol === 'BTCUSDT');
        const eth = coins.find(c => c.symbol === 'ETHUSDT');

        const newBtcPrice = btc?.price ?? 0;
        const newEthPrice = eth?.price ?? 0;

        // Flash detection
        if (prevBtc.current && newBtcPrice !== prevBtc.current) {
          const dir = newBtcPrice > prevBtc.current ? 'flash-up' : 'flash-down';
          setFlash(f => ({ ...f, btc: dir }));
          const tid = window.setTimeout(() => setFlash(f => ({ ...f, btc: '' })), 600);
          flashTimers.current.push(tid);
        }
        if (prevEth.current && newEthPrice !== prevEth.current) {
          const dir = newEthPrice > prevEth.current ? 'flash-up' : 'flash-down';
          setFlash(f => ({ ...f, eth: dir }));
          const tid = window.setTimeout(() => setFlash(f => ({ ...f, eth: '' })), 600);
          flashTimers.current.push(tid);
        }

        prevBtc.current = newBtcPrice;
        prevEth.current = newEthPrice;

        setBtcPrice(newBtcPrice);
        setBtcChange(btc?.change_24h ?? 0);
        setEthPrice(newEthPrice);
        setEthChange(eth?.change_24h ?? 0);
        setGenerated(data.generated || '');
        setError(false);
      })
      .catch(() => setError(true));
  };

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, POLL_MS);
    return () => {
      clearInterval(id);
      flashTimers.current.forEach(t => clearTimeout(t));
      flashTimers.current = [];
    };
  }, []);

  return { btcPrice, btcChange, ethPrice, ethChange, flash, generated, error, retry: fetchLive };
}

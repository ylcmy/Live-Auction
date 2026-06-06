// k6 bid consistency test with 500 concurrent bidders (CAS-based)
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { Counter, Trend } from 'k6/metrics';

const bidAccepted = new Counter('bid_accepted');
const bidRejected = new Counter('bid_rejected_cas');
const bidLatency = new Trend('bid_latency_ms');

export const options = {
  scenarios: {
    bidding: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 100 },
        { duration: '10s', target: 500 },
        { duration: '20s', target: 500 },
        { duration: '5s', target: 0 },
      ],
    },
  },
  thresholds: {
    bid_latency_ms: ['p(95)<500'], // 95th percentile latency < 500ms
    bid_accepted: ['count>100'],   // At least 100 bids accepted
  },
};

export default function () {
  const token = __ENV.TEST_TOKEN || 'test-token';
  const url = `ws://localhost:3001/socket.io/?EIO=4&transport=websocket`;
  ws.connect(url, { auth: { token } }, (socket) => {
    socket.on('open', () => {
      socket.emit('auction:join', { roomId: 1 });

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        const key = uuidv4();
        socket.emit('bid:submit', { sessionId: 1, idempotencyKey: key });

        socket.on('bid:accepted', (data: any) => {
          bidLatency.add(Date.now() - start);
          bidAccepted.add(1);
          check(data, { 'bid accepted has amount': (d: any) => d.amount !== undefined });
        });

        socket.on('bid:rejected', (data: any) => {
          if (data.code === 40902) {
            bidRejected.add(1); // CAS failure (price changed) - expected
          }
        });

        sleep(0.2);
      }
    });

    socket.setTimeout(() => socket.close(), 20000);
  });
}

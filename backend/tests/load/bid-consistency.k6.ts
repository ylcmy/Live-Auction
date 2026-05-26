// k6 bid consistency test with 100 concurrent bidders
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  scenarios: {
    bidding: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 100 },
        { duration: '20s', target: 100 },
        { duration: '5s', target: 0 },
      ],
    },
  },
};

export default function () {
  const token = __ENV.TEST_TOKEN || 'test-token';
  const url = `ws://localhost:3001/socket.io/?EIO=4&transport=websocket`;
  ws.connect(url, { auth: { token } }, (socket) => {
    socket.on('open', () => {
      socket.emit('auction:join', { roomId: 1 });
      for (let i = 0; i < 10; i++) {
        socket.emit('bid:submit', { sessionId: 1, idempotencyKey: uuidv4() });
        sleep(0.5);
      }
    });
    socket.setTimeout(() => socket.close(), 15000);
  });
}

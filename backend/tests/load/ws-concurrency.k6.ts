// k6 WebSocket load test script (run with: k6 run this-file.ts)
// Requires k6 installed: https://k6.io/docs/get-started/installation/

import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '30s', target: 500 },
    { duration: '10s', target: 0 },
  ],
};

export default function () {
  const token = __ENV.TEST_TOKEN || 'test-token';
  const url = `ws://localhost:3001/socket.io/?EIO=4&transport=websocket`;
  const res = ws.connect(url, { auth: { token } }, (socket) => {
    socket.on('open', () => {
      socket.emit('auction:join', { roomId: 1 });
    });
    socket.on('bid:accepted', (data) => {
      check(data, { 'bid accepted': (d: any) => d !== undefined }); // eslint-disable-line @typescript-eslint/no-explicit-any
    });
    socket.setTimeout(() => socket.close(), 10000);
  });
}

const API_BASE = 'http://localhost:3002';

async function post(path: string, data: Record<string, unknown>) {
  try {
    await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // ignore errors (e.g., user already exists)
  }
}

async function seedDemoAccounts() {
  await post('/api/auth/register', { username: 'merchant_1', password: 'pass1234', nickname: '商家测试', role: 'merchant' });
  await post('/api/auth/register', { username: 'user_1', password: 'pass1234', nickname: '用户测试', role: 'user' });
  await post('/api/auth/register', { username: 'user_2', password: 'pass1234', nickname: '用户测试2', role: 'user' });
}

export default async function globalSetup() {
  // Wait for backend to be ready
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) break;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  await seedDemoAccounts();
  console.log('✅ Demo accounts seeded');
}

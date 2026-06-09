export const BID_CAS_SCRIPT = `
local topBidKey       = KEYS[1]
local lbKey           = KEYS[2]
local participantsKey = KEYS[3]
local userId          = ARGV[1]
local bidAmount       = tonumber(ARGV[2])
local bidData         = ARGV[3]
local ceilingPrice    = tonumber(ARGV[4])

-- 1. 读取当前最高出价
local currentRaw = redis.call('GET', topBidKey)
local currentAmount = 0
if currentRaw then
  local ok, current = pcall(cjson.decode, currentRaw)
  if not ok then return 0 end
  currentAmount = tonumber(current.amount) or 0
end

-- 2. 严格校验: 新出价必须大于当前价
if bidAmount <= currentAmount then
  return 0
end

-- 3. 封顶价校验
if ceilingPrice > 0 and bidAmount > ceilingPrice then
  bidAmount = ceilingPrice
  if bidAmount <= currentAmount then
    return 0
  end
  -- 同步更新 bidData 中的 amount 以反映截断后的实际金额
  local parsed = cjson.decode(bidData)
  parsed.amount = bidAmount
  bidData = cjson.encode(parsed)
end

-- 4. 原子写入
redis.call('SET', topBidKey, bidData)
redis.call('ZADD', lbKey, bidAmount, userId)
redis.call('SADD', participantsKey, userId)

return 1
`;

export const BID_ROLLBACK_SCRIPT = `
local lbKey           = KEYS[1]
local participantsKey = KEYS[2]
local topBidKey       = KEYS[3]
local userId          = ARGV[1]
local prevTopBidData  = ARGV[2]
local currentTimestamp = ARGV[3]

redis.call('ZREM', lbKey, userId)
redis.call('SREM', participantsKey, userId)

-- 从排行榜重新计算 top_bid
local topEntry = redis.call('ZREVRANGE', lbKey, 0, 0, 'WITHSCORES')
if topEntry and #topEntry >= 2 then
  local topUserId = topEntry[1]
  local topAmount = topEntry[2]
  redis.call('SET', topBidKey, cjson.encode({userId = topUserId, amount = tonumber(topAmount), timestamp = currentTimestamp}))
elseif prevTopBidData and prevTopBidData ~= '' then
  redis.call('SET', topBidKey, prevTopBidData)
else
  redis.call('DEL', topBidKey)
end
return 1
`;

/**
 * 出价限流 Lua 脚本：原子执行 ZREMRANGEBYSCORE + ZCARD + ZADD + EXPIRE
 *
 * KEYS[1] = ratelimit:{sessionId}:{userId}
 * ARGV[1] = now (ms)
 * ARGV[2] = window start (ms)
 * ARGV[3] = max rate
 * ARGV[4] = TTL (seconds)
 *
 * returns: {currentCount} — 当前窗口内请求次数，>= maxRate 表示被限流
 */
export const BID_RATE_LIMIT_SCRIPT = `
local rateKey  = KEYS[1]
local now      = ARGV[1]
local winStart = ARGV[2]
local maxRate  = tonumber(ARGV[3])
local ttl      = tonumber(ARGV[4])

redis.call('ZREMRANGEBYSCORE', rateKey, 0, winStart)
local count = redis.call('ZCARD', rateKey)
if count < maxRate then
  redis.call('ZADD', rateKey, now, now)
  redis.call('EXPIRE', rateKey, ttl)
end
return count
`;

/** 分布式锁释放脚本：校验锁值后删除，防止误删 */
export const LOCK_RELEASE_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  else
    return 0
  end
`;

/** 分布式锁续期脚本：校验锁值后续期，防止续期他人锁 */
export const LOCK_RENEW_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('PEXPIRE', KEYS[1], ARGV[2])
  else
    return 0
  end
`;

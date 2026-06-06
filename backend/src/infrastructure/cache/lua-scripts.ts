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
  local current = cjson.decode(currentRaw)
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

export const BID_COMMIT_SCRIPT = `
local lbKey = KEYS[1]
local participantsKey = KEYS[2]
local topBidKey = KEYS[3]
local userId = ARGV[1]
local bidAmount = tonumber(ARGV[2])
local topBidData = ARGV[3]

redis.call('ZADD', lbKey, bidAmount, userId)
redis.call('SADD', participantsKey, userId)
redis.call('SET', topBidKey, topBidData)

return 1
`;

export const BID_ROLLBACK_SCRIPT = `
local lbKey           = KEYS[1]
local participantsKey = KEYS[2]
local topBidKey       = KEYS[3]
local userId          = ARGV[1]
local prevTopBidData  = ARGV[2]

redis.call('ZREM', lbKey, userId)
redis.call('SREM', participantsKey, userId)

-- 从排行榜重新计算 top_bid
local topEntry = redis.call('ZREVRANGE', lbKey, 0, 0, 'WITHSCORES')
if topEntry and #topEntry >= 2 then
  local topUserId = topEntry[1]
  local topAmount = topEntry[2]
  redis.call('SET', topBidKey, '{"userId":"' .. topUserId .. '","amount":' .. topAmount .. '}')
elseif prevTopBidData and prevTopBidData ~= '' then
  redis.call('SET', topBidKey, prevTopBidData)
else
  redis.call('DEL', topBidKey)
end
return 1
`;

export const UNLOCK_SCRIPT = `
local lockKey = KEYS[1]
local lockValue = ARGV[1]

if redis.call('GET', lockKey) == lockValue then
  redis.call('DEL', lockKey)
  return 1
else
  return 0
end
`;

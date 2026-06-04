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
local lbKey = KEYS[1]
local participantsKey = KEYS[2]
local topBidKey = KEYS[3]
local userId = ARGV[1]
local previousTopBidData = ARGV[2]

redis.call('ZREM', lbKey, userId)
redis.call('SREM', participantsKey, userId)
if previousTopBidData and previousTopBidData ~= '' then
  redis.call('SET', topBidKey, previousTopBidData)
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

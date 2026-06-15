export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIChatRequest {
  messages: AIMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface AIChatResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface AIStreamChunk {
  content: string
  done: boolean
}

export interface AuctionContext {
  room: { title: string; viewerCount: number }
  currentAuction: {
    productName: string
    productDescription: string
    category: string
    startPrice: number
    currentPrice: number
    ceilingPrice: number | null
    bidIncrement: number
    remainingSeconds: number
    extensionCount: number
    totalBids: number
    leadingBidder: string
    isUserLeading: boolean
  } | null
  nextProduct?: { name: string; startPrice: number }
}

export interface MerchantInsightData {
  overview: {
    totalProducts: number
    activeAuctions: number
    totalOrders: number
    totalRevenue: number
  }
  auctionPerformance: {
    completedCount: number
    soldCount: number
    unsoldCount: number
    avgPremiumRate: number
    avgBidCount: number
  }
  biddingHeat: {
    hourlyDistribution: Record<string, number>
    peakHours: number[]
    uniqueBidders: number
    repeatBidders: number
  }
  revenueAnalysis: {
    dailyRevenue: Array<{ date: string; amount: number }>
    conversionRate: number
    topProducts: Array<{ name: string; revenue: number }>
  }
}

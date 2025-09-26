// n8n Chat Configuration
export const N8N_CONFIG = {
  // Default chat URL - replace with your actual n8n instance URL
  CHAT_URL: process.env.NEXT_PUBLIC_N8N_CHAT_URL || 'https://your-n8n-instance.com/webhook/chat',
  
  // Chat settings
  DEFAULT_SESSION_ID: 'default-session',
  TIMEOUT: 30000, // 30 seconds
  
  // Message types
  MESSAGE_TYPES: {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system'
  }
} as const

// Helper function to get the chat URL
export const getChatUrl = (): string => {
  return N8N_CONFIG.CHAT_URL
}

// Helper function to validate n8n URL
export const isValidN8nUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

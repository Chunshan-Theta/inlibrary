import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { message, sessionId } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Get n8n URL from environment variable (server-side only)
    const n8nUrl = process.env.N8N_CHAT_URL || process.env.NEXT_PUBLIC_N8N_CHAT_URL

    if (!n8nUrl) {
      return res.status(500).json({ error: 'N8N chat URL not configured' })
    }

    // Forward request to n8n
    console.log('=== NEW API VERSION ===')
    console.log('Sending request to n8n:', n8nUrl)
    console.log('Request payload:', { message, sessionId: sessionId || 'default-session' })
    
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatInput: message,
        sessionId: sessionId || 'default-session'
      })
    })

    console.log('N8N response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('N8N request failed:', response.status, errorText)
      
      // Return a fallback response instead of throwing error
      return res.status(200).json({
        response: '抱歉，AI助手暫時無法回應。請稍後再試。',
        message: '抱歉，AI助手暫時無法回應。請稍後再試。'
      })
    }

    const data = await response.json()
    console.log('N8N response:', data)
    
    // Transform n8n response to expected format
    const transformedResponse = {
      response: data.output || data.message || '抱歉，我無法處理你的請求。',
      message: data.output || data.message || '抱歉，我無法處理你的請求。'
    }
    
    res.status(200).json(transformedResponse)

  } catch (error) {
    console.error('Chat API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Return fallback response instead of error
    return res.status(200).json({
      response: '抱歉，AI助手暫時無法回應。請稍後再試。',
      message: '抱歉，AI助手暫時無法回應。請稍後再試。',
      error: errorMessage
    })
  }
}

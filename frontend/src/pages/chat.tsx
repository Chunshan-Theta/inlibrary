import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Layout from '../components/Layout'
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { chatApi } from '../api/papers'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Chat configuration
  const SESSION_ID = 'default-session'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Add welcome message
    setMessages([
      {
        id: '1',
        content: '你好！我是你的AI助手，可以幫助你搜索和管理研究論文。有什麼我可以幫助你的嗎？',
        role: 'assistant',
        timestamp: new Date()
      }
    ])
    
    // Set connected status (API route will handle n8n configuration)
    setIsConnected(true)
  }, [])

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const data = await chatApi.sendMessage(inputMessage, SESSION_ID)
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || data.message || '抱歉，我無法處理你的請求。',
        role: 'assistant',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '抱歉，請稍後再試。',
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        content: '你好！我是你的AI助手，可以幫助你搜索和管理研究論文。有什麼我可以幫助你的嗎？',
        role: 'assistant',
        timestamp: new Date()
      }
    ])
  }

  return (
    <>
      <Head>
        <title>AI 助手 - 研究室論文管理系統</title>
        <meta name="description" content="與AI助手對話，搜索和管理研究論文" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout>
        <div className="max-w-4xl mx-auto">
          {/* 頁面標題 */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <ChatBubbleLeftRightIcon className="h-8 w-8 mr-3 text-blue-600" />
                AI 助手
              </h1>
              <p className="mt-2 text-gray-600">與AI助手對話，搜索和管理研究論文</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`flex items-center space-x-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium">
                  {isConnected ? '已連接' : '未連接'}
                </span>
              </div>
              <button
                onClick={clearChat}
                className="btn-secondary text-sm"
              >
                清空對話
              </button>
            </div>
          </div>

          {/* 聊天界面 */}
          <div className="card h-[600px] flex flex-col">
            {/* 消息區域 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      <span className="text-sm">正在思考...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 輸入區域 */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex space-x-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="輸入你的問題..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  發送
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                按 Enter 發送消息，Shift + Enter 換行
              </p>
            </div>
          </div>

          {/* 使用說明 */}
          <div className="mt-6 card">
            <h3 className="text-lg font-semibold mb-3">使用說明</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">你可以問我：</h4>
                <ul className="space-y-1">
                  <li>• 搜索特定主題的論文</li>
                  <li>• 查找某位作者的論文</li>
                  <li>• 推薦相關研究</li>
                  <li>• 論文摘要和關鍵詞</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">範例問題：</h4>
                <ul className="space-y-1">
                  <li>• "幫我找關於機器學習的論文"</li>
                  <li>• "有哪些關於深度學習的最新研究？"</li>
                  <li>• "推薦一些自然語言處理的論文"</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}

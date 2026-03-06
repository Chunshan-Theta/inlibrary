import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, SparklesIcon, XMarkIcon, ChevronRightIcon, ArrowPathIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

// 定義選項結構
interface Option {
  label: string; // 顯示中文
  value: string; // 搜尋英文
}

// 2. 新增論文資料的型別
interface PaperRec {
  id: number;
  title: string;
  publication_year: number;
  citation_count: number;
  link?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  options?: Option[]; // 系統給的可選選項
  recommendations?: PaperRec[]; //用來接收後端傳來的論文
}

interface ChatSearchWizardProps {
  onComplete: (keyword: string) => void; // 當引導結束，把結果傳回去
  onClose: () => void; // 關閉 Wizard
}

const ChatSearchWizard: React.FC<ChatSearchWizardProps> = ({ onComplete, onClose }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 初始訊息
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '我是您的學術搜尋助手。請問您今天想探索學習科學的哪個主題？（例如：遊戲化、鷹架...）',
      options: [
        { label: '遊戲化學習', value: 'Gamification' },
        { label: '知識建構', value: 'Knowledge Building' },
        { label: '協作學習', value: 'Collaborative Learning' }
      ]
    }
  ]);

  // 自動捲動到底部
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current;
      // 將捲動軸直接設到底部
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages, isLoading]); // 加入 isLoading 確保 loading 出現時也捲動

  const handleSend = async (text: string, valueToSend?: string) => {
    // text: 顯示在對話框的文字 (中文 label)
    // valueToSend: 實際傳給後端的文字 (英文 value)，如果不傳則預設用 text
    if (!text.trim()) return;

    // 1. 顯示使用者的選擇/輸入
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // 2. 呼叫後端 API
      const payloadMessage = valueToSend || text; // 優先使用英文 value
      const response = await fetch('/api/chat/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: payloadMessage,
          history: messages // 把歷史紀錄傳給後端
        })
      });

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();

      // 3. 顯示 AI 回應
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        options: data.options,
        recommendations: data.recommendations
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error("Chat Error", error);
      // 錯誤處理 (Mock 回應以免卡住)
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '抱歉，目前無法連線到 AI 服務。', 
        options: []
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 監聽 AI 回應，如果後端回傳建議使用者「確認搜尋」，我們可以在 UI 上做按鈕
  // 這裡簡化：我們在 Assistant 的 Options 裡如果出現 value="FINISH:XXX" 則觸發完成
  const handleOptionAction = (opt: Option) => {
    // 判斷是否為「結束訊號」
    if (opt.value.startsWith("FINISH:")) {
        // 取出冒號後面的關鍵字
        const finalKeyword = opt.value.replace("FINISH:", "");
        // 呼叫父組件的完成函數
        onComplete(finalKeyword);
    } else {
        // 不是結束，繼續對話
        // 畫面顯示 label (中文)，但傳給後端 value (英文)
        handleSend(opt.label, opt.value);
    }
  };

  return (
    <div className="bg-white border border-blue-100 rounded-xl shadow-lg overflow-hidden flex flex-col h-[500px] w-full max-w-2xl mx-auto my-4 transition-all">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-blue-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <SparklesIcon className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-700">AI 關鍵字導航</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollAreaRef} // 綁定 ref 到這個捲動容器
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
              }`}
            >
              {msg.content}
            </div>

            {/* 選項區塊 */}
            {msg.role === 'assistant' && msg.options && msg.options.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in duration-500">
                {msg.options.map((opt, idx) => {
                   // 判斷這是不是一個「結束按鈕」，給它不同的顏色
                   const isFinish = opt.value.startsWith("FINISH:");
                   return (
                      <button
                        key={idx}
                        onClick={() => handleOptionAction(opt)}
                        className={`flex items-center gap-1 px-3 py-1.5 border text-xs font-medium rounded-full transition-all active:scale-95 ${
                            isFinish 
                            ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:shadow-md"
                            : "bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:shadow-sm"
                        }`}
                      >
                        {opt.label}
                        <ChevronRightIcon className={`w-3 h-3 ${isFinish ? "text-green-500" : "opacity-50"}`} />
                      </button>
                   );
                })}
              </div>
            )}

            {/* 論文推薦區塊 */}
            {msg.role === 'assistant' && msg.recommendations && msg.recommendations.length > 0 && (
              <div className="mt-4 space-y-3 w-full animate-in fade-in duration-500">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">
                  為您推薦的文獻
                </div>
                {msg.recommendations.map((paper) => (
                  <div key={paper.id} className="bg-white border border-blue-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* 論文標題 */}
                        <h4 className="text-sm font-medium text-gray-800 line-clamp-2 group-hover:text-blue-700 transition-colors">
                          {paper.title}
                        </h4>
                        
                        {/* 年份與引用數標籤 */}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            年份: {paper.publication_year}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100">
                            引用數: {paper.citation_count}
                          </span>
                        </div>
                      </div>
                      
                      {/* 右側箭頭按鈕：點擊前往外部連結 */}
                      <a 
                        href={paper.link ? (paper.link.startsWith('http') ? paper.link : `https://doi.org/${paper.link}`) : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { if (!paper.link) e.preventDefault(); }} // 如果沒連結就不動作
                        className={`flex-shrink-0 p-2 rounded-full transition-all ${
                          paper.link 
                            ? 'text-blue-500 hover:text-white hover:bg-blue-600 bg-blue-50' 
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title={paper.link ? "在新分頁開啟論文" : "尚無連結"}
                      >
                        <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2">
                    <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin" />
                    <span className="text-xs text-gray-400">思考中...</span>
                </div>
            </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex items-center gap-2"> {/* 將原本的 form 改成 div */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // 監聽鍵盤事件：按下 Enter 時發送訊息
              if (e.key === 'Enter') {
                e.preventDefault(); // 阻止觸發外層大表單的提交
                if (input.trim() && !isLoading) {
                  handleSend(input);
                }
              }
            }}
            placeholder="輸入您的想法..."
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
          />
          <button
            type="button" // 必須是 button，如果是 submit 會觸發外層表單
            onClick={() => {
              if (input.trim() && !isLoading) {
                handleSend(input);
              }
            }}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatSearchWizard;
import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { authorsApi, tagsApi, venuesApi } from '../api/papers';
import { XMarkIcon, DocumentPlusIcon, DocumentTextIcon, BookOpenIcon, VideoCameraIcon, PresentationChartBarIcon } from '@heroicons/react/24/outline';

interface ManualAddPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type DocumentType = 'paper' | 'book' | 'video' | 'presentation' | 'other';

export default function ManualAddPaperModal({ isOpen, onClose, onSuccess }: ManualAddPaperModalProps) {
  // 1. 文件類型狀態
  const [documentType, setDocumentType] = useState<DocumentType>('paper');

  // 2. 表單資料狀態 (包含所有可能用到的欄位)
  const [formData, setFormData] = useState({
    title: '',
    publication_year: new Date().getFullYear(),
    citation_count: 0,
    doi: '',
    isbn: '',
    url: '',
    abstract: '',
    venue: '',          // 手動輸入期刊名稱
    venue_id: '',       // 下拉選單選期刊 ID
    author_names: '',   // 逗號分隔字串
    tag_names: '',      // 逗號分隔字串
    keywords: '',       // 逗號分隔字串
    page_count: '',
    duration_minutes: '',
    duration_seconds: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 獲取下拉選項數據 (若你需要用到)
  const { data: venues } = useQuery('venues', venuesApi.getVenues);

  // 處理類型切換
  const handleTypeChange = (type: DocumentType) => {
    setDocumentType(type);
    // 可選：切換類型時清空不相關的資料
  };

  // 處理輸入框改變
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'publication_year' || name === 'citation_count') ? (parseInt(value) || 0) : value
    }));
  };

  // 判斷欄位是否應該顯示
  const isFieldVisible = (field: string) => {
    switch (documentType) {
      case 'paper':
        return !['isbn', 'page_count', 'duration_minutes'].includes(field);
      case 'book':
        return !['doi', 'venue', 'venue_id', 'citation_count', 'page_count', 'duration_minutes'].includes(field);
      case 'video':
        return ['title', 'publication_year', 'author_names', 'tag_names', 'keywords', 'url', 'abstract', 'duration_minutes'].includes(field);
      case 'presentation':
        return ['title', 'publication_year', 'author_names', 'tag_names', 'keywords', 'url', 'abstract', 'page_count'].includes(field);
      default:
        return true;
    }
  };

  // 處理送出
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // 在這裡，我們要把前端扁平的 formData，轉成後端 API 預期的格式
      // 注意：這需要配合你後端 /papers/manual API 實際能接收的欄位來調整！
      // 計算影片總秒數
      const mins = parseInt(formData.duration_minutes as string) || 0;
      const secs = parseInt(formData.duration_seconds as string) || 0;
      const totalSeconds = (mins * 60) + secs;

      const submitPayload = {
        title: formData.title,
        document_type: documentType,
        publication_year: formData.publication_year,
        citation_count: formData.citation_count,
        doi: formData.doi || undefined,
        isbn: formData.isbn || undefined,
        url: formData.url || undefined,
        abstract: formData.abstract || undefined,
        venue_id: parseInt(formData.venue_id as string) || undefined,
        authors: formData.author_names,
        keywords: formData.keywords,
        tags: formData.tag_names, 
        page_count: parseInt(formData.page_count as string) || undefined,
        video_duration: totalSeconds > 0 ? totalSeconds : undefined 
      };

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/papers/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '新增資源失敗');
      }

      setFormData({
        title: '',
        publication_year: new Date().getFullYear(),
        citation_count: 0,
        doi: '',
        isbn: '',
        url: '',
        abstract: '',
        venue: '',
        venue_id: '',
        author_names: '',
        tag_names: '',
        keywords: '',
        page_count: '',
        duration_minutes: '',
        duration_seconds: ''
      });
      setDocumentType('paper');

      // 成功後清理
      if (onSuccess) onSuccess();
      onClose();
      alert('手動建檔成功！');
      
    } catch (err: any) {
      setError(err.message || '發生未知錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl rounded-xl bg-white shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <DocumentPlusIcon className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">空白表單建檔</h3>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* 1. 文件類型選擇區 (Type Decision) */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-3">請先選擇資源類型：</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeChange('paper')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${documentType === 'paper' ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <DocumentTextIcon className="w-5 h-5" /> 論文/文獻
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('book')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${documentType === 'book' ? 'border-green-500 bg-green-50 text-green-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <BookOpenIcon className="w-5 h-5" /> 書籍/章節
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('video')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${documentType === 'video' ? 'border-red-500 bg-red-50 text-red-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <VideoCameraIcon className="w-5 h-5" /> 影片
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('presentation')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${documentType === 'presentation' ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <PresentationChartBarIcon className="w-5 h-5" /> 簡報 (PPT)
                </button>
              </div>
            </div>

            {/* 2. 表單填寫區 (Form Fill - 兩欄式排版) */}
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* 標題 (跨兩欄) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {documentType === 'book' ? '書名/章節標題' : documentType === 'video' ? '影片主題' : documentType === 'presentation' ? '簡報標題' : '論文標題'} <span className="text-red-500">*</span>
                </label>
                <input type="text" name="title" required value={formData.title} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
              </div>

              {/* 兩欄網格佈局開始 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                
                {isFieldVisible('publication_year') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">發表/創建年份 *</label>
                    <input type="number" name="publication_year" required value={formData.publication_year} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                  </div>
                )}

                {isFieldVisible('doi') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">DOI</label>
                    <input type="text" name="doi" value={formData.doi} onChange={handleChange} placeholder="10.1000/182" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                  </div>
                )}

                {isFieldVisible('isbn') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                    <input type="text" name="isbn" value={formData.isbn} onChange={handleChange} placeholder="978-3-16-148410-0" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                  </div>
                )}

                {isFieldVisible('citation_count') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">引用數</label>
                    <input type="number" name="citation_count" min="0" value={formData.citation_count} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                  </div>
                )}

                {isFieldVisible('venue') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">期刊/會議 (Venue)</label>
                    <select
                      name="venue_id"
                      value={formData.venue_id}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value="">請選擇...</option>
                      {venues?.map((v: any) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isFieldVisible('url') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">原始連結</label>
                    <input type="text" name="url" value={formData.url} onChange={handleChange} placeholder="https://..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                  </div>
                )}

                {isFieldVisible('page_count') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">頁數 / 投影片數</label>
                    <input type="number" name="page_count" min="1" value={formData.page_count} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                  </div>
                )}

                {isFieldVisible('duration_minutes') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">影片長度 (分:秒)</label>
                    <div className="flex gap-2">
                      <input type="number" name="duration_minutes" placeholder="分" value={formData.duration_minutes} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                      <span className="self-center">:</span>
                      <input type="number" name="duration_seconds" placeholder="秒" max="59" value={formData.duration_seconds} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>
                )}

              </div>
              {/* 兩欄網格佈局結束 */}

              {/* 摘要 (跨兩欄) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">摘要 / 簡述</label>
                <textarea name="abstract" rows={4} value={formData.abstract} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
              </div>

              {/* 關鍵字與作者群 (全寬度) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">關鍵字</label>
                <input type="text" name="keywords" value={formData.keywords} onChange={handleChange} placeholder="用逗號分隔關鍵字" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{documentType === 'video' ? '貢獻者/講者' : '作者'}</label>
                <input type="text" name="author_names" required value={formData.author_names} onChange={handleChange} placeholder="用逗號分隔姓名" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
              </div>

              {/* 標籤輸入框 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標籤 (Tags)</label>
                <input 
                  type="text" 
                  name="tag_names" 
                  value={formData.tag_names} 
                  onChange={handleChange} 
                  placeholder="用逗號分隔，例如：機器學習, 深度學習" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" 
                />
                <p className="mt-1 text-xs text-gray-500">如果標籤不存在，系統會自動為您建立</p>
              </div>

              {/* 錯誤顯示 */}
              {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg">{error}</div>}

              {/* 按鈕組 */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {isLoading ? '儲存中...' : '確認並儲存資源'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
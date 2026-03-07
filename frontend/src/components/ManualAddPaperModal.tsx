import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { authorsApi, tagsApi, venuesApi, papersApi } from '../api/papers';
import { PaperCreate, Paper } from '../types';
import { 
  XMarkIcon, 
  DocumentPlusIcon, 
  DocumentTextIcon, 
  BookOpenIcon, 
  VideoCameraIcon, 
  PresentationChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface ManualAddPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type DocumentType = 'paper' | 'book' | 'video' | 'presentation' | 'other';
type Step = 'form_fill' | 'comparison';

// --- Helper Component: 比對與合併卡片
interface MergeCandidateCardProps {
  existingPaper: Paper;
  newData: any;
  onConfirm: (paperId: number, mode: "keep_old" | "overwrite" | "merge_fields", fields?: string[]) => void;
  isProcessing: boolean;
}

const MergeCandidateCard = ({ existingPaper, newData, onConfirm, isProcessing }: MergeCandidateCardProps) => {
  const [mode, setMode] = useState<"keep_old" | "overwrite" | "merge_fields">("keep_old");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  const compareFields = [
    { key: 'title', label: '標題' },
    { key: 'publication_year', label: '年份' },
    { key: 'abstract', label: '摘要' },
    { key: 'doi', label: 'DOI' },
    { key: 'url', label: 'URL' },
    { key: 'citation_count', label: '引用數' }
  ];

  const toggleField = (field: string) => {
    if (mode !== 'merge_fields') setMode('merge_fields');
    setSelectedFields(prev => 
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm mb-4">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
          <span className="font-medium text-gray-900">發現相關資源 (ID: {existingPaper.id})</span>
        </div>
        <span className="text-xs text-gray-500">相似度高</span>
      </div>

      <div className="p-4">
        <div className="overflow-x-auto border rounded-md mb-4">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="py-2 px-3 font-medium text-gray-500 w-24">欄位</th>
                <th className="py-2 px-3 font-medium text-gray-500 w-5/12">現有資料 (舊)</th>
                <th className="py-2 px-3 font-medium text-blue-600 w-5/12">提交資料 (新)</th>
                <th className="py-2 px-3 font-medium text-gray-500 text-center w-16">選取</th>
              </tr>
            </thead>
            <tbody>
              {compareFields.map(({ key, label }) => {
                const oldVal = (existingPaper as any)[key]?.toString() || '';
                const newVal = newData[key]?.toString() || '';
                const isDiff = oldVal.trim() !== newVal.trim();
                const isSelected = selectedFields.includes(key);

                return (
                  <tr key={key} className={`border-b last:border-0 ${isDiff ? 'bg-yellow-50/30' : ''}`}>
                    <td className="py-2 px-3 font-medium text-gray-700">{label}</td>
                    <td className="py-2 px-3 text-gray-600 truncate max-w-[150px]" title={oldVal}>
                      {oldVal || <span className="text-gray-300 italic">(空)</span>}
                    </td>
                    <td className={`py-2 px-3 truncate max-w-[150px] ${isDiff ? 'text-blue-700 font-medium' : 'text-gray-400'}`} title={newVal}>
                      {newVal || <span className="text-gray-300 italic">(空)</span>}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isDiff && (
                        <input
                          type="checkbox"
                          checked={isSelected || mode === 'overwrite'}
                          disabled={mode === 'overwrite' || mode === 'keep_old'}
                          onChange={() => toggleField(key)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-md border border-gray-200">
          <label className={`relative flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${mode === 'keep_old' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-center mb-1">
              <input type="radio" checked={mode === 'keep_old'} onChange={() => setMode('keep_old')} className="mr-2" />
              <span className="font-semibold text-sm text-gray-900">保留舊資料</span>
            </div>
            <span className="text-xs text-gray-500 ml-6">不修改現有元數據</span>
          </label>

          <label className={`relative flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${mode === 'overwrite' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-center mb-1">
              <input type="radio" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} className="mr-2" />
              <span className="font-semibold text-sm text-gray-900">完全覆蓋</span>
            </div>
            <span className="text-xs text-gray-500 ml-6">用新資料完全取代舊資料</span>
          </label>

          <label className={`relative flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${mode === 'merge_fields' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-center mb-1">
              <input type="radio" checked={mode === 'merge_fields'} onChange={() => setMode('merge_fields')} className="mr-2" />
              <span className="font-semibold text-sm text-gray-900">選擇欄位</span>
            </div>
            <span className="text-xs text-gray-500 ml-6">僅更新勾選的特定欄位</span>
          </label>
        </div>

        <div className="mt-4 flex justify-end border-t pt-4">
          <button
            onClick={() => onConfirm(existingPaper.id, mode, selectedFields)}
            disabled={isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center space-x-2 text-sm shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>處理中...</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5" />
                <span>確認合併資料</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
export default function ManualAddPaperModal({ isOpen, onClose, onSuccess }: ManualAddPaperModalProps) {
  const queryClient = useQueryClient();
  const { data: venues } = useQuery('venues', venuesApi.getVenues);

  // 狀態管理
  const [step, setStep] = useState<Step>('form_fill');
  const [documentType, setDocumentType] = useState<DocumentType>('paper');
  const [relatedPapers, setRelatedPapers] = useState<Paper[] | null>(null);
  const [finalSubmitData, setFinalSubmitData] = useState<any>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
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

  // 重置表單
  const handleReset = () => {
    setFormData({
      title: '', publication_year: new Date().getFullYear(), citation_count: 0,
      doi: '', isbn: '', url: '', abstract: '', venue: '', venue_id: '',
      author_names: '', tag_names: '', keywords: '', page_count: '',
      duration_minutes: '', duration_seconds: ''
    });
    setDocumentType('paper');
    setStep('form_fill');
    setRelatedPapers(null);
    setFinalSubmitData(null);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleTypeChange = (type: DocumentType) => {
    setDocumentType(type);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'publication_year' || name === 'citation_count') ? (parseInt(value) || 0) : value
    }));
  };

  const isFieldVisible = (field: string) => {
    switch (documentType) {
      case 'paper': return !['isbn', 'page_count', 'duration_minutes'].includes(field);
      case 'book': return !['doi', 'venue', 'venue_id', 'citation_count', 'page_count', 'duration_minutes'].includes(field);
      case 'video': return ['title', 'publication_year', 'author_names', 'tag_names', 'keywords', 'url', 'abstract', 'duration_minutes'].includes(field);
      case 'presentation': return ['title', 'publication_year', 'author_names', 'tag_names', 'keywords', 'url', 'abstract', 'page_count'].includes(field);
      default: return true;
    }
  };

  // 1. 執行最終新增 API (無重複，或選擇忽略合併時呼叫)
  const executeCreate = async (payload: any) => {
    setIsLoading(true);
    setError(null);
    try {
      //直接呼叫 api/papers.ts 裡面的函式，不需自己處理 URL
      await papersApi.createPaperManually(payload);

      queryClient.invalidateQueries('papers');
      handleReset();
      if (onSuccess) onSuccess();
      onClose();
      alert('手動建檔成功！');
    } catch (err: any) {
      // 攔截後端報錯，翻譯成友善的中文提示
      const errorMsg = err?.response?.data?.detail || err.message || '';
      
      if (errorMsg.includes('500') || errorMsg.includes('duplicate') || errorMsg.includes('UniqueViolation')) {
        setError('⚠️ 建立失敗：您輸入的 DOI 或 ISBN 已經存在於資料庫中，請修改後再試！');
      } else {
        setError(`⚠️ 建立失敗：${errorMsg}，請檢查欄位格式。`);
      }
      
      setStep('form_fill'); // 發生錯誤退回表單頁
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 搜尋重複項目的 Mutation
  const relatedSearchMutation = useMutation(papersApi.searchRelated, {
    onSuccess: (results) => {
      if (results && results.length > 0) {
        setRelatedPapers(results);
        setStep('comparison'); // 進入比對畫面
      } else {
        if (finalSubmitData) executeCreate(finalSubmitData); // 無重複，直接建立
      }
      setIsLoading(false);
    },
    onError: () => {
      // 搜尋失敗 (可能 API 不通)，作為備案直接嘗試建立
      if (finalSubmitData) executeCreate(finalSubmitData);
    }
  });

  // 3. 表單送出：攔截並先進行搜尋
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const mins = parseInt(formData.duration_minutes as string) || 0;
    const secs = parseInt(formData.duration_seconds as string) || 0;
    const totalSeconds = (mins * 60) + secs;

    // 📦 包裹 A：這是最後真正要送給 /papers/manual 建立資料用的 (字串格式)
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

    setFinalSubmitData(submitPayload);

    // 📦 包裹 B：這是專門用來「搜尋重複」的 (給空陣列以防 422 報錯)
    const searchPayload = {
      title: formData.title,
      publication_year: formData.publication_year,
      doi: formData.doi || undefined,
      isbn: formData.isbn || undefined,
      document_type: documentType,
      abstract: formData.abstract || undefined,
      url: formData.url || undefined,
      citation_count: formData.citation_count,
      // 故意塞入空陣列，滿足後端 API 的嚴格格式檢查
      author_ids: [],
      tag_ids: [],
      keywords: []
    };

    // 觸發搜尋，把專用包裹 B 丟過去檢查
    relatedSearchMutation.mutate(searchPayload as any); 
  };

  // 4. 處理合併
  const handleProcessMerge = async (paperId: number, mode: "keep_old" | "overwrite" | "merge_fields", fields?: string[]) => {
    if (!finalSubmitData) return;
    setIsMerging(true);

    try {
      // 📦 轉換包裹格式：將手動新增用的「字串」，變形為後端 merge 預期的「陣列」
      const mergePayload = { ...finalSubmitData };
      
      // 1. 處理 keywords (把 "AI, ML" 切割成 ["AI", "ML"])
      if (typeof mergePayload.keywords === 'string') {
          mergePayload.keywords = mergePayload.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
      } else if (!mergePayload.keywords) {
          mergePayload.keywords = [];
      }

      // 2. 補上後端預期要看到的 ID 陣列欄位 (避免 422 驗證報錯)
      mergePayload.author_ids = [];
      mergePayload.tag_ids = [];

      // 3. 刪除會讓後端報 422 錯誤的非法字串欄位
      delete mergePayload.authors;
      delete mergePayload.tags;

      // 呼叫 API 合併資料
      await papersApi.mergePaper(paperId, mergePayload, mode, fields);

      alert(`合併成功！資料已成功整合到資源 ID: ${paperId}。`);
      queryClient.invalidateQueries('papers');
      handleReset();
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('合併過程失敗:', error);
      let errorMsg = error?.response?.data?.detail || error.message || '未知錯誤';
      
      // 讓 422 陣列錯誤訊息變得人類可讀
      if (Array.isArray(errorMsg)) {
          errorMsg = errorMsg.map(e => `${e.loc?.join('.') || '欄位'}: ${e.msg}`).join(', ');
      }
      
      alert(`合併失敗: ${errorMsg}`);
    } finally {
      setIsMerging(false);
    }
  };

  if (!isOpen) return null;

  // --- 畫面渲染邏輯 ---
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleClose} />

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
            <button onClick={handleClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            
            {/* 步驟 1: 填寫表單 (預設畫面) */}
            {step === 'form_fill' && (
              <>
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-700 mb-3">請先選擇資源類型：</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button type="button" onClick={() => handleTypeChange('paper')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${documentType === 'paper' ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <DocumentTextIcon className="w-5 h-5" /> 論文/文獻
                    </button>
                    <button type="button" onClick={() => handleTypeChange('book')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${documentType === 'book' ? 'border-green-500 bg-green-50 text-green-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <BookOpenIcon className="w-5 h-5" /> 書籍/章節
                    </button>
                    <button type="button" onClick={() => handleTypeChange('video')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${documentType === 'video' ? 'border-red-500 bg-red-50 text-red-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <VideoCameraIcon className="w-5 h-5" /> 影片
                    </button>
                    <button type="button" onClick={() => handleTypeChange('presentation')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${documentType === 'presentation' ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <PresentationChartBarIcon className="w-5 h-5" /> 簡報 (PPT)
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {documentType === 'book' ? '書名/章節標題' : documentType === 'video' ? '影片主題' : documentType === 'presentation' ? '簡報標題' : '論文標題'} <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="title" required value={formData.title} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                  </div>

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
                        <select name="venue_id" value={formData.venue_id} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white">
                          <option value="">請選擇...</option>
                          {venues?.map((v: any) => (
                            <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
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

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">摘要 / 簡述</label>
                    <textarea name="abstract" rows={4} value={formData.abstract} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">關鍵字</label>
                    <input type="text" name="keywords" value={formData.keywords} onChange={handleChange} placeholder="用逗號分隔關鍵字" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{documentType === 'video' ? '貢獻者/講者' : '作者'}</label>
                    <input type="text" name="author_names" required value={formData.author_names} onChange={handleChange} placeholder="用逗號分隔姓名" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">標籤 (Tags)</label>
                    <input type="text" name="tag_names" value={formData.tag_names} onChange={handleChange} placeholder="用逗號分隔，例如：機器學習, 深度學習" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
                    <p className="mt-1 text-xs text-gray-500">如果標籤不存在，系統會自動為您建立</p>
                  </div>

                  {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg">{error}</div>}

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button type="button" onClick={handleClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
                    <button type="submit" disabled={isLoading} className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                      {isLoading ? '檢查與儲存中...' : '確認並儲存資源'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* 步驟 2: 重複比對畫面 */}
            {step === 'comparison' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-blue-400 mr-3" />
                    <div>
                      <h3 className="text-sm font-medium text-blue-800">發現潛在的重複項目</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        系統檢測到資料庫中已有類似的資源（例如 DOI 或 ISBN 相同）。您可以選擇將新資料<b>整合</b>到現有項目中，或者忽略並強制建立新項目。
                      </p>
                    </div>
                  </div>
                </div>

                <div className="max-h-[55vh] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                  {relatedPapers?.map((paper) => (
                    <MergeCandidateCard
                      key={paper.id}
                      existingPaper={paper}
                      newData={finalSubmitData!}
                      onConfirm={handleProcessMerge}
                      isProcessing={isMerging}
                    />
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4 flex justify-between items-center sticky bottom-0 bg-white">
                  <button onClick={() => setStep('form_fill')} className="text-sm text-gray-500 hover:text-gray-700 underline">
                    返回修改表單
                  </button>
                  <button
                    onClick={() => finalSubmitData && executeCreate(finalSubmitData)}
                    disabled={isLoading}
                    className="px-5 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium flex items-center disabled:opacity-50"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    {isLoading ? '建立中...' : '忽略合併，直接建立新資源'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
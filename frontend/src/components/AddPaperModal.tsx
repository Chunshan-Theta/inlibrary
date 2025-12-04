// 文件: frontend/src/components/AddPaperModal.tsx (全面替換)

import React, { useState, useEffect } from 'react'
import { useForm, DefaultValues } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { papersApi, authorsApi, tagsApi, venuesApi } from '../api/papers'
import { PaperCreate, Author, Tag, Venue, Paper } from '../types'
// 引入新的圖標用於多媒體和類型區分
import { DocumentTextIcon, FolderIcon, VideoCameraIcon, PresentationChartBarIcon, BookOpenIcon, AcademicCapIcon, ArrowUpTrayIcon, PlusIcon, CodeBracketIcon,ExclamationTriangleIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface AddPaperModalProps {
  isOpen: boolean
  onClose: () => void
}

type Step = 'upload' | 'type_decision' | 'form_fill' | 'comparison'
type DocumentType = 'paper' | 'book' | 'video' | 'presentation' | 'other'

// --- Helper Components ---

// 單個合併候選人組件 (解決多個候選人狀態衝突問題)
interface MergeCandidateCardProps {
  existingPaper: Paper
  newData: PaperCreate
  onConfirm: (paperId: number, mode: "keep_old" | "overwrite" | "merge_fields", fields?: string[]) => void
  isProcessing: boolean
}

const MergeCandidateCard = ({ existingPaper, newData, onConfirm, isProcessing }: MergeCandidateCardProps) => {
  const [mode, setMode] = useState<"keep_old" | "overwrite" | "merge_fields">("keep_old")
  const [selectedFields, setSelectedFields] = useState<string[]>([])

  // 定義要比對的欄位
  const compareFields: { key: keyof PaperCreate; label: string }[] = [
    { key: 'title', label: '標題' },
    { key: 'publication_year', label: '年份' },
    { key: 'abstract', label: '摘要' },
    { key: 'doi', label: 'DOI' },
    { key: 'url', label: 'URL' },
    { key: 'citation_count', label: '引用數' }
  ]

  // 自動切換 Checkbox
  const toggleField = (field: string) => {
    if (mode !== 'merge_fields') setMode('merge_fields')
    setSelectedFields(prev => 
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    )
  }

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
        {/* 比對表格 */}
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
                const oldVal = (existingPaper as any)[key]?.toString() || ''
                const newVal = (newData as any)[key]?.toString() || ''
                const isDiff = oldVal.trim() !== newVal.trim()
                const isSelected = selectedFields.includes(key as string)

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
                          onChange={() => toggleField(key as string)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 合併選項控制 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-md border border-gray-200">
          <label className={`relative flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${mode === 'keep_old' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-center mb-1">
              <input type="radio" name={`mode-${existingPaper.id}`} checked={mode === 'keep_old'} onChange={() => setMode('keep_old')} className="mr-2" />
              <span className="font-semibold text-sm text-gray-900">保留舊資料</span>
            </div>
            <span className="text-xs text-gray-500 ml-6">僅附加檔案，不修改元數據</span>
          </label>

          <label className={`relative flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${mode === 'overwrite' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-center mb-1">
              <input type="radio" name={`mode-${existingPaper.id}`} checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} className="mr-2" />
              <span className="font-semibold text-sm text-gray-900">完全覆蓋</span>
            </div>
            <span className="text-xs text-gray-500 ml-6">用新資料完全取代舊資料</span>
          </label>

          <label className={`relative flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${mode === 'merge_fields' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-center mb-1">
              <input type="radio" name={`mode-${existingPaper.id}`} checked={mode === 'merge_fields'} onChange={() => setMode('merge_fields')} className="mr-2" />
              <span className="font-semibold text-sm text-gray-900">選擇欄位</span>
            </div>
            <span className="text-xs text-gray-500 ml-6">僅更新勾選的特定欄位</span>
          </label>
        </div>

        {/* 確認按鈕 */}
        <div className="mt-4 flex justify-end border-t pt-4">
          <button
            onClick={() => onConfirm(existingPaper.id, mode, selectedFields)}
            disabled={isProcessing}
            className="btn-primary flex items-center space-x-2 text-sm shadow-sm"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>處理中...</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5" />
                <span>確認合併並上傳檔案</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// MOCK: 模擬元數據抽取和類型預判
const getInitialTypeAndMockData = (file: File): { initialType: DocumentType, initialData: Partial<PaperCreate> } => {
  const fileName = file.name.toLowerCase()
  let initialType: DocumentType = 'other'
  
  if (fileName.endsWith('.pdf')) {
    initialType = 'paper' // PDF 文件進入類型決策步驟
  } else if (fileName.endsWith('.mp4') || fileName.endsWith('.mov') || fileName.endsWith('.avi')) {
    initialType = 'video'
  } else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
    initialType = 'presentation'
  } else if (fileName.endsWith('.epub') || fileName.endsWith('.mobi')) {
    initialType = 'book'
  }
  
  // MOCK: 使用檔名作為標題，並預設當年年份
  return {
    initialType,
    initialData: {
      title: fileName.replace(/\.[^/.]+$/, "").substring(0, 50), // 用檔名作為標題
      publication_year: new Date().getFullYear(),
      doi: undefined,
      document_type: initialType
    }
  }
}

// -----------------------------------------------------------
// Main Component
// -----------------------------------------------------------
export default function AddPaperModal({ isOpen, onClose }: AddPaperModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<DocumentType | null>(null)
  const [relatedPapers, setRelatedPapers] = useState<Paper[] | null>(null) // <-- NEW: 儲存搜索結果
  const [finalSubmitData, setFinalSubmitData] = useState<PaperCreate | null>(null) // <-- NEW: 儲存填寫好的數據
  const [isMerging, setIsMerging] = useState(false)
  const queryClient = useQueryClient()
  
  const defaultValues: DefaultValues<PaperCreate> = {
    citation_count: 0,
    publication_year: new Date().getFullYear(),
    document_type: 'paper'
  }
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PaperCreate>({ defaultValues })

  // 獲取下拉選項數據
  const { data: authors } = useQuery('authors', authorsApi.getAuthors)
  const { data: tags } = useQuery('tags', tagsApi.getTags)
  const { data: venues } = useQuery('venues', venuesApi.getVenues)

  // 重置狀態
  const handleReset = () => {
    reset()
    setSelectedFile(null)
    setDocumentType(null)
    setRelatedPapers(null)
    setFinalSubmitData(null)
    setIsMerging(false)
    setStep('upload')
  }

  // 關閉 Modal
  const handleClose = () => {
    handleReset()
    onClose()
  }
  
  // 創建資源的 mutation
  const createPaperMutation = useMutation(papersApi.createPaper, {
    onSuccess: async (newResource) => {
      // 檔案上傳邏輯：在資源創建成功後，將文件上傳並更新 DB 記錄
      if (selectedFile) {
        try {
          // 這裡重用原本的 uploadPdf，儘管它名稱是 pdf，但後端 main.py/minio_client.py 實際支援所有檔案類型
          await papersApi.uploadPdf(newResource.id, selectedFile)
        } catch (error) {
          console.error('文件上傳失敗:', error)
          alert('資源創建成功，但文件上傳失敗')
        }
      }
      
      // 刷新列表
      queryClient.invalidateQueries('papers')
      queryClient.invalidateQueries('authors')
      queryClient.invalidateQueries('tags')
      
      handleReset()
      onClose()
      
      alert('資源添加成功！')
    },
    onError: (error: any) => {
      console.error('創建資源失敗:', error)
      let errorMessage = '請聯繫管理員'
      if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error?.detail) {
        errorMessage = error.detail
      } else if (error?.message) {
        errorMessage = error.message
      }
      alert(`創建資源失敗: ${errorMessage}`)
    }
  })

  // NEW: 搜索相關資源的 Mutation
  const relatedSearchMutation = useMutation(papersApi.searchRelated, {
    onSuccess: (results) => {
      if (results && results.length > 0) {
        setRelatedPapers(results)
        setStep('comparison')
      } else {
        // 無相關資源，直接創建
        if (finalSubmitData) createPaperMutation.mutate(finalSubmitData)
      }
    },
    onError: () => {
      // 搜索失敗，降級為直接創建
      if (finalSubmitData) createPaperMutation.mutate(finalSubmitData)
    }
  })

  // Handler: 執行合併 (Phase 3: C_INTEGRATE)
  const handleProcessMerge = async (paperId: number, mode: "keep_old" | "overwrite" | "merge_fields", fields?: string[]) => {
    if (!finalSubmitData || !selectedFile) return
    setIsMerging(true)

    try {
      // 1. 呼叫 API 合併資料 (更新資料庫)
      await papersApi.mergePaper(paperId, finalSubmitData, mode, fields)

      // 2. 呼叫 API 上傳檔案
      await papersApi.uploadPdf(paperId, selectedFile)

      alert(`合併成功！檔案 ${selectedFile.name} 已成功附加到資源 ID: ${paperId}。`)
      queryClient.invalidateQueries('papers')
      handleClose()
    } catch (error: any) {
      console.error('合併過程失敗:', error)
      
      // 修正：更聰明的錯誤訊息顯示
      let errorMsg = '未知錯誤'
      const detail = error?.response?.data?.detail

      if (typeof detail === 'string') {
        // 如果是普通字串錯誤
        errorMsg = detail
      } else if (Array.isArray(detail)) {
        // 如果是 Pydantic 驗證錯誤陣列 (422)
        // 取出第一個錯誤的欄位和訊息
        const firstError = detail[0]
        const field = firstError?.loc?.join('.') || '欄位'
        errorMsg = `${field}: ${firstError?.msg}`
      } else if (error?.message) {
        errorMsg = error.message
      }

      alert(`合併失敗: ${errorMsg}`)
    } finally {
      setIsMerging(false)
    }
  }

  // 處理檔案變更 (Phase 0)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { // 設為 async
    const file = e.target.files?.[0]
    if (file) {
      // ... (省略 getInitialTypeAndMockData 等邏輯)
      const { initialType, initialData } = getInitialTypeAndMockData(file)
      
      setSelectedFile(file)
      
      // 自動填寫表單 (使用初始數據)
      Object.entries(initialData).forEach(([key, value]) => {
          // @ts-ignore
          setValue(key, value, { shouldValidate: true })
      })

      if (initialType === 'paper') {
        // --- NEW LOGIC: PDF Extraction API Call ---
        try {
            // 呼叫新的 API 進行解析
            const pdfInfo = await papersApi.extractPdfInfo(file)
            
            // 根據 PDF 解析結果更新表單值
            setValue('title', pdfInfo.title || initialData.title || '')
            setValue('abstract', pdfInfo.abstract || initialData.abstract)
            // publication_year 優先使用解析結果，否則使用 mock 年份
            setValue('publication_year', pdfInfo.publication_year || initialData.publication_year || new Date().getFullYear()) 

            // 只保留原本的 DOI 填寫
            setValue('doi', pdfInfo.doi || '')
            // // 判斷 ISBN 與 DOI
            // if (pdfInfo.isbn) {
            //     // 如果抓到了 ISBN，填入 DOI 欄位 (系統共用)
            //     setValue('isbn', pdfInfo.isbn)
            //     // 自動將類型切換為書籍
            //     setDocumentType('book')
            //     setValue('document_type', 'book')
            //     console.log(`[PDF Extraction] 偵測到 ISBN: ${pdfInfo.isbn}，自動切換為書籍類型。`)
            // } else {
            //     setValue('doi', pdfInfo.doi || '')
            //     // 若只有 DOI 或都沒有，保持預設 (paper) 或依照檔名判斷
            // }

            // NEW: 設置作者和關鍵字 (將陣列轉換為逗號分隔字符串)
            if (pdfInfo.authors && pdfInfo.authors.length > 0) {
                setValue('author_names', pdfInfo.authors.join(', '))
            }
            if (pdfInfo.keywords && pdfInfo.keywords.length > 0) {
                setValue('keywords'as keyof PaperCreate, pdfInfo.keywords.join(', '))
            }
            
            // 檢查 venue (期刊/會議名稱) - 如果解析到名稱，可以提示用戶手動選擇
            if (pdfInfo.venue) {
                 console.log(`[PDF Extraction] 偵測到期刊/會議名稱: ${pdfInfo.venue}，請手動選擇。`);
                 // 可以考慮將 venue 名稱顯示給用戶，但不自動設定 venue_id
            }

            // Proceed to decision step with extracted data
            setDocumentType('paper')
            setValue('document_type', 'paper')
            setStep('type_decision')

        } catch (error) {
            console.error('PDF 元數據提取失敗:', error)
            alert('PDF 元數據提取失敗，請手動填寫。')
            // Fallback to decision step with initial mock data
            setDocumentType('paper')
            setValue('document_type', 'paper')
            setStep('type_decision')
        }
        // --- END NEW LOGIC ---
        
      } else {
        // ... (existing logic for other file types)
        setDocumentType(initialType)
        setValue('document_type', initialType)
        setStep('form_fill')
      }
    }
  }
  
  // 處理 PDF 類型決定 (Phase 1: A_PDF_TYPE)
  const handlePdfTypeDecision = (type: 'paper' | 'book') => {
    setDocumentType(type)
    setValue('document_type', type)
    setStep('form_fill')
    
    // 根據類型，清除不適用欄位的值
    if (type === 'book') {
        //setValue('doi', undefined)
        setValue('venue_id', undefined)
        setValue('citation_count', 0)
    }
  }

  // NEW: 輔助函數：安全地將表單輸入 (string | number | "") 轉換為 number | undefined
  const safeParseInt = (value: string | number | undefined): number | undefined => {
      const strValue = String(value).trim();
      if (!strValue) {
          return undefined; // 將空字符串、null、undefined 轉為 undefined
      }
      const parsed = parseInt(strValue, 10);
      return isNaN(parsed) ? undefined : parsed; // 確保解析失敗也轉為 undefined
  };

  const onSubmit = async (data: PaperCreate) => {
    try {
      if (!documentType) {
        alert('錯誤：文件類型未定義')
        return
      }
      
      // --- 處理作者與標籤邏輯 ---
      let authorIds: number[] = []
      // 關鍵修正：將 data.author_names 斷言為 unknown 再斷言為 string
      const authorNamesInput = data.author_names as unknown;
      if (authorNamesInput && typeof authorNamesInput === 'string') {
        const authorNames = authorNamesInput.split(',').map((name: string) => name.trim()).filter((name: string) => name)
        for (const name of authorNames) {
          const existingAuthor = authors?.find(author => author.name === name)
          if (existingAuthor) {
            authorIds.push(existingAuthor.id)
          } else {
            const newAuthor = await authorsApi.createAuthor({ name })
            authorIds.push(newAuthor.id)
          }
        }
      }

      let tagIds: number[] = []
      // 關鍵修正：將 data.tag_names 斷言為 unknown 再斷言為 string
      const tagNamesInput = data.tag_names as unknown;
      if (tagNamesInput && typeof tagNamesInput === 'string') {
        const tagNames = tagNamesInput.split(',').map((name: string) => name.trim()).filter((name: string) => name)
        for (const name of tagNames) {
          const existingTag = tags?.find(tag => tag.name === name)
          if (existingTag) {
            tagIds.push(existingTag.id)
          } else {
            const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']
            const randomColor = colors[Math.floor(Math.random() * colors.length)]
            const newTag = await tagsApi.createTag({ name, color: randomColor })
            tagIds.push(newTag.id)
          }
        }
      }

      // 關鍵修正：將 data.keywords 斷言為 unknown 再斷言為 string
      const keywordsInput = data.keywords as unknown;
      const keywords = (keywordsInput && typeof keywordsInput === 'string') ? 
        (keywordsInput as string).split(',').map((k: string) => k.trim()).filter((k: string) => k) : 
        []
      // --- 處理作者與標籤邏輯結束 ---
      
      // 關鍵步驟：安全地解析數字字段
      const venueId = safeParseInt(data.venue_id);
      const citationCount = safeParseInt(data.citation_count);
      const publicationYear = safeParseInt(data.publication_year);
      
      // 構建最終提交數據並進行類型清理和轉換
      const submitData: PaperCreate = {
          ...data,
          document_type: documentType,
          author_ids: authorIds,
          tag_ids: tagIds,
          
          // 1. 必填數字字段 (Publication_year) - 使用解析結果，並提供原始後端的 fallback
          publication_year: publicationYear || new Date().getFullYear(),
          
          // 2. 可選 ID 字段 (venue_id)
          venue_id: (documentType === 'paper' && venueId !== undefined) ? venueId : undefined,
          
          // 3. 可選數字字段 (citation_count)
          citation_count: (documentType === 'paper' && citationCount !== undefined) ? citationCount : undefined,
          
          // 4. 字符串字段（確保空字符串變為 undefined）
          doi: (documentType === 'paper' || documentType === 'book') ? (data.doi || undefined) : undefined,
          url: data.url || undefined,
          abstract: data.abstract || undefined,
          
          // 5. 關鍵字
          keywords: keywords.length > 0 ? keywords : undefined,
          
          // 移除客戶端專用字段
          author_names: undefined,
          tag_names: undefined
      } as PaperCreate;

      //createPaperMutation.mutate(submitData)

      // Phase 2: Analyze & Query (取代 createPaperMutation.mutate(submitData))
      setFinalSubmitData(submitData) // 儲存數據
      relatedSearchMutation.mutate(submitData) // 觸發搜索並進入比對步驟
      
    } catch (error) {
      console.error('處理作者或標籤時發生錯誤:', error)
      alert('處理作者或標籤時發生錯誤，請檢查輸入')
    }
  }

  // 根據類型決定哪些欄位要顯示
  const isFieldVisible = (field: keyof PaperCreate) => {
    if (!documentType) return true // 默認顯示
    
    switch (documentType) {
      case 'paper':
        return true // 論文顯示所有欄位
      case 'book':
        // 隱藏 venue_id, citation_count
        return !['venue_id', 'citation_count'].includes(field)
      case 'video':
      case 'presentation':
      case 'other':
        // 只顯示核心欄位
        return ['title', 'publication_year', 'keywords', 'author_names', 'tag_names', 'url', 'abstract'].includes(field)
      default:
        return true
    }
  }

  // -----------------------------------------------------------
  // UI Renders
  // -----------------------------------------------------------
  
  // RENDER STEP: UPLOAD
  const renderUploadStep = () => (
    <div className="space-y-6 text-center">
        <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-blue-400" />
        <h3 className="text-xl font-medium text-gray-900">步驟 1: 上傳您的研究資源文件</h3>
        <p className="text-gray-600">支援 PDF、書籍文件、影片 (MP4)、簡報 (PPT/PPTX) 和其他文件格式</p>
        
        <div className="flex justify-center">
            <label htmlFor="resource_file" className="cursor-pointer">
                <div className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center space-x-2">
                    <DocumentTextIcon className="h-5 w-5" />
                    <span>選擇文件</span>
                </div>
                <input
                    type="file"
                    id="resource_file"
                    // 擴大接受的文件類型
                    accept=".pdf,.mp4,.mov,.ppt,.pptx,.epub,.mobi,.doc,.docx,.xls,.xlsx,.csv,.tsv"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </label>
        </div>
        
        {selectedFile && (
          <p className="mt-2 text-sm text-green-600">
            已選擇文件: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
          </p>
        )}
    </div>
  )

  // RENDER STEP: TYPE DECISION (Phase 1: A_PDF_TYPE)
  const renderTypeDecisionStep = () => (
    <div className="space-y-6 text-center">
        <FolderIcon className="mx-auto h-12 w-12 text-yellow-500" />
        <h3 className="text-xl font-medium text-gray-900">步驟 2: 文件類型判定</h3>
        <p className="text-gray-600">您上傳了 PDF 文件 ({selectedFile?.name})，請確認其類型以便系統進行精確的元數據抽取：</p>

        <div className="flex justify-center space-x-6">
            <button
                type="button"
                onClick={() => handlePdfTypeDecision('paper')}
                className="flex flex-col items-center p-6 border-2 border-transparent hover:border-blue-500 rounded-lg transition-all shadow-md w-40 bg-white"
            >
                <AcademicCapIcon className="h-10 w-10 text-blue-600 mb-2" />
                <span className="font-semibold text-lg">研究論文</span>
                <span className="text-sm text-gray-500 mt-1">(適用 DOI, 期刊/會議)</span>
            </button>
            
            {/* <button
                type="button"
                onClick={() => handlePdfTypeDecision('book')}
                className="flex flex-col items-center p-6 border-2 border-transparent hover:border-blue-500 rounded-lg transition-all shadow-md w-40 bg-white"
            >
                <BookOpenIcon className="h-10 w-10 text-green-600 mb-2" />
                <span className="font-semibold text-lg">書籍/章節</span>
                <span className="text-sm text-gray-500 mt-1">(適用 ISBN, 無需 DOI, 期刊)</span>
            </button> */}
        </div>
        
        <button type="button" onClick={() => handleReset()} className="text-sm text-gray-500 hover:text-gray-700 mt-4">
            重新上傳檔案
        </button>
    </div>
  )
  
  // RENDER STEP: FORM FILL (Phase 2)
  const renderFormFillStep = () => {
    const isPaper = documentType === 'paper'
    const isBook = documentType === 'book'
    const isVideo = documentType === 'video'
    const isPresentation = documentType === 'presentation'
    
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 flex items-center space-x-2">
                <DocumentTextIcon className="h-5 w-5" />
                <span>步驟 3: 填寫資源元數據 - 類型: {documentType}</span>
            </h3>
            <p className="text-sm text-blue-700 mt-1">
                已根據檔案類型預設欄位。請確認並補齊以下資訊。
            </p>
            {selectedFile && (
                <p className="text-xs text-blue-600 mt-2">
                    已綁定文件: {selectedFile.name}
                </p>
            )}
        </div>
        
        {/* 基本信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 標題 (必填) */}
          <div className="md:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              {isBook ? '書名/章節標題' : isVideo ? '影片主題/標題' : isPresentation ? '簡報標題' : '論文/檔案標題'} *
            </label>
            <input
              type="text"
              id="title"
              {...register('title', { required: '請輸入標題' })}
              className="input-field"
              placeholder="輸入標題..."
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* 發表年份/創建年份 (必填) */}
          {isFieldVisible('publication_year') && (
            <div>
              <label htmlFor="publication_year" className="block text-sm font-medium text-gray-700 mb-1">
                {isBook ? '出版年份' : '發表/創建年份'} *
              </label>
              <input
                type="number"
                id="publication_year"
                {...register('publication_year', { 
                  required: '請輸入年份',
                  min: { value: 1995, message: '年份不能小於1995' },
                  max: { value: new Date().getFullYear(), message: '年份不能大於今年' }
                })}
                className="input-field"
                min="1995"
                max={new Date().getFullYear()}
              />
              {errors.publication_year && (
                <p className="mt-1 text-sm text-red-600">{errors.publication_year.message}</p>
              )}
            </div>
          )}

          {/* DOI (僅 Paper) */}
          {isFieldVisible('doi') && documentType === 'paper' && (
              <div>
                <label htmlFor="doi" className="block text-sm font-medium text-gray-700 mb-1">
                  DOI
                </label>
                <input
                  type="text"
                  id="doi"
                  {...register('doi')}
                  className="input-field"
                  placeholder="10.1000/182"
                />
              </div>
          )}

          {/* ISBN (僅 Book) */}
          {documentType === 'book' && (
              <div>
                <label htmlFor="isbn" className="block text-sm font-medium text-gray-700 mb-1">
                  ISBN
                </label>
                <input
                  type="text"
                  id="isbn"
                  {...register('isbn')}
                  className="input-field"
                  placeholder="978-3-16-148410-0"
                />
              </div>
          )}

          {/* 引用數 (僅 Paper) */}
          {isFieldVisible('citation_count') && (
            <div>
              <label htmlFor="citation_count" className="block text-sm font-medium text-gray-700 mb-1">
                引用數
              </label>
              <input
                type="number"
                id="citation_count"
                {...register('citation_count', { min: { value: 0, message: '引用數不能為負數' } })}
                className="input-field"
                min="0"
                defaultValue={0}
              />
            </div>
          )}

          {/* URL (所有類型) */}
          {isFieldVisible('url') && (
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                {isVideo || isPresentation ? '原始連結/發佈平台' : '原始連結'}
              </label>
              <input
                type="text"
                id="url"
                {...register('url')}
                className="input-field"
                placeholder="https://example.com/resource"
              />
            </div>
          )}

          {/* 期刊/會議 (僅 Paper) */}
          {isFieldVisible('venue_id') && (
            <div>
              <label htmlFor="venue_id" className="block text-sm font-medium text-gray-700 mb-1">
                期刊/會議
              </label>
              <select
                id="venue_id"
                {...register('venue_id')}
                className="input-field"
              >
                <option value="">請選擇...</option>
                {venues?.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name} ({venue.type})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 摘要 */}
        {isFieldVisible('abstract') && (
            <div>
              <label htmlFor="abstract" className="block text-sm font-medium text-gray-700 mb-1">
                摘要 / 簡述
              </label>
              <textarea
                id="abstract"
                {...register('abstract')}
                rows={4}
                className="input-field"
                placeholder="輸入資源內容摘要..."
              />
            </div>
        )}

        {/* 關鍵字 / 標籤 / 作者 (所有類型) */}
        {isFieldVisible('keywords') && (
            <div>
              <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 mb-1">
                關鍵字
              </label>
              <input
                type="text"
                id="keywords"
                {...register('keywords')}
                className="input-field"
                placeholder="用逗號分隔關鍵字，例如：機器學習, 深度學習"
              />
              <p className="mt-1 text-xs text-gray-500">請用逗號分隔多個關鍵字</p>
            </div>
        )}

        {isFieldVisible('author_names') && (
            <div>
              <label htmlFor="author_names" className="block text-sm font-medium text-gray-700 mb-1">
                {isVideo || isPresentation ? '貢獻者/講者' : '作者'}
              </label>
              <input
                type="text"
                id="author_names"
                {...register('author_names')}
                className="input-field"
                placeholder="用逗號分隔姓名，例如：王小明, 李小華"
              />
              <p className="mt-1 text-xs text-gray-500">請用逗號分隔多個姓名，如果作者不存在會自動創建</p>
            </div>
        )}

        {isFieldVisible('tag_names') && (
            <div>
              <label htmlFor="tag_names" className="block text-sm font-medium text-gray-700 mb-1">
                標籤
              </label>
              <input
                type="text"
                id="tag_names"
                {...register('tag_names')}
                className="input-field"
                placeholder="用逗號分隔標籤名稱，例如：機器學習, 資料科學"
              />
              <p className="mt-1 text-xs text-gray-500">請用逗號分隔多個標籤名稱，如果標籤不存在會自動創建</p>
            </div>
        )}

        {/* 按鈕組 */}
        <div className="flex justify-between space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={() => handleReset()}
            className="btn-secondary"
          >
            取消並重選檔案
          </button>
          <button
            type="submit"
            disabled={createPaperMutation.isLoading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createPaperMutation.isLoading ? '創建中...' : '確認並創建資源'}
          </button>
        </div>
      </form>
    )
  }

  // RENDER STEP: COMPARISON (Phase 2 & Phase 3 Decision) (Step 4: 內容比對與合併)
  const renderComparisonStep = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">發現潛在的重複項目</h3>
            <p className="text-sm text-blue-700 mt-1">
              系統檢測到資料庫中已有類似的資源。您可以選擇將新檔案<b>整合</b>到現有項目中，或者忽略並建立新項目。
            </p>
          </div>
        </div>
      </div>

      {/* 候選列表：使用獨立組件渲染，解決狀態衝突問題 */}
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

      {/* 底部操作：忽略合併 */}
      <div className="border-t border-gray-200 pt-4 mt-4 flex justify-between items-center sticky bottom-0 bg-white">
        <div className="text-sm text-gray-500">
          這些都不是我要找的資源？
        </div>
        <button
          onClick={() => finalSubmitData && createPaperMutation.mutate(finalSubmitData)}
          className="px-5 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center"
        >
          <XMarkIcon className="h-4 w-4 mr-1" />
          忽略合併，直接建立新資源
        </button>
      </div>
    </div>
  )

  // -----------------------------------------------------------
  // Main Modal Structure
  // -----------------------------------------------------------
  if (!isOpen) return null

  let content = null
  switch (step) {
    case 'upload':
      content = renderUploadStep()
      break
    case 'type_decision':
      content = renderTypeDecisionStep()
      break
    case 'form_fill':
      content = renderFormFillStep()
      break
    case 'comparison':
      content = renderComparisonStep()
      break
    default:
      content = renderUploadStep()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-full overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {step === 'upload' ? '上傳並添加新資源' : `步驟 ${step === 'type_decision' ? '2' : '3'}: 填寫元數據`}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">關閉</span>
              ✕
            </button>
          </div>
          
          <div className="mb-6">
            <p className="text-sm text-gray-600">
                目前進度: 
                <span className={`ml-2 font-medium ${step === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>1. 檔案上傳</span>
                <span className="mx-2 text-gray-400">→</span>
                <span className={`font-medium ${step === 'type_decision' ? 'text-blue-600' : step === 'form_fill' || step === 'comparison' ? 'text-green-600' : 'text-gray-400'}`}>2. 類型判定/抽取</span>
                <span className="mx-2 text-gray-400">→</span>
                <span className={`font-medium ${step === 'form_fill' ? 'text-blue-600' : step === 'comparison' ? 'text-green-600' : 'text-gray-400'}`}>3. 元數據填寫</span>
                <span className="mx-2 text-gray-400">→</span>
                <span className={`font-medium ${step === 'comparison' ? 'text-blue-600' : 'text-gray-400'}`}>4. 決策/儲存</span>
            </p>
          </div>

          {content}
        </div>
      </div>
    </div>
  )
} 
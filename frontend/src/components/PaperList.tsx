import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { papersApi, tagsApi } from '../api/papers'
import { ComplexSearchQuery, Paper, Tag } from '../types'
import { DocumentTextIcon, ArrowDownTrayIcon, EyeIcon, TagIcon, PlusIcon, CheckIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

interface PaperListProps {
  searchQuery: ComplexSearchQuery | null
}

export default function PaperList({ searchQuery }: PaperListProps) {
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const [selectedPaperIds, setSelectedPaperIds] = useState<number[]>([])
  const [showBatchActions, setShowBatchActions] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [isCreatingTag, setIsCreatingTag] = useState(false)

  const queryClient = useQueryClient()

  // 判斷是否有搜索條件
  const hasQuery = searchQuery !== null

  // 獲取論文數據
  const { data: papers, isLoading, error } = useQuery(
    ['papers', searchQuery],
    () => hasQuery && searchQuery
      ? papersApi.searchPapersComplex(searchQuery)
      : papersApi.getPapers(),
    {
      enabled: true,
    }
  )

  // 獲取標籤數據
  const { data: tags } = useQuery('tags', tagsApi.getTags)

  // 批量標籤操作 mutation
  const batchTagMutation = useMutation(papersApi.batchTagOperation, {
    onSuccess: (result) => {
      // 重新獲取論文數據
      queryClient.invalidateQueries(['papers'])
      // 顯示成功消息
      alert(`成功更新 ${result.success_count} 篇論文的標籤`)
      // 清空選中
      setSelectedPaperIds([])
      setShowTagModal(false)
      setNewTagName('')
      setIsCreatingTag(false) // 重置創建標籤狀態
    },
    onError: (error: any) => {
      console.error('批量標籤操作失敗:', error)
      alert('批量標籤操作失敗，請稍後再試')
      setIsCreatingTag(false) // 發生錯誤時也要重置狀態
    }
  })

  // 創建標籤 mutation
  const createTagMutation = useMutation(tagsApi.createTag, {
    onSuccess: () => {
      queryClient.invalidateQueries('tags')
    }
  })

  // 全選/取消全選
  const handleSelectAll = () => {
    if (selectedPaperIds.length === papers?.length) {
      setSelectedPaperIds([])
    } else {
      setSelectedPaperIds(papers?.map(p => p.id) || [])
    }
  }

  // 選中/取消選中單個論文
  const handleSelectPaper = (paperId: number) => {
    setSelectedPaperIds(prev => 
      prev.includes(paperId) 
        ? prev.filter(id => id !== paperId)
        : [...prev, paperId]
    )
  }

  // 批量添加現有標籤
  const handleBatchAddTag = (tagId: number) => {
    if (selectedPaperIds.length === 0) {
      alert('請先選擇論文')
      return
    }

    batchTagMutation.mutate({
      paper_ids: selectedPaperIds,
      tag_ids: [tagId],
      operation: 'add'
    })
  }

  // 批量創建並添加新標籤
  const handleCreateAndAddTag = async () => {
    if (!newTagName.trim()) {
      alert('請輸入標籤名稱')
      return
    }

    if (selectedPaperIds.length === 0) {
      alert('請先選擇論文')
      return
    }

    setIsCreatingTag(true)
    try {
      // 生成隨機顏色
      const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']
      const randomColor = colors[Math.floor(Math.random() * colors.length)]
      
      // 創建標籤
      const newTag = await createTagMutation.mutateAsync({ 
        name: newTagName.trim(), 
        color: randomColor 
      })

      // 添加到選中的論文 - 使用 mutateAsync 等待操作完成
      await batchTagMutation.mutateAsync({
        paper_ids: selectedPaperIds,
        tag_ids: [newTag.id],
        operation: 'add'
      })

    } catch (error) {
      console.error('創建標籤或添加標籤失敗:', error)
      alert('操作失敗，請稍後再試')
      setIsCreatingTag(false)
    }
    // 注意：setIsCreatingTag(false) 將在 batchTagMutation 的成功回調中處理
  }

  const handleDownloadPdf = async (paperId: number, title: string) => {
    try {
      const blob = await papersApi.downloadPdf(paperId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${title}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('下載失敗:', error)
      alert('下載失敗，請稍後再試')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-600">載入中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-2">載入失敗</div>
        <button 
          onClick={() => window.location.reload()} 
          className="btn-secondary"
        >
          重新載入
        </button>
      </div>
    )
  }

  if (!papers || papers.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">沒有找到論文</h3>
        <p className="mt-1 text-sm text-gray-500">
          {hasQuery ? '請嘗試調整搜索條件' : '還沒有添加任何論文'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 批量操作工具栏 */}
      {papers && papers.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedPaperIds.length === papers.length && papers.length > 0}
                  onChange={handleSelectAll}
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  全選 ({selectedPaperIds.length}/{papers.length})
                </span>
              </label>
              
              {selectedPaperIds.length > 0 && (
                <span className="text-sm text-blue-600">
                  已選中 {selectedPaperIds.length} 篇論文
                </span>
              )}
            </div>

            {selectedPaperIds.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowTagModal(true)}
                  className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
                >
                  <TagIcon className="h-4 w-4 mr-1" />
                  添加標籤
                </button>
                <button
                  onClick={() => setSelectedPaperIds([])}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  取消選擇
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 論文列表 */}
      {papers && papers.map((paper) => (
        <div key={paper.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start space-x-4">
            {/* 複選框 */}
            <div className="flex-shrink-0 mt-1">
              <input
                type="checkbox"
                checked={selectedPaperIds.includes(paper.id)}
                onChange={() => handleSelectPaper(paper.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* 論文內容 */}
            <div className="flex-1">
              {/* 標題 */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {paper.title}
              </h3>

              {/* 作者 */}
              <div className="flex flex-wrap items-center text-sm text-gray-600 mb-2">
                <span className="font-medium mr-2">作者:</span>
                {paper.authors.map((paperAuthor, index) => (
                  <span key={paperAuthor.author.id}>
                    {paperAuthor.author.name}
                    {paperAuthor.is_corresponding && <sup className="text-primary-600">*</sup>}
                    {index < paper.authors.length - 1 && ', '}
                  </span>
                ))}
              </div>

              {/* 期刊/會議 */}
              {paper.venue && (
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">期刊/會議:</span> {paper.venue.name} 
                  <span className="ml-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {paper.venue.type === 'journal' ? '期刊' : '會議'}
                  </span>
                  {paper.venue.impact_factor && (
                    <span className="ml-2 text-xs text-gray-500">
                      影響因子: {paper.venue.impact_factor}
                    </span>
                  )}
                </div>
              )}

              {/* 年份和引用數 */}
              <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                <span><span className="font-medium">年份:</span> {paper.publication_year}</span>
                <span><span className="font-medium">引用數:</span> {paper.citation_count}</span>
                {paper.doi && (
                  <span><span className="font-medium">DOI:</span> {paper.doi}</span>
                )}
              </div>

              {/* 標籤 */}
              {paper.tags && paper.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {paper.tags.map((paperTag) => (
                    <span
                      key={paperTag.tag.id}
                      className="text-xs px-2 py-1 rounded text-white"
                      style={{ backgroundColor: paperTag.tag.color }}
                    >
                      {paperTag.tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* 摘要（摘錄） */}
              {paper.abstract && (
                <p className="text-sm text-gray-700 line-clamp-3">
                  <span className="font-medium">摘要:</span> {paper.abstract}
                </p>
              )}
            </div>

            {/* 操作按鈕 */}
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => setSelectedPaper(paper)}
                className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-700"
              >
                <EyeIcon className="h-4 w-4" />
                <span>詳情</span>
              </button>
              
              {/* 論文連結：優先使用 DOI，否則使用原始 URL */}
              {(paper.doi || (paper.url && paper.url.startsWith('http'))) && (
                <a
                  href={paper.doi ? `https://doi.org/${paper.doi}` : paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>論文連結</span>
                </a>
              )}
              {!paper.doi && (!paper.url || !paper.url.startsWith('http')) && (
                <span className="text-gray-400 text-sm">無可用連結</span>
              )}
              
              {paper.pdf_file_path && (
                <button
                  onClick={() => handleDownloadPdf(paper.id, paper.title)}
                  className="flex items-center space-x-1 text-sm text-green-600 hover:text-green-700"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  <span>下載PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* 最後更新時間 */}
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            最後更新: {format(new Date(paper.updated_at), 'yyyy-MM-dd HH:mm')}
          </div>
        </div>
      ))}

      {/* 批量標籤操作彈窗 (略) */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  為 {selectedPaperIds.length} 篇論文添加標籤
                </h3>
                <button
                  onClick={() => setShowTagModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              {/* 現有標籤列表 */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">選擇現有標籤:</h4>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {tags?.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleBatchAddTag(tag.id)}
                      disabled={batchTagMutation.isLoading}
                      className="flex items-center justify-between p-2 text-left border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span
                        className="text-xs px-2 py-1 rounded text-white flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                      <PlusIcon className="h-4 w-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>

              {/* 創建新標籤 */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">創建新標籤:</h4>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="輸入新標籤名稱..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateAndAddTag()
                      }
                    }}
                  />
                  <button
                    onClick={handleCreateAndAddTag}
                    disabled={!newTagName.trim() || isCreatingTag || batchTagMutation.isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingTag ? '創建中...' : '創建並添加'}
                  </button>
                </div>
              </div>

              {/* 操作按鈕 */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowTagModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 論文詳情彈窗 */}
      {selectedPaper && (
        <PaperDetailModal
          paper={selectedPaper}
          onClose={() => setSelectedPaper(null)}
        />
      )}
    </div>
  )
}

// 論文詳情彈窗組件
interface PaperDetailModalProps {
  paper: Paper
  onClose: () => void
}

function PaperDetailModal({ paper, onClose }: PaperDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-full overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-900">{paper.title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">關閉</span>
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* 基本資訊 */}
            <div>
              <h3 className="text-lg font-semibold mb-2">基本資訊</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium">發表年份:</span> {paper.publication_year}</div>
                <div><span className="font-medium">引用數:</span> {paper.citation_count}</div>
                {paper.doi && <div><span className="font-medium">DOI:</span> {paper.doi}</div>}
                {paper.venue && (
                  <div>
                    <span className="font-medium">期刊/會議:</span> {paper.venue.name}
                  </div>
                )}
                {/* 論文連結：優先使用 DOI，否則使用原始 URL */}
                {(paper.doi || paper.url) && (
                  <div className="col-span-2">
                    <span className="font-medium">論文連結:</span>{' '}
                    <a
                      href={paper.doi ? `https://doi.org/${paper.doi}` : paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800 underline break-all"
                    >
                      {paper.doi ? `https://doi.org/${paper.doi}` : paper.url}
                    </a>
                  </div>
                )}
                {!(paper.doi || paper.url) && (
                  <div className="col-span-2 text-sm text-gray-500 italic">
                    無可用連結
                  </div>
                )}
              </div>
            </div>

            {/* 作者信息 */}
            <div>
              <h3 className="text-lg font-semibold mb-2">作者</h3>
              <div className="space-y-2">
                {paper.authors.map((paperAuthor) => (
                  <div key={paperAuthor.author.id} className="text-sm">
                    <span className="font-medium">{paperAuthor.author.name}</span>
                    {paperAuthor.is_corresponding && <sup className="text-primary-600 ml-1">通訊作者</sup>}
                    {paperAuthor.author.affiliation && (
                      <span className="text-gray-600 ml-2">- {paperAuthor.author.affiliation}</span>
                    )}
                    {paperAuthor.author.email && (
                      <span className="text-gray-600 ml-2">({paperAuthor.author.email})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 摘要 */}
            {paper.abstract && (
              <div>
                <h3 className="text-lg font-semibold mb-2">摘要</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{paper.abstract}</p>
              </div>
            )}

            {/* 關鍵字 */}
            {paper.keywords && paper.keywords.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">關鍵字</h3>
                <div className="flex flex-wrap gap-2">
                  {paper.keywords.map((keyword, index) => (
                    <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 標籤 */}
            {paper.tags && paper.tags.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">標籤</h3>
                <div className="flex flex-wrap gap-2">
                  {paper.tags.map((paperTag) => (
                    <span
                      key={paperTag.tag.id}
                      className="text-sm px-2 py-1 rounded text-white"
                      style={{ backgroundColor: paperTag.tag.color }}
                    >
                      {paperTag.tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="btn-secondary">
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 
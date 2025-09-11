import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { papersApi } from '../api/papers'
import { ComplexSearchQuery, Paper } from '../types'
import { DocumentTextIcon, ArrowDownTrayIcon, EyeIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

interface PaperListProps {
  searchQuery: ComplexSearchQuery | null
}

export default function PaperList({ searchQuery }: PaperListProps) {
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)

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
      {papers.map((paper) => (
        <div key={paper.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
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
            <div className="flex flex-col space-y-2 ml-4">
              <button
                onClick={() => setSelectedPaper(paper)}
                className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-700"
              >
                <EyeIcon className="h-4 w-4" />
                <span>詳情</span>
              </button>
              
              {paper.url && (
                <a
                  href={paper.url}
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
            {/* 基本信息 */}
            <div>
              <h3 className="text-lg font-semibold mb-2">基本信息</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium">發表年份:</span> {paper.publication_year}</div>
                <div><span className="font-medium">引用數:</span> {paper.citation_count}</div>
                {paper.doi && <div><span className="font-medium">DOI:</span> {paper.doi}</div>}
                {paper.venue && (
                  <div>
                    <span className="font-medium">期刊/會議:</span> {paper.venue.name}
                  </div>
                )}
                {paper.url && (
                  <div className="col-span-2">
                    <span className="font-medium">論文連結:</span>{' '}
                    <a 
                      href={paper.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800 underline break-all"
                    >
                      {paper.url}
                    </a>
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
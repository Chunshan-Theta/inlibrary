import React, { useState } from 'react'
import { useQuery } from 'react-query'
import Head from 'next/head'
import Layout from '../components/Layout'
import { tagsApi, papersApi } from '../api/papers'
import { Tag, Paper } from '../types'
import { format } from 'date-fns'
import { DocumentTextIcon, ArrowDownTrayIcon, EyeIcon, TagIcon } from '@heroicons/react/24/outline'

export default function TagsPage() {
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)

  // 獲取所有標籤
  const { data: tags, isLoading: tagsLoading } = useQuery('tags', tagsApi.getTags)

  // 獲取所有論文
  const { data: allPapers, isLoading: papersLoading } = useQuery('papers', () => papersApi.getPapers())

  // 根據選中的標籤篩選論文
  const filteredPapers = selectedTagId 
    ? allPapers?.filter(paper => 
        paper.tags.some(paperTag => paperTag.tag.id === selectedTagId)
      ) || []
    : allPapers || []

  const selectedTag = tags?.find(tag => tag.id === selectedTagId)

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

  if (tagsLoading || papersLoading) {
    return (
      <Layout>
        <Head>
          <title>標籤瀏覽 - 研究室論文管理系統</title>
        </Head>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">載入中...</span>
        </div>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>標籤瀏覽 - 研究室論文管理系統</title>
        <meta name="description" content="通過標籤瀏覽和篩選論文" />
      </Head>

      <Layout>
        <div className="max-w-7xl mx-auto">
          {/* 頁面標題 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">標籤瀏覽</h1>
            <p className="text-gray-600">通過標籤快速找到相關論文</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* 左側標籤列表 */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <TagIcon className="h-5 w-5 mr-2" />
                  標籤列表
                </h2>
                
                {/* 全部論文選項 */}
                <button
                  onClick={() => setSelectedTagId(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-2 transition-colors ${
                    selectedTagId === null
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">全部論文</span>
                    <span className="text-sm text-gray-500">
                      {allPapers?.length || 0}
                    </span>
                  </div>
                </button>

                {/* 標籤列表 */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {tags?.map((tag) => {
                    const paperCount = allPapers?.filter(paper => 
                      paper.tags.some(paperTag => paperTag.tag.id === tag.id)
                    ).length || 0

                    return (
                      <button
                        key={tag.id}
                        onClick={() => setSelectedTagId(tag.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          selectedTagId === tag.id
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'hover:bg-gray-100 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span
                              className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                              style={{ backgroundColor: tag.color }}
                            ></span>
                            <span className="font-medium truncate">{tag.name}</span>
                          </div>
                          <span className="text-sm text-gray-500 ml-2">
                            {paperCount}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {tags?.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-sm">還沒有任何標籤</p>
                  </div>
                )}
              </div>
            </div>

            {/* 右側論文列表 */}
            <div className="lg:col-span-3">
              {/* 篩選結果標題 */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    {selectedTag ? (
                      <div className="flex items-center">
                        <span
                          className="w-4 h-4 rounded-full mr-2"
                          style={{ backgroundColor: selectedTag.color }}
                        ></span>
                        <h2 className="text-xl font-semibold text-gray-900">
                          標籤: {selectedTag.name}
                        </h2>
                      </div>
                    ) : selectedTagId === null ? (
                      <h2 className="text-xl font-semibold text-gray-900">
                        論文統計概覽
                      </h2>
                    ) : (
                      <h2 className="text-xl font-semibold text-gray-900">
                        全部論文
                      </h2>
                    )}
                    <p className="text-gray-600 mt-1">
                      {selectedTagId === null 
                        ? `數據統計分析 - 總共 ${filteredPapers.length} 篇論文`
                        : `找到 ${filteredPapers.length} 篇論文`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* 論文列表或統計信息 */}
              {selectedTagId === null ? (
                /* 顯示全部論文的統計信息 */
                <StatisticsView papers={allPapers || []} />
              ) : (
                /* 顯示篩選後的論文列表 */
                filteredPapers.length > 0 ? (
                  <div className="space-y-4">
                    {filteredPapers.map((paper) => (
                      <div key={paper.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
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
                                  {paperAuthor.is_corresponding && <sup className="text-blue-600">*</sup>}
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
                                  <button
                                    key={paperTag.tag.id}
                                    onClick={() => setSelectedTagId(paperTag.tag.id)}
                                    className={`text-xs px-2 py-1 rounded text-white transition-opacity ${
                                      selectedTagId === paperTag.tag.id 
                                        ? 'ring-2 ring-offset-1 ring-blue-400' 
                                        : 'hover:opacity-80'
                                    }`}
                                    style={{ backgroundColor: paperTag.tag.color }}
                                    title="點擊篩選此標籤"
                                  >
                                    {paperTag.tag.name}
                                  </button>
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
                              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                            >
                              <EyeIcon className="h-4 w-4" />
                              <span>詳情</span>
                            </button>
                            
                            {paper.url && (
                              <a
                                href={paper.url.startsWith('http') ? paper.url : `https://www.google.com/search?q=${paper.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-1 text-sm text-green-600 hover:text-green-700"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                <span>連結</span>
                              </a>
                            )}
                            
                            {paper.pdf_file_path && (
                              <button
                                onClick={() => handleDownloadPdf(paper.id, paper.title)}
                                className="flex items-center space-x-1 text-sm text-purple-600 hover:text-purple-700"
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                <span>PDF</span>
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
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      沒有找到標籤為「{selectedTag?.name}」的論文
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      請選擇其他標籤或新增論文
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* 論文詳情彈窗 */}
        {selectedPaper && (
          <PaperDetailModal
            paper={selectedPaper}
            onClose={() => setSelectedPaper(null)}
          />
        )}
      </Layout>
    </>
  )
}

// 論文詳情彈窗組件
interface PaperDetailModalProps {
  paper: Paper
  onClose: () => void
}

function PaperDetailModal({ paper, onClose }: PaperDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">論文詳情</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* 標題 */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 leading-tight">
                {paper.title}
              </h3>
            </div>

            {/* 作者信息 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">作者</h4>
              <div className="flex flex-wrap gap-2">
                {paper.authors.map((paperAuthor) => (
                  <div
                    key={paperAuthor.author.id}
                    className="bg-gray-100 px-3 py-1 rounded-full text-sm"
                  >
                    {paperAuthor.author.name}
                    {paperAuthor.is_corresponding && (
                      <span className="text-blue-600 ml-1">*</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 期刊/會議信息 */}
            {paper.venue && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">期刊/會議</h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{paper.venue.name}</p>
                  <p className="text-sm text-gray-600">
                    類型: {paper.venue.type === 'journal' ? '期刊' : '會議'}
                    {paper.venue.impact_factor && (
                      <span className="ml-4">影響因子: {paper.venue.impact_factor}</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* 基本信息 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700">發表年份</h4>
                <p className="text-gray-900">{paper.publication_year}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700">引用數</h4>
                <p className="text-gray-900">{paper.citation_count}</p>
              </div>
              {paper.doi && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700">DOI</h4>
                  <p className="text-gray-900 text-sm break-all">{paper.doi}</p>
                </div>
              )}
            </div>

            {/* 標籤 */}
            {paper.tags && paper.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">標籤</h4>
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

            {/* 關鍵詞 */}
            {paper.keywords && paper.keywords.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">關鍵詞</h4>
                <div className="flex flex-wrap gap-2">
                  {paper.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 摘要 */}
            {paper.abstract && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">摘要</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {paper.abstract}
                  </p>
                </div>
              </div>
            )}

            {/* 連結 */}
            <div className="flex space-x-4">
              {paper.url && (
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  查看原文
                </a>
              )}
              
              {paper.pdf_file_path && (
                <button
                  onClick={async () => {
                    try {
                      const blob = await papersApi.downloadPdf(paper.id)
                      const url = window.URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = `${paper.title}.pdf`
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                      window.URL.revokeObjectURL(url)
                    } catch (error) {
                      console.error('下載失敗:', error)
                      alert('下載失敗，請稍後再試')
                    }
                  }}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  下載 PDF
                </button>
              )}
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button onClick={onClose} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 統計視圖組件
interface StatisticsViewProps {
  papers: Paper[]
}

function StatisticsView({ papers }: StatisticsViewProps) {
  // 計算統計數據
  const totalPapers = papers.length
  
  // 按年份統計
  const yearStats = papers.reduce((acc, paper) => {
    const year = paper.publication_year
    acc[year] = (acc[year] || 0) + 1
    return acc
  }, {} as Record<number, number>)
  
  // 按期刊/會議統計
  const venueStats = papers.reduce((acc, paper) => {
    if (paper.venue) {
      const venueName = paper.venue.name
      if (!acc[venueName]) {
        acc[venueName] = {
          count: 0,
          type: paper.venue.type,
          impact_factor: paper.venue.impact_factor
        }
      }
      acc[venueName].count += 1
    }
    return acc
  }, {} as Record<string, { count: number; type: string; impact_factor?: number }>)
  
  // 按標籤統計
  const tagStats = papers.reduce((acc, paper) => {
    paper.tags.forEach(paperTag => {
      const tagName = paperTag.tag.name
      if (!acc[tagName]) {
        acc[tagName] = {
          count: 0,
          color: paperTag.tag.color
        }
      }
      acc[tagName].count += 1
    })
    return acc
  }, {} as Record<string, { count: number; color: string }>)
  
  // 排序統計數據
  const sortedYears = Object.entries(yearStats)
    .sort(([a], [b]) => parseInt(b) - parseInt(a))
    .slice(0, 10)
  
  const sortedVenues = Object.entries(venueStats)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 15)
  
  const sortedTags = Object.entries(tagStats)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
  
  // 計算總引用數
  // const totalCitations = papers.reduce((sum, paper) => sum + paper.citation_count, 0)
  
  // 計算平均引用數
  // const averageCitations = totalPapers > 0 ? (totalCitations / totalPapers).toFixed(1) : '0'
  
  return (
    <div className="space-y-6">
      {/* 概覽統計 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{totalPapers}</div>
          <div className="text-sm text-blue-700">總論文數</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{Object.keys(venueStats).length}</div>
          <div className="text-sm text-green-700">期刊/會議數</div>
        </div>
        {/* <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">{totalCitations}</div>
          <div className="text-sm text-purple-700">總引用數</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-600">{averageCitations}</div>
          <div className="text-sm text-orange-700">平均引用數</div>
        </div> */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 年份分布 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">年份分布</h3>
          <div className="space-y-2">
            {sortedYears.map(([year, count]) => (
              <div key={year} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{year} 年</span>
                <div className="flex items-center">
                  <div 
                    className="bg-blue-200 h-4 rounded mr-2"
                    style={{ width: `${Math.max((count / Math.max(...Object.values(yearStats))) * 100, 10)}px` }}
                  ></div>
                  <span className="text-sm text-gray-600">{count} 篇</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 期刊/會議分布 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">期刊/會議分布 (前15名)</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sortedVenues.map(([venue, data]) => (
              <div key={venue} className="border-b border-gray-100 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{venue}</div>
                    <div className="flex items-center mt-1">
                      <span className={`text-xs px-2 py-1 rounded ${
                        data.type === 'journal' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {data.type === 'journal' ? '期刊' : '會議'}
                      </span>
                      {data.impact_factor && (
                        <span className="ml-2 text-xs text-gray-500">
                          IF: {data.impact_factor}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-600 ml-2">{data.count} 篇</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        
      </div>
    </div>
  )
}

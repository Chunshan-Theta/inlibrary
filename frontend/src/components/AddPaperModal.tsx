import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { papersApi, authorsApi, tagsApi, venuesApi } from '../api/papers'
import { PaperCreate } from '../types'

interface AddPaperModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddPaperModal({ isOpen, onClose }: AddPaperModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PaperCreate>()

  // 獲取下拉選項數據
  const { data: authors } = useQuery('authors', authorsApi.getAuthors)
  const { data: tags } = useQuery('tags', tagsApi.getTags)
  const { data: venues } = useQuery('venues', venuesApi.getVenues)

  // 創建論文的 mutation
  const createPaperMutation = useMutation(papersApi.createPaper, {
    onSuccess: async (newPaper) => {
      // 如果有文件，上傳PDF
      if (selectedFile) {
        try {
          await papersApi.uploadPdf(newPaper.id, selectedFile)
        } catch (error) {
          console.error('PDF上傳失敗:', error)
          alert('論文創建成功，但PDF上傳失敗')
        }
      }
      
      // 刷新論文列表
      queryClient.invalidateQueries('papers')
      
      // 重置表單並關閉彈窗
      reset()
      setSelectedFile(null)
      onClose()
      
      alert('論文添加成功！')
    },
    onError: (error) => {
      console.error('創建論文失敗:', error)
      alert('創建論文失敗，請稍後再試')
    }
  })

  const onSubmit = (data: PaperCreate) => {
    // 處理作者ID數組
    const authorIds = Array.from(
      document.querySelectorAll('input[name="author_ids"]:checked') as NodeListOf<HTMLInputElement>
    ).map(input => parseInt(input.value))

    // 處理標籤ID數組
    const tagIds = Array.from(
      document.querySelectorAll('input[name="tag_ids"]:checked') as NodeListOf<HTMLInputElement>
    ).map(input => parseInt(input.value))

    // 處理關鍵字數組
    const keywords = data.keywords ? 
      (data.keywords as any).split(',').map((k: string) => k.trim()).filter((k: string) => k) : 
      []

    const submitData: PaperCreate = {
      ...data,
      author_ids: authorIds,
      tag_ids: tagIds,
      keywords: keywords
    }

    createPaperMutation.mutate(submitData)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('請選擇PDF文件')
        return
      }
      setSelectedFile(file)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-full overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">添加新論文</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">關閉</span>
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 標題 */}
              <div className="md:col-span-2">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  論文標題 *
                </label>
                <input
                  type="text"
                  id="title"
                  {...register('title', { required: '請輸入論文標題' })}
                  className="input-field"
                  placeholder="輸入論文標題..."
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              {/* 發表年份 */}
              <div>
                <label htmlFor="publication_year" className="block text-sm font-medium text-gray-700 mb-1">
                  發表年份 *
                </label>
                <input
                  type="number"
                  id="publication_year"
                  {...register('publication_year', { 
                    required: '請輸入發表年份',
                    min: { value: 1900, message: '年份不能小於1900' },
                    max: { value: 2030, message: '年份不能大於2030' }
                  })}
                  className="input-field"
                  min="1900"
                  max="2030"
                />
                {errors.publication_year && (
                  <p className="mt-1 text-sm text-red-600">{errors.publication_year.message}</p>
                )}
              </div>

              {/* 引用數 */}
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
                {errors.citation_count && (
                  <p className="mt-1 text-sm text-red-600">{errors.citation_count.message}</p>
                )}
              </div>

              {/* DOI */}
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

              {/* URL */}
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                  論文連結
                </label>
                <input
                  type="url"
                  id="url"
                  {...register('url')}
                  className="input-field"
                  placeholder="https://example.com/paper"
                />
              </div>

              {/* 期刊/會議 */}
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
            </div>

            {/* 摘要 */}
            <div>
              <label htmlFor="abstract" className="block text-sm font-medium text-gray-700 mb-1">
                摘要
              </label>
              <textarea
                id="abstract"
                {...register('abstract')}
                rows={4}
                className="input-field"
                placeholder="輸入論文摘要..."
              />
            </div>

            {/* 關鍵字 */}
            <div>
              <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 mb-1">
                關鍵字
              </label>
              <input
                type="text"
                id="keywords"
                {...register('keywords')}
                className="input-field"
                placeholder="用逗號分隔關鍵字，例如：機器學習, 深度學習, 自然語言處理"
              />
              <p className="mt-1 text-xs text-gray-500">請用逗號分隔多個關鍵字</p>
            </div>

            {/* 作者選擇 */}
            {authors && authors.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  選擇作者
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto border rounded p-3">
                  {authors.map((author) => (
                    <label key={author.id} className="flex items-center">
                      <input
                        type="checkbox"
                        name="author_ids"
                        value={author.id}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm">{author.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 標籤選擇 */}
            {tags && tags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  選擇標籤
                </label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center">
                      <input
                        type="checkbox"
                        name="tag_ids"
                        value={tag.id}
                        className="sr-only"
                      />
                      <span 
                        className="text-sm px-3 py-1 rounded cursor-pointer border-2 border-transparent hover:border-gray-300"
                        style={{ backgroundColor: tag.color, color: 'white' }}
                      >
                        {tag.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* PDF 文件上傳 */}
            <div>
              <label htmlFor="pdf_file" className="block text-sm font-medium text-gray-700 mb-1">
                PDF 文件
              </label>
              <input
                type="file"
                id="pdf_file"
                accept=".pdf"
                onChange={handleFileChange}
                className="input-field"
              />
              {selectedFile && (
                <p className="mt-1 text-sm text-green-600">
                  已選擇文件: {selectedFile.name}
                </p>
              )}
            </div>

            {/* 按鈕組 */}
            <div className="flex justify-end space-x-4 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={createPaperMutation.isLoading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createPaperMutation.isLoading ? '創建中...' : '添加論文'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 
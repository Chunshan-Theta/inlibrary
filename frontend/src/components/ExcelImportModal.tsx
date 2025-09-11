import React, { useState } from 'react'
import { useMutation, useQueryClient } from 'react-query'
import { papersApi } from '../api/papers'
import { ExcelImportResult } from '../types'

interface ExcelImportModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExcelImportModal({ isOpen, onClose }: ExcelImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const queryClient = useQueryClient()

  // Excel導入的 mutation
  const importExcelMutation = useMutation(papersApi.importExcel, {
    onSuccess: (result) => {
      setImportResult(result)
      // 刷新論文列表
      queryClient.invalidateQueries('papers')
    },
    onError: (error) => {
      console.error('Excel導入失敗:', error)
      alert('Excel導入失敗，請檢查文件格式')
    }
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        alert('請選擇Excel文件 (.xlsx 或 .xls)')
        return
      }
      setSelectedFile(file)
      setImportResult(null)
    }
  }

  const handleImport = () => {
    if (!selectedFile) {
      alert('請先選擇文件')
      return
    }
    
    importExcelMutation.mutate(selectedFile)
  }

  const handleClose = () => {
    setSelectedFile(null)
    setImportResult(null)
    setShowDetails(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-full overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Excel 文件導入</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">關閉</span>
              ✕
            </button>
          </div>

          {!importResult ? (
            <div className="space-y-6">
              {/* 文件說明 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">支持的文件格式</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Web of Science 導出的 Excel 文件 (.xlsx, .xls)</li>
                  <li>• 文件應包含論文標題、作者、發表年份等基本信息</li>
                  <li>• 系統會自動識別並創建不存在的作者和期刊</li>
                </ul>
              </div>

              {/* 文件選擇 */}
              <div>
                <label htmlFor="excel_file" className="block text-sm font-medium text-gray-700 mb-2">
                  選擇 Excel 文件
                </label>
                <input
                  type="file"
                  id="excel_file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-medium
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-green-600">
                    已選擇文件: {selectedFile.name}
                  </p>
                )}
              </div>

              {/* 導入按鈕 */}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  取消
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selectedFile || importExcelMutation.isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
                >
                  {importExcelMutation.isLoading ? '導入中...' : '開始導入'}
                </button>
              </div>
            </div>
          ) : (
            /* 導入結果 */
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="mt-2 text-lg font-medium text-gray-900">導入完成</h3>
              </div>

              {/* 統計信息 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{importResult.total_rows}</div>
                  <div className="text-sm text-gray-500">總行數</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{importResult.successful_imports}</div>
                  <div className="text-sm text-gray-500">成功導入</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{importResult.failed_imports}</div>
                  <div className="text-sm text-gray-500">導入失敗</div>
                </div>
              </div>

              {/* 錯誤詳情 */}
              {importResult.errors.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    {showDetails ? '隱藏' : '顯示'} 錯誤詳情
                    <svg 
                      className={`ml-1 h-4 w-4 transform ${showDetails ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showDetails && (
                    <div className="mt-2 max-h-40 overflow-y-auto bg-red-50 border border-red-200 rounded p-3">
                      <ul className="text-sm text-red-700 space-y-1">
                        {importResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 關閉按鈕 */}
              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  完成
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
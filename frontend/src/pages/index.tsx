import { useState } from 'react'
import Head from 'next/head'
import Layout from '../components/Layout'
import QueryBuilder from '../components/SearchForm'
import PaperList from '../components/PaperList'
import AddPaperModal from '../components/AddPaperModal'
import ExcelImportModal from '../components/ExcelImportModal'
import { PlusIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline'
import { ComplexSearchQuery } from '../types'

export default function Home() {
  const [searchQuery, setSearchQuery] = useState<ComplexSearchQuery | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  const handleSearch = (query: ComplexSearchQuery) => {
    setSearchQuery(query)
  }

  const handleReset = () => {
    setSearchQuery(null)
  }

  return (
    <>
      <Head>
        <title>研究室論文管理系統</title>
        <meta name="description" content="研究室論文管理和搜索系統" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout>
        <div className="space-y-6">
          {/* 頁面標題和操作按鈕 */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">論文管理系統</h1>
              <p className="mt-2 text-gray-600">搜索、管理和組織研究論文</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="btn-secondary flex items-center space-x-2"
              >
                <DocumentArrowUpIcon className="h-5 w-5" />
                <span>Excel 導入</span>
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <PlusIcon className="h-5 w-5" />
                <span>添加論文</span>
              </button>
            </div>
          </div>

          {/* 搜索表單 */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">搜索論文</h2>
            <QueryBuilder 
              onSearch={handleSearch} 
              onReset={handleReset}
              initialQuery={searchQuery || undefined}
            />
          </div>

          {/* 論文列表 */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">論文列表</h2>
            <PaperList searchQuery={searchQuery} />
          </div>
        </div>

                {/* 添加論文彈窗 */}
        <AddPaperModal 
          isOpen={isAddModalOpen} 
          onClose={() => setIsAddModalOpen(false)}
        />

        {/* Excel 導入彈窗 */}
        <ExcelImportModal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)}
        />
      </Layout>
    </>
  )
} 
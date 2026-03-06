import React, { useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import AddPaperModal from '../components/AddPaperModal';
import ExcelImportModal from '../components/ExcelImportModal';
import ManualAddPaperModal from '../components/ManualAddPaperModal';
import { DocumentArrowDownIcon, ArrowUpTrayIcon, DocumentPlusIcon } from '@heroicons/react/24/outline';

export default function PaperManagement() {
  // 從首頁搬過來的狀態
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // 未來要用到的：手動新增論文狀態
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);

  return (
    <>
      <Head>
        <title>文獻管理 - 研究室論文管理系統</title>
      </Head>

      <Layout>
        <div className="space-y-6">
          {/* 頁面標題 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">文獻管理</h1>
            <p className="mt-2 text-sm text-gray-600">
              在此匯入、上傳檔案或手動建檔您的學術論文。
            </p>
          </div>

          {/* 三大功能卡片區塊 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. 文件導入 */}
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <div className="p-4 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
                <DocumentArrowDownIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">文件導入</h3>
              <p className="mt-2 text-sm text-gray-500 text-center">
                批量匯入 Excel 等格式的論文資料。
              </p>
            </button>

            {/* 2. 上傳論文檔案 */}
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group"
            >
              <div className="p-4 bg-indigo-50 rounded-full group-hover:bg-indigo-100 transition-colors">
                <ArrowUpTrayIcon className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">上傳論文檔案</h3>
              <p className="mt-2 text-sm text-gray-500 text-center">
                上傳 PDF PPT MP4 MOV 檔案，系統將自動解析內容。
              </p>
            </button>

            {/* 3. 手動新增論文 */}
            <button 
              onClick={() => setIsManualAddModalOpen(true)}
              className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-green-300 transition-all group"
            >
              <div className="p-4 bg-green-50 rounded-full group-hover:bg-green-100 transition-colors">
                <DocumentPlusIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">手動新增論文</h3>
              <p className="mt-2 text-sm text-gray-500 text-center">
                無需檔案，直接填寫標題與摘要建檔。
              </p>
            </button>

          </div>
        </div>

        {/* 添加論文彈窗 */}
        <AddPaperModal 
          isOpen={isAddModalOpen} 
          onClose={() => setIsAddModalOpen(false)}
        />
        
        {/* 文件導入彈窗 */}
        <ExcelImportModal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)}
        />
        
        {/* 手動新增論文彈窗 */}
        <ManualAddPaperModal 
          isOpen={isManualAddModalOpen} 
          onClose={() => setIsManualAddModalOpen(false)}
        />
      </Layout>
    </>
  );
}
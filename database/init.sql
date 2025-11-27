-- 研究室論文管理系統數據庫初始化腳本

-- 創建作者表
CREATE TABLE authors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    affiliation VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建期刊/會議表
CREATE TABLE venues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('journal', 'conference')),
    impact_factor DECIMAL(5,3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建論文表
CREATE TABLE papers (
    id SERIAL PRIMARY KEY,
    title VARCHAR(1000) NOT NULL,
    abstract TEXT,
    document_type VARCHAR(50) NOT NULL DEFAULT 'paper', -- 新增欄位
    publication_year INTEGER NOT NULL,
    doi VARCHAR(255) UNIQUE,
    citation_count INTEGER DEFAULT 0,
    venue_id INTEGER REFERENCES venues(id),
    pdf_file_path VARCHAR(500),
    file_size BIGINT,
    url VARCHAR(1000), -- 論文連結
    keywords TEXT[], -- PostgreSQL 陣列類型存儲關鍵字
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建論文作者關聯表（多對多關係）
CREATE TABLE paper_authors (
    id SERIAL PRIMARY KEY,
    paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    author_order INTEGER NOT NULL, -- 作者順序
    is_corresponding BOOLEAN DEFAULT FALSE,
    UNIQUE(paper_id, author_id)
);

-- 創建論文標籤表
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#6B7280' -- 十六進制顏色碼
);

-- 創建論文標籤關聯表
CREATE TABLE paper_tags (
    id SERIAL PRIMARY KEY,
    paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(paper_id, tag_id)
);

-- 創建引用關係表（論文之間的引用關係）
CREATE TABLE citations (
    id SERIAL PRIMARY KEY,
    citing_paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    cited_paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    UNIQUE(citing_paper_id, cited_paper_id)
);

-- 創建全文搜索索引
CREATE INDEX idx_papers_title_search ON papers USING gin(to_tsvector('english', title));
CREATE INDEX idx_papers_abstract_search ON papers USING gin(to_tsvector('english', abstract));
CREATE INDEX idx_papers_year ON papers(publication_year);
CREATE INDEX idx_papers_citation_count ON papers(citation_count);
CREATE INDEX idx_authors_name_search ON authors USING gin(to_tsvector('english', name));

-- 插入初始測試數據
INSERT INTO venues (name, type, impact_factor) VALUES 
('Nature', 'journal', 49.962),
('Science', 'journal', 47.728),
('ICML', 'conference', NULL),
('NeurIPS', 'conference', NULL);

INSERT INTO authors (name, email, affiliation) VALUES 
('張三', 'zhang@example.com', '台灣大學資訊工程學系'),
('李四', 'li@example.com', '清華大學電機工程學系'),
('王五', 'wang@example.com', '交通大學資訊科學與工程研究所');

INSERT INTO tags (name, color) VALUES 
('機器學習', '#3B82F6'),
('深度學習', '#EF4444'),
('自然語言處理', '#10B981'),
('電腦視覺', '#F59E0B'),
('資料探勘', '#8B5CF6');

-- 觸發器：自動更新 updated_at 時間戳
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_papers_updated_at BEFORE UPDATE ON papers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 
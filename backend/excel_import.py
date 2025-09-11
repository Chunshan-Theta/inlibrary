import pandas as pd
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Tuple
import re
import uuid
import tempfile
import os
import io
from models import Paper, Author, PaperAuthor, Venue
from crud import create_author, create_venue, get_author, get_venue
from schemas import ExcelImportResult, PaperResponse, ExcelPreviewData, ExcelColumnInfo, ExcelImportConfig, FieldMapping

# 臨時文件存儲
TEMP_FILES = {}

def preview_file(file_content: bytes, filename: str) -> ExcelPreviewData:
    """預覽文件內容（支持Excel、CSV、TSV）"""
    try:
        # 根據文件擴展名讀取不同格式的文件
        file_ext = filename.lower().split('.')[-1]
        
        if file_ext in ['xlsx', 'xls']:
            df = pd.read_excel(file_content)
        elif file_ext == 'csv':
            df = pd.read_csv(io.BytesIO(file_content))
        elif file_ext == 'tsv':
            df = pd.read_csv(io.BytesIO(file_content), sep='\t')
        else:
            raise Exception(f"不支持的文件格式: {file_ext}")
        
        
        # 生成預覽數據
        columns = []
        for col_name in df.columns:
            col_data = df[col_name]
            
            # 獲取樣本值（非空的前5個值）
            sample_values = []
            for val in col_data.dropna():
                if len(sample_values) < 5:
                    sample_values.append(str(val))
                else:
                    break
            
            # 確定數據類型
            data_type = "text"
            if col_data.dtype in ['int64', 'float64']:
                data_type = "number"
            elif pd.api.types.is_datetime64_any_dtype(col_data):
                data_type = "date"
            
            columns.append(ExcelColumnInfo(
                name=col_name,
                sample_values=sample_values,
                data_type=data_type,
                non_null_count=int(col_data.notna().sum())
            ))
        
        # 獲取樣本行（前5行）
        sample_rows = []
        for idx, row in df.head(5).iterrows():
            row_dict = {}
            for col in df.columns:
                value = row[col]
                if pd.isna(value):
                    row_dict[col] = None
                else:
                    row_dict[col] = str(value)
            sample_rows.append(row_dict)
        
        # 生成臨時文件ID並存儲文件內容和文件名
        file_id = str(uuid.uuid4())
        TEMP_FILES[file_id] = (file_content, filename)
        
        return ExcelPreviewData(
            columns=columns,
            sample_rows=sample_rows,
            total_rows=len(df),
            filename=filename
        ), file_id
        
    except Exception as e:
        raise Exception(f"讀取文件預覽時出錯: {str(e)}")

def get_default_field_mappings() -> List[Dict[str, Any]]:
    """獲取默認的欄位映射"""
    return [
        {
            "target_field": "title",
            "display_name": "論文標題",
            "is_required": True,
            "description": "論文的完整標題",
            "suggestions": ["Article Title", "Title", "Paper Title", "标题"]
        },
        {
            "target_field": "authors",
            "display_name": "作者",
            "is_required": True,
            "description": "作者列表，多個作者用分號分隔",
            "suggestions": ["Authors", "Author", "作者", "Authors Full Names"]
        },
        {
            "target_field": "abstract",
            "display_name": "摘要",
            "is_required": False,
            "description": "論文摘要",
            "suggestions": ["Abstract", "摘要", "Summary"]
        },
        {
            "target_field": "publication_year",
            "display_name": "發表年份",
            "is_required": True,
            "description": "論文發表的年份",
            "suggestions": ["Publication Year", "Year", "年份", "发表年份"]
        },
        {
            "target_field": "doi",
            "display_name": "DOI",
            "is_required": False,
            "description": "數字物件識別碼",
            "suggestions": ["DOI", "Digital Object Identifier"]
        },
        {
            "target_field": "venue",
            "display_name": "期刊/會議",
            "is_required": False,
            "description": "發表的期刊或會議名稱",
            "suggestions": ["Source Title", "Journal", "Conference", "Venue", "期刊", "会议"]
        },
        {
            "target_field": "citation_count",
            "display_name": "引用數",
            "is_required": False,
            "description": "論文被引用次數",
            "suggestions": ["Times Cited, WoS Core", "Citations", "Citation Count", "引用数"]
        },
        {
            "target_field": "keywords",
            "display_name": "關鍵字",
            "is_required": False,
            "description": "論文關鍵字，多個關鍵字用分號分隔",
            "suggestions": ["Author Keywords", "Keywords Plus", "Keywords", "关键词"]
        }
    ]

def map_excel_row_to_paper_with_config(row: pd.Series, field_mappings: List[FieldMapping], db: Session) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    """使用配置的欄位映射將Excel行映射為論文數據"""
    errors = []
    
    try:
        # 創建映射字典
        mapping_dict = {mapping.target_field: mapping.excel_column for mapping in field_mappings}
        
        # 基本字段映射
        title = clean_string(row.get(mapping_dict.get('title')))
        if not title:
            errors.append("標題為空")
            return None, errors
        
        abstract = clean_string(row.get(mapping_dict.get('abstract')))
        doi = clean_string(row.get(mapping_dict.get('doi')))
        
        # 處理發表年份
        publication_year = None
        year_column = mapping_dict.get('publication_year')
        if year_column and year_column in row and not pd.isna(row[year_column]):
            try:
                publication_year = int(row[year_column])
            except:
                publication_year = extract_year_from_date(str(row[year_column]))
        
        if not publication_year:
            errors.append("無法確定發表年份")
            return None, errors
        
        # 引用數
        citation_count = 0
        citation_column = mapping_dict.get('citation_count')
        if citation_column and citation_column in row and not pd.isna(row[citation_column]):
            try:
                citation_count = int(row[citation_column])
            except:
                citation_count = 0
        
        # 處理期刊/會議
        venue_id = None
        venue_column = mapping_dict.get('venue')
        if venue_column:
            source_title = clean_string(row.get(venue_column))
            if source_title:
                venue = get_or_create_venue(db, source_title, "journal")
                if venue:
                    venue_id = venue.id
        
        # 處理關鍵字
        keywords = []
        keywords_column = mapping_dict.get('keywords')
        if keywords_column:
            keywords_str = clean_string(row.get(keywords_column))
            if keywords_str:
                keywords = parse_keywords(keywords_str)
        
        # 處理作者
        author_ids = []
        authors_column = mapping_dict.get('authors')
        if authors_column:
            authors_str = clean_string(row.get(authors_column))
            if authors_str:
                authors = parse_authors(authors_str)
                for author_name in authors:
                    author = get_or_create_author(db, author_name)
                    if author:
                        author_ids.append(author.id)
        
        paper_data = {
            'title': title,
            'abstract': abstract,
            'publication_year': publication_year,
            'doi': doi,
            'citation_count': citation_count,
            'venue_id': venue_id,
            'keywords': keywords,
            'author_ids': author_ids
        }
        
        return paper_data, errors
        
    except Exception as e:
        errors.append(f"處理行數據時出錯: {str(e)}")
        return None, errors

def import_file_with_config(config: ExcelImportConfig, db: Session) -> ExcelImportResult:
    """使用配置導入文件（支持Excel、CSV、TSV）"""
    try:
        # 從臨時存儲中獲取文件內容和文件名
        file_data = TEMP_FILES.get(config.preview_file_id)
        if not file_data:
            raise Exception("預覽文件已過期，請重新上傳")
        
        file_content, filename = file_data
        
        # 根據文件擴展名讀取不同格式的文件
        file_ext = filename.lower().split('.')[-1]
        
        if file_ext in ['xlsx', 'xls']:
            df = pd.read_excel(file_content)
        elif file_ext == 'csv':
            df = pd.read_csv(io.BytesIO(file_content))
        elif file_ext == 'tsv':
            df = pd.read_csv(io.BytesIO(file_content), sep='\t')
        else:
            raise Exception(f"不支持的文件格式: {file_ext}")
        
        total_rows = len(df)
        successful_imports = 0
        failed_imports = 0
        errors = []
        imported_papers = []
        
        for index, row in df.iterrows():
            try:
                paper_data, row_errors = map_excel_row_to_paper_with_config(row, config.field_mappings, db)
                
                if paper_data:
                    # 創建論文
                    from schemas import PaperCreate
                    paper_create = PaperCreate(**paper_data)
                    
                    # 檢查DOI是否已存在
                    if paper_data.get('doi'):
                        existing_paper = db.query(Paper).filter(Paper.doi == paper_data['doi']).first()
                        if existing_paper:
                            errors.append(f"行 {index + 1}: DOI {paper_data['doi']} 已存在")
                            failed_imports += 1
                            continue
                    
                    # 檢查標題是否已存在
                    existing_paper = db.query(Paper).filter(Paper.title == paper_data['title']).first()
                    if existing_paper:
                        errors.append(f"行 {index + 1}: 標題 '{paper_data['title'][:50]}...' 已存在")
                        failed_imports += 1
                        continue
                    
                    from crud import create_paper
                    new_paper = create_paper(db, paper_create)
                    imported_papers.append(new_paper)
                    successful_imports += 1
                    
                else:
                    failed_imports += 1
                    for error in row_errors:
                        errors.append(f"行 {index + 1}: {error}")
                        
            except Exception as e:
                failed_imports += 1
                errors.append(f"行 {index + 1}: {str(e)}")
        
        # 清理臨時文件
        if config.preview_file_id in TEMP_FILES:
            del TEMP_FILES[config.preview_file_id]
        
        return ExcelImportResult(
            total_rows=total_rows,
            successful_imports=successful_imports,
            failed_imports=failed_imports,
            errors=errors,
            imported_papers=imported_papers
        )
        
    except Exception as e:
        return ExcelImportResult(
            total_rows=0,
            successful_imports=0,
            failed_imports=0,
            errors=[f"導入Excel文件時出錯: {str(e)}"],
            imported_papers=[]
        )

def clean_string(value: Any) -> Optional[str]:
    """清理字符串，處理NaN和空值"""
    if pd.isna(value) or value == '' or str(value).strip() == '':
        return None
    return str(value).strip()

def parse_authors(authors_str: str) -> List[str]:
    """解析作者字符串，Web of Science格式通常是 'Author1, A; Author2, B; Author3, C'"""
    if not authors_str:
        return []
    
    # 分割作者，使用分號
    authors = []
    for author in authors_str.split(';'):
        author = author.strip()
        if author:
            authors.append(author)
    
    return authors

def parse_keywords(keywords_str: str) -> List[str]:
    """解析關鍵字，通常用分號分隔"""
    if not keywords_str:
        return []
    
    keywords = []
    for keyword in keywords_str.split(';'):
        keyword = keyword.strip()
        if keyword:
            keywords.append(keyword)
    
    return keywords

def extract_year_from_date(date_str: str) -> Optional[int]:
    """從日期字符串中提取年份"""
    if not date_str:
        return None
    
    # 嘗試提取年份的正則表達式
    year_match = re.search(r'\b(\d{4})\b', str(date_str))
    if year_match:
        return int(year_match.group(1))
    
    return None

def get_or_create_author(db: Session, author_name: str) -> Optional[Author]:
    """獲取或創建作者"""
    try:
        # 先嘗試按名稱查找
        author = db.query(Author).filter(Author.name == author_name).first()
        if author:
            return author
        
        # 如果不存在，創建新作者
        from schemas import AuthorCreate
        author_data = AuthorCreate(name=author_name)
        return create_author(db, author_data)
    except Exception as e:
        print(f"創建或獲取作者 {author_name} 時出錯: {e}")
        return None

def get_or_create_venue(db: Session, venue_name: str, venue_type: str = "journal") -> Optional[Venue]:
    """獲取或創建期刊/會議"""
    try:
        # 先嘗試按名稱查找
        venue = db.query(Venue).filter(Venue.name == venue_name).first()
        if venue:
            return venue
        
        # 如果不存在，創建新期刊/會議
        from schemas import VenueCreate
        venue_data = VenueCreate(name=venue_name, type=venue_type)
        return create_venue(db, venue_data)
    except Exception as e:
        print(f"創建或獲取期刊/會議 {venue_name} 時出錯: {e}")
        return None

def map_excel_row_to_paper(row: pd.Series, db: Session) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    """將Excel行映射為論文數據"""
    errors = []
    
    try:
        # 基本字段映射
        title = clean_string(row.get('Article Title'))
        if not title:
            errors.append("標題為空")
            return None, errors
        
        abstract = clean_string(row.get('Abstract'))
        doi = clean_string(row.get('DOI'))
        
        # 處理發表年份
        publication_year = None
        if 'Publication Year' in row and not pd.isna(row['Publication Year']):
            publication_year = int(row['Publication Year'])
        elif 'Publication Date' in row:
            publication_year = extract_year_from_date(str(row['Publication Date']))
        
        if not publication_year:
            errors.append("無法確定發表年份")
            return None, errors
        
        # 引用數
        citation_count = 0
        if 'Times Cited, WoS Core' in row and not pd.isna(row['Times Cited, WoS Core']):
            try:
                citation_count = int(row['Times Cited, WoS Core'])
            except:
                citation_count = 0
        
        # 處理期刊/會議
        venue_id = None
        source_title = clean_string(row.get('Source Title'))
        if source_title:
            # 根據Publication Type判斷類型
            venue_type = "journal"
            if 'Publication Type' in row:
                pub_type = clean_string(row['Publication Type'])
                if pub_type and pub_type.upper() in ['P', 'PROCEEDINGS']:
                    venue_type = "conference"
            
            venue = get_or_create_venue(db, source_title, venue_type)
            if venue:
                venue_id = venue.id
        
        # 處理關鍵字
        keywords = []
        if 'Author Keywords' in row:
            author_keywords = parse_keywords(clean_string(row['Author Keywords']) or "")
            keywords.extend(author_keywords)
        
        if 'Keywords Plus' in row:
            keywords_plus = parse_keywords(clean_string(row['Keywords Plus']) or "")
            keywords.extend(keywords_plus)
        
        # 去重
        keywords = list(set(keywords))
        
        # 處理作者
        author_ids = []
        if 'Authors' in row:
            authors_str = clean_string(row['Authors'])
            if authors_str:
                authors = parse_authors(authors_str)
                for author_name in authors:
                    author = get_or_create_author(db, author_name)
                    if author:
                        author_ids.append(author.id)
        
        paper_data = {
            'title': title,
            'abstract': abstract,
            'publication_year': publication_year,
            'doi': doi,
            'citation_count': citation_count,
            'venue_id': venue_id,
            'keywords': keywords,
            'author_ids': author_ids
        }
        
        return paper_data, errors
        
    except Exception as e:
        errors.append(f"處理行數據時出錯: {str(e)}")
        return None, errors

def import_file(db: Session, file_content: bytes, filename: str) -> ExcelImportResult:
    """導入文件（支持Excel、CSV、TSV）"""
    try:
        # 根據文件擴展名讀取不同格式的文件
        file_ext = filename.lower().split('.')[-1]
        
        if file_ext in ['xlsx', 'xls']:
            df = pd.read_excel(file_content)
        elif file_ext == 'csv':
            df = pd.read_csv(io.BytesIO(file_content))
        elif file_ext == 'tsv':
            df = pd.read_csv(io.BytesIO(file_content), sep='\t')
        else:
            raise Exception(f"不支持的文件格式: {file_ext}")
        
        total_rows = len(df)
        successful_imports = 0
        failed_imports = 0
        errors = []
        imported_papers = []
        
        for index, row in df.iterrows():
            try:
                paper_data, row_errors = map_excel_row_to_paper(row, db)
                
                if paper_data:
                    # 創建論文
                    from schemas import PaperCreate
                    paper_create = PaperCreate(**paper_data)
                    
                    # 檢查DOI是否已存在
                    if paper_data.get('doi'):
                        existing_paper = db.query(Paper).filter(Paper.doi == paper_data['doi']).first()
                        if existing_paper:
                            errors.append(f"行 {index + 1}: DOI {paper_data['doi']} 已存在")
                            failed_imports += 1
                            continue
                    
                    # 檢查標題是否已存在
                    existing_paper = db.query(Paper).filter(Paper.title == paper_data['title']).first()
                    if existing_paper:
                        errors.append(f"行 {index + 1}: 標題 '{paper_data['title'][:50]}...' 已存在")
                        failed_imports += 1
                        continue
                    
                    from crud import create_paper
                    new_paper = create_paper(db, paper_create)
                    imported_papers.append(new_paper)
                    successful_imports += 1
                    
                else:
                    failed_imports += 1
                    for error in row_errors:
                        errors.append(f"行 {index + 1}: {error}")
                        
            except Exception as e:
                failed_imports += 1
                errors.append(f"行 {index + 1}: {str(e)}")
        
        return ExcelImportResult(
            total_rows=total_rows,
            successful_imports=successful_imports,
            failed_imports=failed_imports,
            errors=errors,
            imported_papers=imported_papers
        )
        
    except Exception as e:
        return ExcelImportResult(
            total_rows=0,
            successful_imports=0,
            failed_imports=0,
            errors=[f"讀取文件時出錯: {str(e)}"],
            imported_papers=[]
        )

def import_excel_file(db: Session, file_content: bytes) -> ExcelImportResult:
    """導入Excel文件（兼容性函數）"""
    try:
        # 讀取Excel文件
        df = pd.read_excel(file_content)
        
        total_rows = len(df)
        successful_imports = 0
        failed_imports = 0
        errors = []
        imported_papers = []
        
        for index, row in df.iterrows():
            try:
                paper_data, row_errors = map_excel_row_to_paper(row, db)
                
                if paper_data:
                    # 創建論文
                    from schemas import PaperCreate
                    paper_create = PaperCreate(**paper_data)
                    
                    # 檢查DOI是否已存在
                    if paper_data.get('doi'):
                        existing_paper = db.query(Paper).filter(Paper.doi == paper_data['doi']).first()
                        if existing_paper:
                            errors.append(f"行 {index + 1}: DOI {paper_data['doi']} 已存在")
                            failed_imports += 1
                            continue
                    
                    # 檢查標題是否已存在
                    existing_paper = db.query(Paper).filter(Paper.title == paper_data['title']).first()
                    if existing_paper:
                        errors.append(f"行 {index + 1}: 標題 '{paper_data['title'][:50]}...' 已存在")
                        failed_imports += 1
                        continue
                    
                    from crud import create_paper
                    new_paper = create_paper(db, paper_create)
                    imported_papers.append(new_paper)
                    successful_imports += 1
                    
                else:
                    failed_imports += 1
                    for error in row_errors:
                        errors.append(f"行 {index + 1}: {error}")
                        
            except Exception as e:
                failed_imports += 1
                errors.append(f"行 {index + 1}: {str(e)}")
        
        return ExcelImportResult(
            total_rows=total_rows,
            successful_imports=successful_imports,
            failed_imports=failed_imports,
            errors=errors,
            imported_papers=imported_papers
        )
        
    except Exception as e:
        return ExcelImportResult(
            total_rows=0,
            successful_imports=0,
            failed_imports=0,
            errors=[f"讀取Excel文件時出錯: {str(e)}"],
            imported_papers=[]
        ) 
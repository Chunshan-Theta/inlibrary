import io
import re
from typing import Optional, List, Dict, Any
from pypdf import PdfReader
from schemas import PDFInfoResponse

# 常量
MAX_SNIPPET_LENGTH = 3000 # 增加提取長度以抓取更多頭部信息
# 正則表達式：用於尋找 DOI 碼
DOI_REGEX = re.compile(r'(10\.\d{4,9}\/[^\s"\'<>]*)', re.IGNORECASE) 
# 正則表達式：用於尋找四位年份
YEAR_REGEX = re.compile(r'(?:19|20)\d{2}') 
# 正則表達式：用於尋找 Keywords 標籤
KEYWORDS_REGEX = re.compile(r'(?:Keywords|關鍵詞):\s*(.*?)(?=\n\s*\d\.|\n\s*Introduction|\n\s*Abstract|\n\s*I\.)', re.IGNORECASE | re.DOTALL)
# ISBN 正則表達式 (匹配 ISBN-10 或 ISBN-13) 尋找 "ISBN" 字樣開頭，後面跟著數字、橫槓或 X
ISBN_REGEX = re.compile(r'ISBN(?:-1[03])?\s*:?\s*([0-9X-]{10,17})', re.IGNORECASE)

def extract_text_from_pdf(file_content: bytes) -> str:
    """
    使用 pypdf 從 PDF 內容中提取所有文本 (限制前 4 頁)。
    """
    try:
        reader = PdfReader(io.BytesIO(file_content))
        text = ""
        # 限制提取範圍以加快速度
        for page in reader.pages[:4]:
            text += page.extract_text() or ""
        return text
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return ""

def guess_metadata_from_text(text: str) -> Dict[str, Any]:
    """
    從提取的文本中猜測論文元數據。
    """
    data = {}
    
    # 1. 提取前 3000 字作為片段
    snippet = text[:MAX_SNIPPET_LENGTH].strip()
    data['extracted_text_snippet'] = snippet
    
    # 將文本按行分割並清理，用於精確提取
    lines = [line.strip() for line in text.split('\n') if line.strip()]

    # 2. 猜測標題 (嘗試將非空的前三行合併為潛在標題)
    lines = snippet.split('\n')
    potential_title = " ".join([line.strip() for line in lines[:2] if line.strip() and len(line.strip()) < 150])
    if potential_title:
        data['title'] = potential_title.strip()

    # 3. 猜測作者 (NEW CONSERVATIVE LOGIC: 僅提取標題後緊跟的第一行)
    data['authors'] = []

    if data.get('title'):
        # 1️⃣ 嘗試用更寬鬆匹配定位標題結束位置（忽略換行與空白差異）
        pattern = re.escape(data['title']).replace(r'\ ', r'\s+')
        match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
        
        if match:
            title_end_index = match.end()
            remaining_text = text[title_end_index:].strip()
            
            # 2️⃣ 將後續文字分割成行，忽略空行與過長行（通常機構或摘要開頭）
            lines_after_title = [
                line.strip() for line in re.split(r'[\r\n]+', remaining_text)
                if line.strip() and len(line.strip()) < 200
            ]

            if lines_after_title:
                # 3️⃣ 嘗試找出「看起來像人名」的一行
                author_line = lines_after_title[0]
                
                # 若第一行包含明顯機構字樣，嘗試下一行
                if re.search(r'University|Institute|Department|College|School|Lab|Center', author_line, re.IGNORECASE):
                    if len(lines_after_title) > 1:
                        author_line = lines_after_title[1]
                
                # 4️⃣ 移除上標、Email、數字、符號等雜訊
                cleaned = re.sub(r'(\*|†|‡|\d+|[\(\)\[\]\{\}]|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})', '', author_line)
                cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip()

                # 5️⃣ 用常見分隔符號（逗號、分號、and、&）分割作者
                candidates = re.split(r'[;,]| and | & ', cleaned)
                authors = [a.strip() for a in candidates if 2 < len(a.strip()) < 80]

                # 6️⃣ 過濾掉像 “Department of …” 這類非人名的內容
                authors = [a for a in authors if not re.search(r'(University|Department|Institute|College|School)', a, re.IGNORECASE)]

                if authors:
                    data['authors'] = authors[:5]
                else:
                    data['authors'] = [cleaned]
    
    # 4. 猜測 DOI
    doi_match = DOI_REGEX.search(snippet)
    if doi_match:
        data['doi'] = doi_match.group(1).strip()
    
    # 5. 猜測 ISBN
    # 優先權：如果沒有 DOI，或者明確抓到了 ISBN
    isbn_match = ISBN_REGEX.search(snippet)
    if isbn_match:
        # 清理 ISBN 字串中的雜訊 (只留數字和X)
        raw_isbn = isbn_match.group(1).strip()
        data['isbn'] = raw_isbn

    # 6. 猜測發表年份 (尋找前 800 字內的四位年份)
    year_match = YEAR_REGEX.findall(snippet[:800])
    if year_match:
        data['publication_year'] = max(map(int, year_match))

    # 7. 猜測摘要 (尋找 'Abstract' 或 '摘要' 後的文本)
    abstract_match = re.search(r'(abstract|摘要)\s*[\n\r]+(.*?)(?=\n\s*\d\.|\n\s*Introduction|\n\s*Keywords|\n\s*I\.)', text, re.IGNORECASE | re.DOTALL)
    if abstract_match:
        abstract_text = abstract_match.group(2).strip()
        data['abstract'] = abstract_text[:2000]

    # 8. 猜測關鍵字 (搜索 Abstract 之後的 'Keywords')
    data['keywords'] = []
    abstract_end_index = text.find(data.get('abstract', '')) + len(data.get('abstract', ''))
    
    keywords_match = KEYWORDS_REGEX.search(text[abstract_end_index:])
    if keywords_match:
        keywords_str = keywords_match.group(1).strip()
        # 清理並用逗號/分號分割關鍵字
        keywords_list = [k.strip() for k in re.split(r'[;,]', keywords_str) if k.strip()]
        data['keywords'] = keywords_list[:10]
        
    # 9. 猜測期刊/會議
    venue_match = re.search(r'(?:Journal|Conference|Proceedings of the|IEEE|ACM|Nature|Science|Educational|Education|Technologies)[\s\w]+', snippet, re.IGNORECASE)
    if venue_match:
        data['venue'] = venue_match.group(0).strip()
    
    return data

async def parse_pdf_for_metadata(file_content: bytes) -> PDFInfoResponse:
    """
    主解析入口點
    """
    # 1. 提取文本
    full_text = extract_text_from_pdf(file_content)
    
    # 2. 猜測元數據
    metadata = guess_metadata_from_text(full_text)
    
    # 3. 創建並返回 Pydantic 響應模型
    return PDFInfoResponse(**metadata)
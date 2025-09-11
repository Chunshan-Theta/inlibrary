from minio import Minio
from minio.error import S3Error
from fastapi import HTTPException, UploadFile
from fastapi.responses import StreamingResponse
import os
import io
from typing import BinaryIO

# MinIO 配置
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
BUCKET_NAME = "research-papers"

# 創建 MinIO 客戶端
minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False  # 在生產環境中應該設為 True
)

def ensure_bucket_exists():
    """確保存儲桶存在"""
    try:
        if not minio_client.bucket_exists(BUCKET_NAME):
            minio_client.make_bucket(BUCKET_NAME)
            print(f"Bucket '{BUCKET_NAME}' created successfully")
    except S3Error as e:
        print(f"Error creating bucket: {e}")

# 在模組加載時確保存儲桶存在
ensure_bucket_exists()

async def upload_file(file: UploadFile, file_path: str) -> str:
    """上傳文件到 MinIO"""
    try:
        # 讀取文件內容
        content = await file.read()
        content_length = len(content)
        
        # 創建文件流
        file_stream = io.BytesIO(content)
        
        # 上傳到 MinIO
        minio_client.put_object(
            bucket_name=BUCKET_NAME,
            object_name=file_path,
            data=file_stream,
            length=content_length,
            content_type=file.content_type or 'application/pdf'
        )
        
        # 返回文件 URL
        file_url = f"http://{MINIO_ENDPOINT}/{BUCKET_NAME}/{file_path}"
        return file_url
        
    except S3Error as e:
        raise HTTPException(status_code=500, detail=f"MinIO error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")

async def download_file(file_path: str) -> StreamingResponse:
    """從 MinIO 下載文件"""
    try:
        # 獲取文件對象
        response = minio_client.get_object(BUCKET_NAME, file_path)
        
        # 創建流式響應
        def iterfile():
            try:
                while True:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    yield chunk
            finally:
                response.close()
                response.release_conn()
        
        # 獲取文件名
        filename = file_path.split('/')[-1]
        
        return StreamingResponse(
            iterfile(),
            media_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )
        
    except S3Error as e:
        if e.code == 'NoSuchKey':
            raise HTTPException(status_code=404, detail="文件不存在")
        raise HTTPException(status_code=500, detail=f"MinIO error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download error: {str(e)}")

def delete_file(file_path: str) -> bool:
    """從 MinIO 刪除文件"""
    try:
        minio_client.remove_object(BUCKET_NAME, file_path)
        return True
    except S3Error as e:
        if e.code == 'NoSuchKey':
            return True  # 文件不存在，視為刪除成功
        print(f"Error deleting file: {e}")
        return False
    except Exception as e:
        print(f"Error deleting file: {e}")
        return False

def get_file_url(file_path: str, expires_in_seconds: int = 3600) -> str:
    """獲取文件的預簽名 URL"""
    try:
        url = minio_client.presigned_get_object(
            BUCKET_NAME,
            file_path,
            expires=expires_in_seconds
        )
        return url
    except S3Error as e:
        raise HTTPException(status_code=500, detail=f"MinIO error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"URL generation error: {str(e)}") 
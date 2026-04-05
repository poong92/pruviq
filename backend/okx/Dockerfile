FROM python:3.12-slim

WORKDIR /app

# 의존성
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스
COPY . .

# 포트
EXPOSE 8090

# 실행
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "1"]

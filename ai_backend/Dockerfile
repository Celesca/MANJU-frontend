FROM python:3.11-slim

WORKDIR /app

# Install system deps for some packages (faiss may require extra libs when installed via pip)
RUN apt-get update && apt-get install -y build-essential git wget ca-certificates libsndfile1 && rm -rf /var/lib/apt/lists/*

# Copy requirements if present (build context is ./ai_backend in docker-compose)
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt || true

# Copy the app
COPY . .

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

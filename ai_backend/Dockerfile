FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if any are needed for python packages (like build-essential)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install local Typhoon ASR runtime dependencies in the image.
# Use CPU torch wheels to avoid pulling large CUDA packages.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch && \
    pip install --no-cache-dir "nemo_toolkit[asr]" librosa soundfile

COPY . .

CMD ["python", "main.py"]

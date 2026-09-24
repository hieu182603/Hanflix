FROM python:3.11-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
ENV TORCH_HOME=/opt/torch
ENV OMP_NUM_THREADS=2
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')"
COPY src ./src
RUN useradd --create-home media && chmod -R a+rX /opt/torch /app
USER media

ENTRYPOINT ["python", "-m", "src.main"]

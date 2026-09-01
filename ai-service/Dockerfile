# Python 3.11 as specified. Local development on 3.10 works too - nothing here
# uses a 3.11-only feature - but this is the version the service is built for.
FROM python:3.11-slim

# libgl and libglib are what OpenCV links against even in the headless build.
# ffmpeg gives the capture backend its RTSP demuxer.
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Requirements first so a code change does not re-download torch.
COPY requirements.txt requirements-ocr.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Model weights are NOT baked in. ultralytics fetches yolov8n.pt on first use
# into this directory, which compose mounts as a volume so a container restart
# does not re-download it. A plate detector is supplied by the operator through
# PLATE_MODEL_PATH; there is no default, because plate reading stays off rather
# than guessing.
ENV YOLO_CONFIG_DIR=/models \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
RUN mkdir -p /models /snapshots

COPY . .

EXPOSE 8100

# /health returns 503 until a detection could actually be produced, so this
# healthcheck reports the service as unhealthy while it cannot do its job -
# which is the point.
HEALTHCHECK --interval=20s --timeout=5s --start-period=90s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8100/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]

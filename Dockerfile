# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# 1. Frontend: build statico con Vite
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS frontend

WORKDIR /build/frontend

# Le dipendenze cambiano raramente: layer separato per sfruttare la cache.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# 2. Backend: dipendenze Python in una virtualenv
# ---------------------------------------------------------------------------
FROM python:3.13-slim AS backend

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /uvx /bin/

WORKDIR /app/backend

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/app ./app

# ---------------------------------------------------------------------------
# 3. Runtime: solo Python, virtualenv, backend e frontend compilato
# ---------------------------------------------------------------------------
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/backend/.venv/bin:$PATH" \
    TZ=Europe/Rome

# tzdata serve perché l'app usa date locali (mese corrente, ricorrenze).
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --create-home --home-dir /home/app app

WORKDIR /app/backend

COPY --from=backend /app/backend/.venv /app/backend/.venv
COPY --from=backend /app/backend/app /app/backend/app
COPY --from=frontend /build/frontend/dist /app/frontend/dist

# La cartella dati deve essere scrivibile dall'utente non-root.
# Con un volume nominato Docker ne eredita i permessi al primo avvio.
RUN mkdir -p /app/backend/data \
    && chown -R app:app /app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]

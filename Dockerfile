# syntax=docker/dockerfile:1

FROM node:20-alpine AS webbuild
WORKDIR /app
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci
COPY web ./web
RUN cd web && npm run build
RUN mkdir -p /app/portal && cp -r /app/web/dist/* /app/portal/

FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY BinanceBot ./BinanceBot
COPY --from=webbuild /app/portal ./portal

EXPOSE 8502

# Em container, normalmente usamos --host 0.0.0.0 e limitamos a exposiÃ§Ã£o via mapeamento de porta (127.0.0.1:...).
CMD ["python","-m","uvicorn","BinanceBot.portal_api:app","--host","0.0.0.0","--port","8502"]


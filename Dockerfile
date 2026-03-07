# syntax=docker/dockerfile:1

FROM node:20-alpine AS webbuild
WORKDIR /app
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci
COPY web ./web
RUN cd web && npm run build
# O build do Vite estÃ¡ configurado para gerar em /app/portal (web/vite.config.js outDir="../portal").
# Mantemos fallback para /app/web/dist caso a config mude no futuro.
RUN if [ -f /app/portal/index.html ]; then echo "portal OK"; \
    elif [ -d /app/web/dist ]; then mkdir -p /app/portal && cp -r /app/web/dist/* /app/portal/; \
    else echo "ERRO: build do portal nÃ£o encontrado."; ls -la /app; ls -la /app/web; exit 1; fi

FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY BinanceBot ./BinanceBot
COPY --from=webbuild /app/portal ./portal

EXPOSE 8502

# Em container, normalmente usamos --host 0.0.0.0 e limitamos a exposição via mapeamento de porta (127.0.0.1:...).
CMD ["python","-m","uvicorn","BinanceBot.portal_api:app","--host","0.0.0.0","--port","8502"]

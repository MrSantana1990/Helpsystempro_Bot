FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --include=optional && npm install --no-save @rollup/rollup-linux-x64-gnu@$(node -p "require('./node_modules/rollup/package.json').version")
COPY . .
ARG VITE_API_BASE=http://localhost:8802
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

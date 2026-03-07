FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
EXPOSE 8802
CMD ["node","dist/index.js"]

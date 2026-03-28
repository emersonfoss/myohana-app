FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/migrations/ ./migrations/
COPY --from=builder /app/package.json ./package.json
RUN mkdir -p /app/data/uploads
EXPOSE 5000
CMD ["node", "dist/index.cjs"]

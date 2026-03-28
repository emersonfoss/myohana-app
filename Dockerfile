FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm install
RUN npm run build
RUN mkdir -p /app/data/uploads
EXPOSE 5000
CMD ["node", "dist/index.cjs"]

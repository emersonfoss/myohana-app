# Clone source from GitHub to avoid railway up upload issues
FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch master https://github.com/emersonfoss/myohana-app.git .
RUN npm install
RUN npm run build
RUN mkdir -p /app/data/uploads /app/data/vault-uploads
RUN mkdir -p /app/build/Release && cp /app/node_modules/better-sqlite3/build/Release/better_sqlite3.node /app/build/Release/
EXPOSE 5000
CMD ["node", "dist/index.cjs"]

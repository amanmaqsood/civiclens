# CivicLens — Cloud Run container (Vite frontend + Express server)
FROM node:20-slim
WORKDIR /app
# install ALL deps (vite/esbuild needed to build); NODE_ENV not set yet so devDeps install
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
# runtime: production mode so the server serves the built dist/
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server.cjs"]

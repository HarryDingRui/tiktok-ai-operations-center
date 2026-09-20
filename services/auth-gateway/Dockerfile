FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src

USER node

EXPOSE 8789

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8789/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]

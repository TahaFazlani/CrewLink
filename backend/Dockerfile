FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .gyp python3 make g++ && \
    npm ci && \
    apk del .gyp

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]

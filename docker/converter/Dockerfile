FROM node:20-slim

RUN npm install -g opencascade-tools@0.0.9

# Some conversions can be memory-hungry; give Node a bit more headroom in small containers.
ENV NODE_OPTIONS="--max-old-space-size=3072"

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY server.js ./server.js

EXPOSE 7070
CMD ["node", "server.js"]

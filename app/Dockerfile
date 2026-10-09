# Production-ready Node.js 24 Alpine image
FROM node:24.21.0-alpine

# Thiet lap moi truong production mac dinh
ENV NODE_ENV=production

# Thu muc lam viec
WORKDIR /app

# Sao chep file quan ly dependencies truoc de toi uu Docker cache layer
COPY package.json package-lock.json ./

# Cai dat chi cac production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Sao chep toan bo ma nguon ung dung (loai tru boi .dockerignore)
COPY --chown=node:node . .

# Chuyen sang user 'node' khong co quyen root de tang cuong bao mat
USER node

# Port ung dung lang nghe
EXPOSE 3000

# Lenh khoi dong ung dung
CMD ["node", "src/server.js"]

FROM node:18-alpine

WORKDIR /app

# 複製 package.json
COPY package.json ./

# 安裝依賴
RUN npm install --omit=dev

# 複製應用代碼
COPY . .

# 構建應用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 啟動應用
CMD ["npm", "start"] 
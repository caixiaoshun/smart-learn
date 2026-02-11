FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install

# 复制源代码
COPY . .

# 生成Prisma客户端
RUN npx prisma generate

# 推送数据库结构
RUN npx prisma db push

# 编译TypeScript
RUN npm run build

# 暴露端口
EXPOSE 3001

# 启动服务
CMD ["npm", "start"]

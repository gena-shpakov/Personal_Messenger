FROM node:18
WORKDIR /app
COPY package*.json ./
COPY .env .env
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]

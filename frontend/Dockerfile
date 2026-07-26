FROM node:20-alpine

WORKDIR /app

# Install libc6-compat for Next.js SWC binary (makes compilation 10x faster)
RUN apk add --no-cache libc6-compat

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the frontend files
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files - each build gets fresh code
COPY . .

# Set Vite environment variables during build
ARG VITE_API_URL
ARG VITE_MANJU_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MANJU_API_KEY=$VITE_MANJU_API_KEY

# Build the application
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

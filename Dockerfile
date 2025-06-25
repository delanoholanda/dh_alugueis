# 1. Base Image: Use an official Node.js runtime as a parent image.
# We choose 'alpine' for a smaller image size, which is great for production.
FROM node:20-alpine

# 2. Set Working Directory: Define the working directory inside the container.
WORKDIR /app

# 3. Copy package files and install dependencies.
# This is done in a separate step to leverage Docker's layer caching.
# If package*.json doesn't change, Docker will use the cached layer instead of reinstalling every time.
COPY package*.json ./
RUN npm install

# 4. Copy Application Code: Copy the rest of the application's source code.
# The .dockerignore file will prevent unnecessary files from being copied.
COPY . .

# 5. Build the application for production.
RUN npm run build

# 6. Expose Port: Inform Docker that the container listens on port 3000.
EXPOSE 3000

# 7. Start Command: Define the command to run the application when the container starts.
CMD ["npm", "start"]

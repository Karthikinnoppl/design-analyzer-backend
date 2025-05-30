FROM node:18-slim

# Install system dependencies for Chromium
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libdrm2 \
  libxshmfence1 \
  libgbm1 \
  libegl1 \
  wget \
  unzip \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install Chromium manually
RUN mkdir -p /usr/src/chromium && \
  cd /usr/src/chromium && \
  wget https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1069273/chrome-linux.zip && \
  unzip chrome-linux.zip && \
  mv chrome-linux /opt/chromium && \
  ln -s /opt/chromium/chrome /usr/bin/chromium-browser

# Set environment variables
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

# App setup
WORKDIR /app
COPY . .
RUN npm install

# Start your Express server
CMD ["node", "index.js"]
FROM public.ecr.aws/lambda/nodejs:18

# Install required libraries for Chromium
RUN yum install -y \
  atk \
  cups-libs \
  gtk3 \
  libXcomposite \
  libXcursor \
  libXdamage \
  libXext \
  libXi \
  libXrandr \
  libXScrnSaver \
  libXtst \
  pango \
  alsa-lib \
  xorg-x11-fonts-Type1 \
  xorg-x11-fonts-misc \
  ipa-gothic-fonts \
  wget \
  unzip \
  nss

# Install Chromium
RUN mkdir -p /usr/src/chromium && \
  cd /usr/src/chromium && \
  wget https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1069273/chrome-linux.zip && \
  unzip chrome-linux.zip && \
  mv chrome-linux /opt/chromium && \
  ln -s /opt/chromium/chrome /usr/bin/chromium-browser

# Set environment variable to use Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy app files
COPY . .

# Install dependencies
RUN npm install

CMD ["node", "index.js"]

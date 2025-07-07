# Use your bun version
FROM oven/bun:1.2.13

# Install python and pip
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv

# Create a virtual environment
RUN python3 -m venv /venv

# Activate venv and install youtube-transcript-api
RUN /venv/bin/pip install youtube-transcript-api

# set working directory
WORKDIR /app

# Copy project files
COPY . .

# install bun deps
RUN bun install

# no EXPOSE needed
# but set venv path so python in your scripts uses it
ENV PATH="/venv/bin:$PATH"

# run worker
CMD ["bun", "src/index.ts"]
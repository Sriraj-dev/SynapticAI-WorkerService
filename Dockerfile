# Use your exact Bun version
FROM oven/bun:1.2.13

# install python3 + pip
RUN apt-get update && apt-get install -y python3 python3-pip

# install python dependencies
RUN pip install youtube-transcript-api

# set working directory
WORKDIR /app

# copy your Bun project
COPY . .

# install Bun dependencies
RUN bun install

# no EXPOSE needed (this is a worker, no HTTP server)

# run your worker entrypoint
CMD ["bun", "src/index.ts"]
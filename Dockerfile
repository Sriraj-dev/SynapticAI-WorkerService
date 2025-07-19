# use your exact Bun version
FROM oven/bun:1.2.13

# working directory
WORKDIR /app

# copy the project
COPY . .

# install bun dependencies
RUN bun install

# no EXPOSE since this is a worker
# no python needed anymore

# run your worker
CMD ["bun", "src/index.ts"]
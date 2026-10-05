# docker build -t monster-lab .
# docker run -d -p 3000:3000 -v monster-lab-data:/data monster-lab   (teacher link: docker logs <id>)
FROM node:22-alpine

# tini reaps the git processes the server spawns and passes Ctrl-C/SIGTERM on to Node.
RUN apk add --no-cache git tini

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server server
COPY public public

# The session (repos + session.json + admin.key) lives in /data. Mount a volume there to keep it.
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
RUN mkdir /data && chown node:node /data
VOLUME /data
USER node

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]

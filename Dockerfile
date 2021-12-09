FROM node:14

WORKDIR /app/

COPY . /app/

RUN npm ci

ENTRYPOINT [ "npm", "run", "test" ]
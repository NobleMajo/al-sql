#!/bin/sh

cd ..

docker rm -f nodejs-test 2> /dev/null

docker create -it --rm \
    --network postgres_net \
    -e POSTGRES_HOST="postgres-test" \
    -e POSTGRES_PORT="5432" \
    -e POSTGRES_USER="admin" \
    -e POSTGRES_PASSWORD="adminPw" \
    -e POSTGRES_DB="adminDb" \
    --name nodejs-test \
    -w /app \
    node:14 \
        npm run testi

docker cp . nodejs-test:/app

docker start -i nodejs-test

docker rm -f nodejs-test 2> /dev/null
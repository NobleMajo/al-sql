#!/bin/bash

cd ..

docker rm -f postgres-test 2> /dev/null

docker network create postgres_net 2> /dev/null

docker run -it --rm \
    --network postgres_net \
    --name postgres-test \
    -e POSTGRES_USER="test" \
    -e POSTGRES_PASSWORD="test" \
    -e POSTGRES_DB="test" \
    -p 127.0.0.1:5432:5432/tcp \
    -p 127.0.0.1:5432:5432/udp \
    postgres:14
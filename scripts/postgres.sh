#!/bin/bash

cd ..

docker network create postgres_net 
echo "" 2> /dev/null

docker run -it --rm \
    --network postgres_net \
    --name postgres-test \
    -e POSTGRES_USER="admin" \
    -e POSTGRES_PASSWORD="adminPw" \
    -e POSTGRES_DB="adminDb" \
    -p 5432:5432/tcp \
    -p 5432:5432/udp \
    postgres:14
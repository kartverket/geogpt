#!/bin/bash

# Define variables
IMAGE_NAME="pgvector/pgvector:pg16"
CONTAINER_NAME="pgvector_container"

# Pull the latest version of the image
docker pull $IMAGE_NAME

# Check if the container is running and stop it if it is
if docker ps -q -f name=^/${CONTAINER_NAME}$; then
    echo "Stopping running container ${CONTAINER_NAME}..."
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
elif docker ps -aq -f name=^/${CONTAINER_NAME}$; then
    echo "Removing stopped container ${CONTAINER_NAME}..."
    docker rm $CONTAINER_NAME
fi

# Run the Docker container with the latest image
echo "Starting the container with the latest image..."
docker run -d --name $CONTAINER_NAME \
  -e POSTGRES_USER=asd \
  -e POSTGRES_PASSWORD=asd \
  -p 5432:5432 $IMAGE_NAME

echo "pgvector PostgreSQL container is running with the latest image."


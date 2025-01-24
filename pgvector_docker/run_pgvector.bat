@echo off

SET CONTAINER_NAME=pgvector_container
SET IMAGE_NAME=pgvector/pgvector:pg16

REM Check if the container is running and stop it if it is
FOR /f "tokens=*" %%i IN ('docker ps -q -f "name=^%CONTAINER_NAME%$"') DO (
    ECHO Stopping running container %CONTAINER_NAME%...
    docker stop %CONTAINER_NAME%
    docker rm %CONTAINER_NAME%
)

REM Check if the container exists and is stopped, then remove it
FOR /f "tokens=*" %%i IN ('docker ps -aq -f "name=^%CONTAINER_NAME%$"') DO (
    ECHO Removing stopped container %CONTAINER_NAME%...
    docker rm %CONTAINER_NAME%
)

REM Pull the latest version of the image
docker pull %IMAGE_NAME%

REM Run the Docker container with the latest image
ECHO Starting the container with the latest image...
docker run -d --name %CONTAINER_NAME% ^
  -e POSTGRES_USER=asd ^
  -e POSTGRES_PASSWORD=asd ^
  -p 5432:5432 %IMAGE_NAME%

ECHO pgvector PostgreSQL container is running with the latest image.

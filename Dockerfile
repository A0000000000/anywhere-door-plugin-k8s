FROM ubuntu:latest
LABEL authors="maoyanluo"

WORKDIR /ws
ADD https://nodejs.org/dist/v22.11.0/node-v22.11.0-linux-x64.tar.xz /ws

RUN apt update
RUN apt install -y xz-utils

RUN tar -xf node-v22.11.0-linux-x64.tar.xz

ENV NODE_HOME=/ws/node-v22.11.0-linux-x64
ENV PATH=$PATH:$NODE_HOME/bin

WORKDIR /ws/code

COPY src /ws/code/src
COPY package.json /ws/code
COPY package-lock.json /ws/code

RUN npm i

EXPOSE 80

ENTRYPOINT ["npm", "start"]
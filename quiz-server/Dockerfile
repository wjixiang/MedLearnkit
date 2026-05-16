FROM rust:1.94-slim as build

WORKDIR /app

RUN rustup target add x86_64-unknown-linux-musl && \
  apt update && \
  apt install -y musl-tools musl-dev && \
  update-ca-certificates

COPY ./src ./src
COPY ./Cargo.lock .
COPY ./Cargo.toml .
COPY ./migrations ./migrations

RUN cargo build --target x86_64-unknown-linux-musl --release

FROM alpine:3.21

WORKDIR /app



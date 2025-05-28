# Project auto-tab-groups-server

This is the server for the auto-tab-groups project.

## Features

- AI-powered tab grouping functionality (using OpenAI API). See [this feature's documentation](../docs/AI-Grouping-API.md).

## Tech Stack

- [Go](https://go.dev/doc/install)
- [Gin](https://github.com/gin-gonic/gin)
- [PostgreSQL](https://www.postgresql.org/download/)
- [Docker](https://docs.docker.com/get-docker/)
- [OpenAI API](https://platform.openai.com/) - for AI-driven tab grouping

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Go](https://go.dev/doc/install)
- [Docker](https://docs.docker.com/get-docker/)

### Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and update the values

   ```bash
   cp .env.example .env
   ```

3. Set your OpenAI API key in the `.env` file:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## MakeFile

Run build make command with tests

```bash
make all
```

Build the application

```bash
make build
```

Run the application

```bash
make run
```

Create DB container

```bash
make docker-run
```

Shutdown DB Container

```bash
make docker-down
```

DB Integrations Test:

```bash
make itest
```

Live reload the application:

```bash
make watch
```

Run the test suite:

```bash
make test
```

Clean up binary from the last build:

```bash
make clean
```

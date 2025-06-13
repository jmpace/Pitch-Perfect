# Pitch Perfect

A modern Next.js application with TypeScript, Tailwind CSS, Vitest, and Playwright, fully containerized with Docker.

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **Vitest** - Unit testing framework
- **Playwright** - End-to-end testing
- **Docker** - Containerization

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)

### Development with Docker

1. **Clone and navigate to the project:**
   ```bash
   cd pitch-perfect
   ```

2. **Start the development environment:**
   ```bash
   npm run docker:dev
   # or
   docker-compose up
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Local Development (without Docker)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

## Available Scripts

### Development
- `npm run dev` - Start Next.js development server
- `npm run docker:dev` - Start development with Docker Compose

### Building
- `npm run build` - Build the application for production
- `npm run docker:build` - Build production Docker image
- `npm run docker:build:dev` - Build development Docker image

### Testing
- `npm run test` - Run unit tests with Vitest
- `npm run test:ui` - Run tests with Vitest UI
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:e2e` - Run end-to-end tests with Playwright
- `npm run test:e2e:ui` - Run Playwright tests with UI

### Production
- `npm run start` - Start production server
- `npm run docker:prod` - Start production with Docker Compose
- `npm run docker:run` - Run production Docker container

## Docker Commands

### Development
```bash
# Build development image
docker build -f Dockerfile.dev -t pitch-perfect:dev .

# Run development container
docker-compose up

# Run with rebuild
docker-compose up --build
```

### Production
```bash
# Build production image
docker build -t pitch-perfect .

# Run production container
docker run -p 3000:3000 pitch-perfect

# Use production compose
docker-compose -f docker-compose.prod.yml up
```

### Testing in Docker
```bash
# Run unit tests in container
docker-compose exec nextjs-app npm run test

# Run e2e tests in container
docker-compose exec nextjs-app npm run test:e2e
```

## Project Structure

```
pitch-perfect/
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Home page
│   │   └── globals.css      # Global styles
│   └── components/          # Reusable components
│       └── Button.tsx       # Example component
├── tests/                   # Unit tests
│   ├── setup.ts            # Test setup
│   └── Button.test.tsx     # Example test
├── e2e/                    # End-to-end tests
│   └── example.spec.ts     # Example e2e test
├── Dockerfile              # Production Dockerfile
├── Dockerfile.dev          # Development Dockerfile
├── docker-compose.yml      # Development compose
├── docker-compose.prod.yml # Production compose
├── .dockerignore          # Docker ignore file
├── next.config.js         # Next.js configuration
├── tailwind.config.js     # Tailwind configuration
├── tsconfig.json          # TypeScript configuration
├── vitest.config.ts       # Vitest configuration
└── playwright.config.ts   # Playwright configuration
```

## Configuration

### Environment Variables

Create a `.env.local` file for local environment variables:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Add your environment variables here
```

### Docker Environment

The Docker setup includes:
- Hot reload for development
- Multi-stage builds for optimized production images
- Volume mounts for efficient development
- Health checks and proper signal handling

## Testing

### Unit Tests (Vitest)
- Located in `tests/` directory
- Uses `@testing-library/react` for component testing
- Run with `npm run test`

### End-to-End Tests (Playwright)
- Located in `e2e/` directory
- Tests multiple browsers (Chrome, Firefox, Safari)
- Run with `npm run test:e2e`

## Deployment

### Production Build
```bash
# Build and run production container
npm run docker:build
npm run docker:run
```

### Docker Compose Production
```bash
# Run production setup
npm run docker:prod
```

## Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   docker-compose down
   # Or change ports in docker-compose.yml
   ```

2. **Permission issues:**
   ```bash
   sudo docker-compose up
   ```

3. **Clear Docker cache:**
   ```bash
   docker system prune -a
   ```

4. **Rebuild containers:**
   ```bash
   docker-compose up --build --force-recreate
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test && npm run test:e2e`
5. Submit a pull request

## License

This project is licensed under the MIT License.
.PHONY: install start-be start-fe load-test start-all

# Start both frontend and backend concurrently
start-all:
	@echo "Starting both backend and frontend..."
	$(MAKE) -j2 start-be start-fe

# Install dependencies for both backend and client
install:
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Installing frontend dependencies..."
	cd client && npm install

# Start the Node.js backend server
start-be:
	@echo "Starting backend server..."
	cd backend && node server.js

# Start the Vite React frontend client
start-fe:
	@echo "Starting frontend client..."
	cd client && npm run dev

# Run the backend load test script
load-test:
	@echo "Starting load test (100 concurrent simulated users)..."
	cd backend && node load-test.js

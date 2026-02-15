# 🧪 MANJU — Test Documentation

Comprehensive testing guide for the MANJU platform covering **Frontend (React/Jest)**, **Backend (Go)**, and **Load Testing (Locust)**.

---

## 📁 Test Structure

```
MANJU/
├── __tests__/                      # Frontend unit tests (Jest + React Testing Library)
│   ├── About.test.tsx
│   ├── ConsolePage.test.tsx
│   ├── CreateVoicePage.test.tsx
│   ├── DemoPage.test.tsx
│   ├── FeaturesSection.test.tsx
│   ├── Home.test.tsx
│   ├── Homepage.test.tsx
│   ├── Login.test.tsx
│   ├── ModelConfig.test.tsx
│   ├── Pricing.test.tsx
│   ├── Projects.test.tsx
│   ├── ProjectsContent.test.tsx
│   ├── SettingsPage.test.tsx
│   ├── Voice.test.tsx
│   ├── VoiceCloningPage.test.tsx
│   └── VoicesContent.test.tsx
│
├── backend/
│   ├── repository/                 # Repository layer tests
│   │   ├── testhelper_test.go
│   │   ├── user_test.go
│   │   ├── apikey_test.go
│   │   ├── project_test.go
│   │   ├── voice_test.go
│   │   └── session_test.go
│   │
│   ├── services/                   # Service layer tests
│   │   ├── testhelper_test.go
│   │   ├── crypto_test.go
│   │   ├── userService_test.go
│   │   ├── apikeyService_test.go
│   │   ├── projectService_test.go
│   │   ├── voiceService_test.go
│   │   ├── documentService_test.go
│   │   └── demoService_test.go
│   │
│   ├── controllers/                # Controller layer tests
│   │   ├── userController_test.go
│   │   ├── apikeyController_test.go
│   │   ├── projectController_test.go
│   │   ├── voiceController_test.go
│   │   ├── documentController_test.go
│   │   └── demoController_test.go
│   │
│   └── middleware/                 # Middleware tests
│       └── security_test.go
│
└── locustfile.py                   # Load / Performance tests
```

---

## 1️⃣ Frontend Tests (Jest)

**Framework:** Jest + React Testing Library  
**Location:** `__tests__/`

### Run Commands

```bash
# Run all frontend tests
npx jest

# Run with verbose output
npx jest --verbose

# Run a specific test file
npx jest __tests__/Login.test.tsx

# Run with coverage report
npx jest --coverage

# Run in watch mode (re-run on file changes)
npx jest --watch
```

### Test Coverage

| Page Component   | Test File                   |
| ---------------- | --------------------------- |
| About            | `About.test.tsx`            |
| ConsolePage      | `ConsolePage.test.tsx`      |
| CreateVoicePage  | `CreateVoicePage.test.tsx`  |
| DemoPage         | `DemoPage.test.tsx`         |
| FeaturesSection  | `FeaturesSection.test.tsx`  |
| Home             | `Home.test.tsx`             |
| Homepage         | `Homepage.test.tsx`         |
| Login            | `Login.test.tsx`            |
| ModelConfig      | `ModelConfig.test.tsx`      |
| Pricing          | `Pricing.test.tsx`          |
| Projects         | `Projects.test.tsx`         |
| ProjectsContent  | `ProjectsContent.test.tsx`  |
| SettingsPage     | `SettingsPage.test.tsx`     |
| Voice            | `Voice.test.tsx`            |
| VoiceCloningPage | `VoiceCloningPage.test.tsx` |
| VoicesContent    | `VoicesContent.test.tsx`    |

---

## 2️⃣ Backend Tests (Go)

**Framework:** Go `testing` + real PostgreSQL  
**Location:** `backend/`

### Prerequisites

PostgreSQL must be running with a test database:

```bash
# Create test database (one-time setup)
psql -U postgres -c "CREATE DATABASE manju_test;"
```

**Connection config** (used by `testhelper_test.go`):

- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: `postgres`
- Database: `manju_test`

### Run Commands

```bash
cd backend

# ─── Run ALL backend tests ───
go test ./...

# ─── Run ALL with verbose output ───
go test -v ./...

# ─── Run by layer ───
go test -v ./repository/...     # Repository tests only
go test -v ./services/...       # Service tests only
go test -v ./controllers/...    # Controller tests only
go test -v ./middleware/...     # Middleware tests only

# ─── Run a single test file ───
go test -v ./repository/ -run TestUserRepository
go test -v ./services/ -run TestCreateUser

# ─── Coverage report ───
go test -cover ./...

# ─── Generate HTML coverage report ───
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

### Test Coverage

#### Repository Layer (`backend/repository/`)

| File              | Tests                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `user_test.go`    | Create, Create (duplicate email), List, GetByID, GetByEmail, Update, Delete, BeforeCreate hook         |
| `apikey_test.go`  | Create, ListByUserID, GetByID, Delete, SetDefault, GetDefaultByUserID, BeforeCreate hook               |
| `project_test.go` | Create, GetByID, GetByUserID, ListAll, Update, Delete, DeleteByUserID, BeforeCreate/BeforeUpdate hooks |
| `voice_test.go`   | Create, List, GetByID, ListByUser, Delete, BeforeCreate hook                                           |
| `session_test.go` | Create, GetByID, DeleteByID                                                                            |

#### Service Layer (`backend/services/`)

| File                      | Tests                                                  |
| ------------------------- | ------------------------------------------------------ |
| `crypto_test.go`          | Encryption / decryption                                |
| `userService_test.go`     | CreateUser, ListUsers, GetUser, UpdateUser, DeleteUser |
| `apikeyService_test.go`   | API key CRUD operations                                |
| `projectService_test.go`  | Project CRUD operations                                |
| `voiceService_test.go`    | Voice CRUD operations                                  |
| `documentService_test.go` | Document management                                    |
| `demoService_test.go`     | Demo/workflow validation                               |

#### Controller Layer (`backend/controllers/`)

| File                         | Tests                                     |
| ---------------------------- | ----------------------------------------- |
| `userController_test.go`     | HTTP handler tests for user endpoints     |
| `apikeyController_test.go`   | HTTP handler tests for API key endpoints  |
| `projectController_test.go`  | HTTP handler tests for project endpoints  |
| `voiceController_test.go`    | HTTP handler tests for voice endpoints    |
| `documentController_test.go` | HTTP handler tests for document endpoints |
| `demoController_test.go`     | HTTP handler tests for demo endpoints     |

#### Middleware (`backend/middleware/`)

| File               | Tests                    |
| ------------------ | ------------------------ |
| `security_test.go` | API key guard middleware |

---

## 3️⃣ Load Testing (Locust)

**Framework:** Locust (Python)  
**Location:** `locustfile.py`

### Prerequisites

```bash
pip install locust
```

### Run Commands

```bash
# Start Locust web UI (then open http://localhost:8089)
locust -f locustfile.py --host http://localhost:8080

# Run headless (no UI) — 50 users, spawn 10/sec, run for 60s
locust -f locustfile.py --host http://localhost:8080 \
  --headless -u 50 -r 10 --run-time 60s

# Run only specific endpoint tags
locust -f locustfile.py --host http://localhost:8080 --tags users
locust -f locustfile.py --host http://localhost:8080 --tags projects
locust -f locustfile.py --host http://localhost:8080 --tags voices

# Export results to CSV
locust -f locustfile.py --host http://localhost:8080 \
  --headless -u 50 -r 10 --run-time 60s --csv=results
```

### Endpoints Tested

| Tag        | Method | Endpoint                    | Weight |
| ---------- | ------ | --------------------------- | ------ |
| `health`   | GET    | `/api/health`               | 2      |
| `users`    | GET    | `/api/users`                | 3      |
| `users`    | GET    | `/api/users/:id`            | 2      |
| `users`    | PUT    | `/api/users/:id`            | 1      |
| `projects` | GET    | `/api/projects`             | 3      |
| `projects` | POST   | `/api/projects`             | 2      |
| `projects` | PUT    | `/api/projects/:id`         | 1      |
| `voices`   | GET    | `/api/voices`               | 2      |
| `voices`   | GET    | `/api/voices/user/:user_id` | 1      |
| `voices`   | POST   | `/api/voices`               | 1      |
| `apikeys`  | GET    | `/api/users/:id/api-keys`   | 1      |

---

## 🚀 Quick Start — Run Everything

```bash
# 1. Frontend tests
npx jest --verbose

# 2. Backend tests (make sure PostgreSQL is running)
cd backend
go test -v ./...

# 3. Load tests (make sure backend server is running)
cd ..
locust -f locustfile.py --host http://localhost:8080
```

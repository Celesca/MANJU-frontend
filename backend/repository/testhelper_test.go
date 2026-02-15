package repository

import (
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// testDB creates a test database connection and auto-migrates all models.
// It uses PostgreSQL for testing and connects to a test database.
func testDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := "host=localhost user=postgres password=postgres dbname=manju_test port=5432 sslmode=disable"

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("Skipping DB tests: cannot connect to test database: %v", err)
	}

	// Auto-migrate test tables
	if err := db.AutoMigrate(
		&User{},
		&Voice{},
		&Project{},
		&UserAPIKey{},
		&Session{},
	); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	// Clean tables before each test
	db.Exec("DELETE FROM sessions")
	db.Exec("DELETE FROM user_api_keys")
	db.Exec("DELETE FROM voices")
	db.Exec("DELETE FROM projects")
	db.Exec("DELETE FROM users")

	return db
}

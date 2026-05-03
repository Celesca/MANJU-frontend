package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"manju/backend/repository"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var Database *gorm.DB

func Connect() {
	// New logger for detailed SQL logging
	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags), // io writer
		logger.Config{
			SlowThreshold: time.Second, // Slow SQL threshold
			LogLevel:      logger.Info, // Log level
			Colorful:      true,        // Enable color
		},
	)

	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}
	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "postgres"
	}
	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = "postgres"
	}
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "manju_dev"
	}
	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}

	sslMode := os.Getenv("SSL_MODE")
	if sslMode == "" {
		sslMode = "disable"
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s", dbHost, dbUser, dbPassword, dbName, dbPort, sslMode)

	// Retry connection logic with exponential backoff
	var err error
	maxRetries := 10
	retryDelay := time.Second

	for i := 0; i < maxRetries; i++ {
		Database, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: newLogger,
		})

		if err == nil {
			break
		}

		if i < maxRetries-1 {
			log.Printf("Database connection attempt %d/%d failed: %v. Retrying in %v...", i+1, maxRetries, err, retryDelay)
			time.Sleep(retryDelay)
			// Exponential backoff (cap at 10 seconds)
			if retryDelay < 10*time.Second {
				retryDelay = time.Duration(float64(retryDelay) * 1.5)
			}
		}
	}

	if err != nil {
		log.Fatalf("Failed to connect to database after %d attempts: %v", maxRetries, err)
	}

	// Auto-migrate core models (User, Session, Project, UserAPIKey, Voice)
	if err := Database.AutoMigrate(&repository.User{}, &repository.Session{}, &repository.Project{}, &repository.UserAPIKey{}, &repository.Voice{}); err != nil {
		log.Printf("AutoMigrate error: %v", err)
	}

	// Set the database reference for the repository package
	repository.SetDB(Database)

	fmt.Println("Database connected")
}

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

	dsn := fmt.Sprintf("host=localhost user=postgres password=postgres dbname=manju_dev port=5432 sslmode=disable")
	Database, _ = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: newLogger,
	})

	// Auto-migrate core models (User, Session, Project)
	if err := Database.AutoMigrate(&repository.User{}, &repository.Session{}, &repository.Project{}); err != nil {
		log.Printf("AutoMigrate error: %v", err)
	}

	fmt.Println("Database connected")
}

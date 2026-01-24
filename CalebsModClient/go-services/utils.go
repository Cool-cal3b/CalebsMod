package go_services

import "os"

func GetServerUrl() string {
	if IsRunningInDevMode() {
		return "http://localhost:3000"
	}
	return "https://mc.calebwash.com"
}

func IsRunningInDevMode() bool {
	return os.Getenv("CALEBS_MOD_ENV") == "dev"
}

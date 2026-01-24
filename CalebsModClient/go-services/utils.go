package go_services

import "os"

func GetServerUrl() string {
	if IsRunningInDevMode() {
		return "http://localhost:3000"
	}
	return "http://mc.calebwash.com:3000"
}

func IsRunningInDevMode() bool {
	return os.Getenv("CALEBS_MOD_ENV") == "dev"
}

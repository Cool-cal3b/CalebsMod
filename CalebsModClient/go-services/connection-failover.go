package go_services

import (
	"context"
	"net"
	"net/http"
	"time"
)

const (
	serverHost       = "mc.calebwash.com"
	backupHTTPSPort  = "9443"
	primaryGamePort  = "25565"
	backupGamePort   = "25566"
	primaryDialLimit = 3 * time.Second
)

// All existing API callers use the default transport, including the updater.
// Keep the request URL unchanged so TLS still validates mc.calebwash.com when
// the router sends the connection through the Wi-Fi forwarding rule.
func init() {
	base := http.DefaultTransport.(*http.Transport).Clone()
	base.DialContext = dialWithServerFallback
	http.DefaultTransport = base
}

func dialWithServerFallback(ctx context.Context, network, address string) (net.Conn, error) {
	if network != "tcp" || address != net.JoinHostPort(serverHost, "443") {
		return (&net.Dialer{Timeout: 30 * time.Second}).DialContext(ctx, network, address)
	}
	dialer := &net.Dialer{Timeout: primaryDialLimit}

	primaryCtx, cancel := context.WithTimeout(ctx, primaryDialLimit)
	conn, primaryErr := dialer.DialContext(primaryCtx, network, address)
	cancel()
	if primaryErr == nil {
		return conn, nil
	}

	backup := net.JoinHostPort(serverHost, backupHTTPSPort)
	conn, backupErr := dialer.DialContext(ctx, network, backup)
	if backupErr != nil {
		return nil, primaryErr
	}
	return conn, nil
}

func reachableGameAddress(host string) string {
	for _, port := range []string{primaryGamePort, backupGamePort} {
		address := net.JoinHostPort(host, port)
		conn, err := net.DialTimeout("tcp", address, primaryDialLimit)
		if err == nil {
			conn.Close()
			if port == primaryGamePort {
				return host
			}
			return address
		}
	}
	return host
}

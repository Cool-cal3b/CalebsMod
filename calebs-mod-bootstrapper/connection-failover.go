package main

import (
	"context"
	"net"
	"net/http"
	"time"
)

// Keep mc.calebwash.com in the request URL for certificate validation. Only
// the TCP destination changes when the Ethernet port cannot be reached.
func init() {
	base := http.DefaultTransport.(*http.Transport).Clone()
	base.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		if network != "tcp" || address != "mc.calebwash.com:443" {
			return (&net.Dialer{Timeout: 30 * time.Second}).DialContext(ctx, network, address)
		}
		dialer := &net.Dialer{Timeout: 3 * time.Second}
		primaryCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		conn, primaryErr := dialer.DialContext(primaryCtx, network, address)
		cancel()
		if primaryErr == nil {
			return conn, nil
		}
		conn, backupErr := dialer.DialContext(ctx, network, "mc.calebwash.com:8443")
		if backupErr != nil {
			return nil, primaryErr
		}
		return conn, nil
	}
	http.DefaultTransport = base
}

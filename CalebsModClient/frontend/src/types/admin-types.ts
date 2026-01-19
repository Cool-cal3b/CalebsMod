enum ServerStatus {
	STARTED = "started",
	ALREADY_RUNNING = "already_running",
	STOPPED = "stopped",
	ALREADY_STOPPED = "already_stopped",
	NOT_FOUND = "not_found",
	ERROR = "error",
}

interface MinecraftServerResponse {
	status: ServerStatus;
	message: string;
}

export { ServerStatus };
export type { MinecraftServerResponse };
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

interface DockerStatus {
	exists: boolean;
	running: boolean;
	status: string;
	startedAt: string;
	finishedAt: string;
}

interface PlayersInfo {
	online: number;
	max: number;
	players: string[];
}

interface ServerStatusResponse {
	dockerStatus: DockerStatus;
	rconConnected: boolean;
	players: PlayersInfo;
}

export { ServerStatus };
export type { MinecraftServerResponse, ServerStatusResponse };
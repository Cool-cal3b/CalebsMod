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

interface SearchModsResponse {
	foundMods: FoundMod[];
}

interface ServerSetting {
	key: string;
	label: string;
	description: string;
	type: string;
	options?: string[];
	min?: number;
	max?: number;
	value: string;
	appliesLive: boolean;
}

interface ServerSettingsResponse {
	settings: ServerSetting[];
	fileExists: boolean;
	serverRunning: boolean;
	appliedLive?: string[];
	restartRequired?: string[];
}

interface FoundMod {
	sha256: string;
	fileName: string;
	clientOnly: boolean;
	serverOnly: boolean;
}

export { ServerStatus };
export type {
	MinecraftServerResponse,
	ServerStatusResponse,
	FoundMod,
	SearchModsResponse,
	ServerSetting,
	ServerSettingsResponse,
};
export namespace go_services {
	
	export class ClientStatus {
	    launcherInstalled: boolean;
	    instanceExists: boolean;
	    serverInConfig: boolean;
	    filesExpected: number;
	    filesMissing: number;
	    modsExpected: number;
	    modsMissing: number;
	    missingExamples: string[];
	    needsSync: boolean;
	    manifestError?: string;
	
	    static createFrom(source: any = {}) {
	        return new ClientStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.launcherInstalled = source["launcherInstalled"];
	        this.instanceExists = source["instanceExists"];
	        this.serverInConfig = source["serverInConfig"];
	        this.filesExpected = source["filesExpected"];
	        this.filesMissing = source["filesMissing"];
	        this.modsExpected = source["modsExpected"];
	        this.modsMissing = source["modsMissing"];
	        this.missingExamples = source["missingExamples"];
	        this.needsSync = source["needsSync"];
	        this.manifestError = source["manifestError"];
	    }
	}
	export class DockerStatus {
	    exists: boolean;
	    running: boolean;
	    status: string;
	    startedAt: string;
	    finishedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DockerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.exists = source["exists"];
	        this.running = source["running"];
	        this.status = source["status"];
	        this.startedAt = source["startedAt"];
	        this.finishedAt = source["finishedAt"];
	    }
	}
	export class DocumentationDocument {
	    id: string;
	    title: string;
	    markdown: string;

	    static createFrom(source: any = {}) {
	        return new DocumentationDocument(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.markdown = source["markdown"];
	    }
	}
	export class DocumentationSummary {
	    id: string;
	    title: string;

	    static createFrom(source: any = {}) {
	        return new DocumentationSummary(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	    }
	}
	export class ModpackFileInfo {
	    sha256: string;
	    fileName: string;
	    fileSize: number;
	    fileType: string;
	    relativePath: string;
	
	    static createFrom(source: any = {}) {
	        return new ModpackFileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sha256 = source["sha256"];
	        this.fileName = source["fileName"];
	        this.fileSize = source["fileSize"];
	        this.fileType = source["fileType"];
	        this.relativePath = source["relativePath"];
	    }
	}
	export class ModpackUploadResponse {
	    filesProcessed: number;
	    files: ModpackFileInfo[];
	
	    static createFrom(source: any = {}) {
	        return new ModpackUploadResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filesProcessed = source["filesProcessed"];
	        this.files = this.convertValues(source["files"], ModpackFileInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PackFileDto {
	    sha256: string;
	    fileName: string;
	    fileSize: number;
	    fileType: string;
	    relativePath: string;
	    originalUrl: string;
	    modId: string;
	    modVersion: string;
	    required: boolean;
	    serverOnly: boolean;
	    clientOnly: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PackFileDto(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sha256 = source["sha256"];
	        this.fileName = source["fileName"];
	        this.fileSize = source["fileSize"];
	        this.fileType = source["fileType"];
	        this.relativePath = source["relativePath"];
	        this.originalUrl = source["originalUrl"];
	        this.modId = source["modId"];
	        this.modVersion = source["modVersion"];
	        this.required = source["required"];
	        this.serverOnly = source["serverOnly"];
	        this.clientOnly = source["clientOnly"];
	    }
	}
	export class PlayersInfo {
	    online: number;
	    max: number;
	    players: string[];
	
	    static createFrom(source: any = {}) {
	        return new PlayersInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.online = source["online"];
	        this.max = source["max"];
	        this.players = source["players"];
	    }
	}
	export class ServerSetting {
	    key: string;
	    label: string;
	    description: string;
	    type: string;
	    options?: string[];
	    min?: number;
	    max?: number;
	    value: string;
	    appliesLive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ServerSetting(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.label = source["label"];
	        this.description = source["description"];
	        this.type = source["type"];
	        this.options = source["options"];
	        this.min = source["min"];
	        this.max = source["max"];
	        this.value = source["value"];
	        this.appliesLive = source["appliesLive"];
	    }
	}
	export class ServerSettingsResponse {
	    settings: ServerSetting[];
	    fileExists: boolean;
	    serverRunning: boolean;
	    appliedLive?: string[];
	    restartRequired?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ServerSettingsResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.settings = this.convertValues(source["settings"], ServerSetting);
	        this.fileExists = source["fileExists"];
	        this.serverRunning = source["serverRunning"];
	        this.appliedLive = source["appliedLive"];
	        this.restartRequired = source["restartRequired"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ServerStatusResponse {
	    dockerStatus: DockerStatus;
	    rconConnected: boolean;
	    players: PlayersInfo;
	
	    static createFrom(source: any = {}) {
	        return new ServerStatusResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dockerStatus = this.convertValues(source["dockerStatus"], DockerStatus);
	        this.rconConnected = source["rconConnected"];
	        this.players = this.convertValues(source["players"], PlayersInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateStatus {
	    currentVersion: string;
	    latestVersion: string;
	    updateAvailable: boolean;
	    supported: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.updateAvailable = source["updateAvailable"];
	        this.supported = source["supported"];
	        this.error = source["error"];
	    }
	}

}

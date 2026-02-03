export namespace go_services {
	
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

}


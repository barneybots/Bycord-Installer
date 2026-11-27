export namespace main {
	
	export class DiscordInstall {
	    branch: string;
	    name: string;
	    path: string;
	    version: string;
	    state: string;
	    mod: string;
	    modPath: string;
	    supported: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DiscordInstall(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.branch = source["branch"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.version = source["version"];
	        this.state = source["state"];
	        this.mod = source["mod"];
	        this.modPath = source["modPath"];
	        this.supported = source["supported"];
	    }
	}
	export class InstallOptions {
	    branch: string;
	    mode: string;
	    folder: string;
	
	    static createFrom(source: any = {}) {
	        return new InstallOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.branch = source["branch"];
	        this.mode = source["mode"];
	        this.folder = source["folder"];
	    }
	}
	export class Requirement {
	    name: string;
	    found: boolean;
	    version: string;
	    link: string;
	
	    static createFrom(source: any = {}) {
	        return new Requirement(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.found = source["found"];
	        this.version = source["version"];
	        this.link = source["link"];
	    }
	}

}


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
	    icon: string;
	    install: string;
	    repo: string;
	
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
	        this.icon = source["icon"];
	        this.install = source["install"];
	        this.repo = source["repo"];
	    }
	}
	export class FolderCheck {
	    state: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new FolderCheck(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.state = source["state"];
	        this.error = source["error"];
	    }
	}
	export class InstallOptions {
	    branch: string;
	    mode: string;
	    folder: string;
	    replaceOther: boolean;
	
	    static createFrom(source: any = {}) {
	        return new InstallOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.branch = source["branch"];
	        this.mode = source["mode"];
	        this.folder = source["folder"];
	        this.replaceOther = source["replaceOther"];
	    }
	}
	export class Requirement {
	    name: string;
	    found: boolean;
	    version: string;
	    link: string;
	    note: string;
	
	    static createFrom(source: any = {}) {
	        return new Requirement(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.found = source["found"];
	        this.version = source["version"];
	        this.link = source["link"];
	        this.note = source["note"];
	    }
	}
	export class UserPlugin {
	    name: string;
	    folder: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new UserPlugin(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.folder = source["folder"];
	        this.path = source["path"];
	    }
	}

}


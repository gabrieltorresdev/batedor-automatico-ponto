export namespace clockin {
	
	export class Localizacao {
	    Nome: string;
	    Valor: string;
	
	    static createFrom(source: any = {}) {
	        return new Localizacao(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Nome = source["Nome"];
	        this.Valor = source["Valor"];
	    }
	}

}

export namespace main {
	
	export class Credentials {
	    Username: string;
	    Password: string;
	
	    static createFrom(source: any = {}) {
	        return new Credentials(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Username = source["Username"];
	        this.Password = source["Password"];
	    }
	}

}

export namespace slack {
	
	export class Status {
	    Emoji: string;
	    Mensagem: string;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Emoji = source["Emoji"];
	        this.Mensagem = source["Mensagem"];
	    }
	}

}


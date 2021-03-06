﻿export class Vfs {
	devctlAsync(command: number, input: Stream, output: Stream): any {
		console.error('VfsMustOverride devctlAsync', this);
		throw new Error("Must override devctlAsync : " + this);
	}

	openAsync(path: string, flags: FileOpenFlags, mode: FileMode): Promise2<VfsEntry> {
		console.error('VfsMustOverride openAsync', this);
		throw new Error("Must override openAsync : " + this);
	}

	readAllAsync(path: string) {
		return this.openAsync(path, FileOpenFlags.Read, parseInt('0777', 8)).then(entry => entry.readAllAsync());
	}

	writeAllAsync(path: string, data: ArrayBuffer) {
		return this.openAsync(path, FileOpenFlags.Create | FileOpenFlags.Truncate | FileOpenFlags.Write, parseInt('0777', 8)).then(entry => entry.writeAllAsync(data));
	}
	
	deleteAsync(path: string): Promise2<void> {
		throw new Error("Must override openAsync : " + this);
	}

	openDirectoryAsync(path: string) {
		return this.openAsync(path, FileOpenFlags.Read, parseInt('0777', 8));
	}

	getStatAsync(path: string): Promise2<VfsStat> {
		return this.openAsync(path, FileOpenFlags.Read, parseInt('0777', 8)).then(entry => entry.stat());
	}

	existsAsync(path: string): Promise2<boolean> {
		return this.getStatAsync(path).then(() => true).catch(() => false);
	}
}

export class ProxyVfs extends Vfs {
	constructor(public parentVfsList: Vfs[]) { super(); }

	private _callChainWhenError<T>(callback: (vfs:Vfs, e: Error) => void) {
		var promise = Promise2.reject(new Error());
		this.parentVfsList.forEach(parentVfs => {
			promise = promise.catch((e) => {
				return callback(parentVfs, e);
			});
		});
		return promise;
	}

	devctlAsync(command: number, input: Stream, output: Stream) {
		return this._callChainWhenError<number>((vfs, e) => {
			return vfs.devctlAsync(command, input, output);
		});
	}
	openAsync(path: string, flags: FileOpenFlags, mode: FileMode): Promise2<VfsEntry> {
		return this._callChainWhenError<VfsEntry>((vfs, e) => {
			return vfs.openAsync(path, flags, mode);
		});
	}
	deleteAsync(path: string) {
		return this._callChainWhenError<VfsEntry>((vfs, e) => {
			return vfs.deleteAsync(path);
		});
	}
	openDirectoryAsync(path: string) {
		return this._callChainWhenError<VfsEntry>((vfs, e) => {
			return vfs.openDirectoryAsync(path);
		});
	}
	getStatAsync(path: string): Promise2<VfsStat> {
		return this._callChainWhenError<VfsStat>((vfs, e) => {
			return vfs.getStatAsync(path);
		});
	}
}

export class VfsEntry {
	get isDirectory(): boolean {
		return this.stat().isDirectory;
	}
	get size(): number { return this.stat().size; }

	readAllAsync() { return this.readChunkAsync(0, this.size); }
	writeAllAsync(data: ArrayBuffer) { return this.writeChunkAsync(0, data); }

	enumerateAsync(): Promise2<VfsStat[]> { throw (new Error("Must override enumerateAsync : " + this)); }
	readChunkAsync(offset: number, length: number): Promise2<ArrayBuffer> { throw (new Error("Must override readChunkAsync : " + this)); }
	writeChunkAsync(offset: number, data: ArrayBuffer): Promise2<number> { throw (new Error("Must override writeChunkAsync : " + this)); }
	stat(): VfsStat { throw (new Error("Must override stat")); }
	close() { }
}

export class VfsEntryStream extends VfsEntry {
	constructor(private asyncStream: AsyncStream) {
		super();
	}
	get size(): number { return this.asyncStream.size; }
	readChunkAsync(offset: number, length: number): Promise2<ArrayBuffer> {
		return this.asyncStream.readChunkAsync(offset, length);
	}
	close() { }
	stat(): VfsStat {
		return {
			name: this.asyncStream.name,
			size: this.asyncStream.size,
			isDirectory: false,
			timeCreation: this.asyncStream.date,
			timeLastAccess: this.asyncStream.date,
			timeLastModification: this.asyncStream.date,
		};
	}
}

export enum FileOpenFlags {
	Read = 0x0001,
	Write = 0x0002,
	ReadWrite = Read | Write,
	NoBlock = 0x0004,
	_InternalDirOpen = 0x0008, // Internal use for dopen
	Append = 0x0100,
	Create = 0x0200,
	Truncate = 0x0400,
	Excl = 0x0800,
	Unknown1 = 0x4000, // something async?
	NoWait = 0x8000,
	Unknown2 = 0xf0000, // seen on Wipeout Pure and Infected
	Unknown3 = 0x2000000, // seen on Puzzle Guzzle, Hammerin' Hero
}

export const enum FileMode {
}

export interface VfsStat {
	name?: string;
	size: number;
	isDirectory: boolean;
	timeCreation: Date;
	timeLastAccess: Date;
	timeLastModification: Date;
	dependentData0?: number;
	dependentData1?: number;
}

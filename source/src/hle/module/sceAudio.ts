﻿///<reference path="../../global.d.ts" />

import _utils = require('../utils');
import SceKernelErrors = require('../SceKernelErrors');
import _context = require('../../context');
import _audio = require('../../core/audio');
import nativeFunction = _utils.nativeFunction;

export class sceAudio {
	private channels: Channel[] = [];

	constructor(private context: _context.EmulatorContext) {
		for (var n = 0; n < 8; n++) this.channels.push(new Channel(n));
	}

	private isValidChannel(channelId: number) {
		return (channelId >= 0 && channelId < this.channels.length);
	}

	@nativeFunction(0x01562BA3, 150, 'uint', 'int')
	sceAudioOutput2Reserve(sampleCount: number) {
		console.warn('sceAudioOutput2Reserve not implemented!');
		debugger;
		return 0;
	}

	@nativeFunction(0x2D53F36E, 150, 'uint', 'int/void*')
	sceAudioOutput2OutputBlocking(volume: number, buffer: Stream) {
		return waitAsync(10).then(() => 0);
	}

	@nativeFunction(0x5EC81C55, 150, 'uint', 'int/int/int')
	sceAudioChReserve(channelId: number, sampleCount: number, format: AudioFormat) {
		if (channelId >= this.channels.length) return -1;
		if (channelId < 0) {
			channelId = this.channels.first(channel => !channel.allocated).id;
			if (channelId === undefined) {
				console.warn('Not implemented sceAudio.sceAudioChReserve');
				return -2;
			}
		}
		var channel = this.channels[channelId];
		channel.allocated = true;
		channel.sampleCount = sampleCount;
		channel.format = format;
		//console.log(this.context);
		channel.channel = this.context.audio.createChannel();
		channel.channel.start();
        return channelId;
	}
	
	private getChannelById(id: number) {
		return this.channels[id];
	}

	@nativeFunction(0x6FC46853, 150, 'uint', 'int')
	sceAudioChRelease(channelId: number) {
		if (!this.isValidChannel(channelId)) return SceKernelErrors.ERROR_AUDIO_INVALID_CHANNEL;
		var channel = this.getChannelById(channelId);
		channel.allocated = false;
		channel.channel.stop();
		channel.channel = null;
		return 0;
	}

	@nativeFunction(0x95FD0C2D, 150, 'uint', 'int/int')
	sceAudioChangeChannelConfig(channelId: number, format: AudioFormat) {
		if (!this.isValidChannel(channelId)) return SceKernelErrors.ERROR_AUDIO_INVALID_CHANNEL;
		var channel = this.getChannelById(channelId);
		channel.format = format;
		return 0;
	}

	@nativeFunction(0xCB2E439E, 150, 'uint', 'int/int')
	sceAudioSetChannelDataLen(channelId: number, sampleCount: number) {
		//ERROR_AUDIO_CHANNEL_NOT_INIT
		if (!this.isValidChannel(channelId)) return SceKernelErrors.ERROR_AUDIO_INVALID_CHANNEL;
		if ((sampleCount % 64) != 0) return SceKernelErrors.ERROR_AUDIO_OUTPUT_SAMPLE_DATA_SIZE_NOT_ALIGNED;
		var channel = this.getChannelById(channelId);
		channel.sampleCount = sampleCount;
		return 0;
	}
	
	_sceAudioOutput(channelId: number, leftVolume: number, rightVolume: number, buffer: Stream): any {
		if (!buffer) return -1;
		if (!this.isValidChannel(channelId)) return SceKernelErrors.ERROR_AUDIO_INVALID_CHANNEL;
		//console.log(leftVolume, rightVolume);
		var channel = this.getChannelById(channelId);
		return channel.channel.playAsync(
			channel.numberOfChannels,
			buffer.readInt16Array(channel.totalSampleCount),
			MathUtils.clamp01(leftVolume / 32768),
			MathUtils.clamp01(rightVolume / 32768)
		);
	}

	@nativeFunction(0x13F592BC, 150, 'uint', 'int/int/int/void*')
	sceAudioOutputPannedBlocking(channelId: number, leftVolume: number, rightVolume: number, buffer: Stream): any {
		var result = this._sceAudioOutput(channelId, leftVolume, rightVolume, buffer);
		if (!(result instanceof Promise2)) return result;
		return new WaitingThreadInfo('sceAudioOutputPannedBlocking', channelId, result, AcceptCallbacks.NO);
	}

	@nativeFunction(0x136CAF51, 150, 'uint', 'int/int/void*')
	sceAudioOutputBlocking(channelId: number, volume: number, buffer: Stream): any {
		var result = this._sceAudioOutput(channelId, volume, volume, buffer);
		return result;
		//debugger;
		//return new WaitingThreadInfo('sceAudioOutputBlocking', channel, , AcceptCallbacks.NO);
	}

	@nativeFunction(0x8C1009B2, 150, 'uint', 'int/int/void*')
	sceAudioOutput(channelId: number, volume: number, buffer: Stream): any {
		var result = this._sceAudioOutput(channelId, volume, volume, buffer);
		return 0;
	}

	@nativeFunction(0xE2D56B2D, 150, 'uint', 'int/int/int/void*')
	sceAudioOutputPanned(channelId: number, leftVolume: number, rightVolume: number, buffer: Stream): any {
		var result = this._sceAudioOutput(channelId, leftVolume, rightVolume, buffer);
		return 0;
	}

	@nativeFunction(0xB7E1D8E7, 150, 'uint', 'int/int/int')
	sceAudioChangeChannelVolume(channelId: number, volumeLeft: number, volumeRight: number) {
		console.warn("Not implemented sceAudioChangeChannelVolume");
		return 0;
	}

	@nativeFunction(0xB7E1D8E7, 150, 'uint', 'int')
	sceAudioGetChannelRestLen(channelId: number) {
		console.warn("Not implemented sceAudioGetChannelRestLen");
		return 0;
	}
}

enum AudioFormat {
	Stereo = 0x00,
	Mono = 0x10,
}

class Channel {
	allocated: boolean = false;
	sampleCount: number = 44100;
	format: AudioFormat = AudioFormat.Stereo;
	channel: _audio.PspAudioChannel;

	get totalSampleCount() {
		return this.sampleCount * this.numberOfChannels;
		//return this.sampleCount;
	}

	get numberOfChannels() {
		return (this.format == AudioFormat.Stereo) ? 2 : 1;
	}

	constructor(public id: number) {
	}
}

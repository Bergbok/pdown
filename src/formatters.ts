import winston from 'winston';
import type { SizeFormatOptions } from './types/cli.js';

/** removes characters added by terminalLink() */
export const unlink = winston.format((info) => {
	info.message = String(info.message).replace(/\x1b]8;;(.*?)\x07([\s\S]*?)\x1b]8;;(?:\x07|\x1b\\)/g, '[$2]($1)');
	return info;
});

/** removes characters added by chalk */
export const uncolorize = winston.format((info) => {
	// winston.format.uncolorize() uses /\x1B\[\d+m/g, which isn't sufficient when using chalk
	// https://github.com/DABH/colors.js/blob/master/lib/colors.js#L55-L57
	info.message = String(info.message).replace(/\x1B\[[\d;]+m/g, '');
	return info;
});

export const formatFilename = (filename: string, maxLength = 20) => {
	if (filename.length <= maxLength) return filename.padEnd(maxLength, ' ');

	const dot = filename.lastIndexOf('.');

	if (dot <= 0) {
		return (filename.slice(0, maxLength - 3) + '...').padEnd(maxLength, ' ');
	}

	const ext = filename.slice(dot);
	const baseMax = maxLength - ext.length - 3;

	if (baseMax > 0) {
		return (filename.slice(0, baseMax) + '...' + ext).padEnd(maxLength, ' ');
	}

	return (filename.slice(0, maxLength - 1) + '...').padEnd(maxLength, ' ');
};

export const formatBytes = (value: number | undefined, opts: SizeFormatOptions): string => {
	if (!value) return '0B';
	if (!opts.humanReadable && !opts.si) return `${Math.round(value)}B`;

	const base = opts.si ? 1000 : 1024;
	const units = ['B', 'K', 'M', 'G', 'T', 'P'];
	// const units = si ? ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] : ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

	let i = 0;
	while (value >= base && i < units.length - 1) {
		value /= base;
		i++;
	}

	return i === 0 ? `${value.toFixed(0)}${units[i]}` : `${value.toFixed(2)}${units[i]}`;
};

export const formatProgress = (value: number, total: number, opts: SizeFormatOptions): string =>
	`${formatBytes(value, opts)} / ${formatBytes(total, opts)}`;

export const formatSpeed = (bps: number, opts: SizeFormatOptions): string => `${formatBytes(bps, opts)}/s`;

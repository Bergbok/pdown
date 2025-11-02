import type { LaunchOptions } from 'puppeteer';

export interface CliOptions {
	cookies?: string;
	json?: boolean;
	password?: string;
	puppeteerOptions?: LaunchOptions;
	quiet?: boolean;
	speed?: number;
	userAgent?: string;
	verbose?: boolean;
}

export interface SizeFormatOptions {
	humanReadable?: boolean;
	si?: boolean;
}

export interface DownloadCommandOptions extends CliOptions, SizeFormatOptions {
	output: string;
}

export interface ListCommandOptions extends CliOptions, SizeFormatOptions {
	recursive: boolean;
}

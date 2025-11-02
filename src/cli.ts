#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import ora from 'ora';
import chalk from 'chalk';
import winston from 'winston';
import Table from 'cli-table3';
import PDown from './pdown.js';
import terminalLink from 'terminal-link';
import parseJson, { JSONError } from 'parse-json';
import packageJSON from '../package.json' with { type: 'json' };
import { Command, Option } from 'commander';
import { logger, fileTransport } from './logger.js';
import { MultiBar, Presets, SingleBar } from 'cli-progress';
import { formatBytes, formatFilename, formatProgress, formatSpeed, uncolorize, unlink } from './formatters.js';
import type { DownloadCommandOptions, ListCommandOptions, SizeFormatOptions } from './types/cli.js';
import type { LaunchOptions } from 'puppeteer';
import type { FileInfo } from './pdown.js';

const purple = chalk.hex('#6D4AFF');

class RootCommand extends Command {
	createCommand(name: string) {
		const cmd = new Command(name);
		cmd.usage('[options] <URL/ID...>');
		cmd.optionsGroup('Global Options:');
		cmd.addOption(new Option('-c, --cookies <FILE>', 'path to a Netscape cookie file'));
		cmd.addOption(new Option('-d, --debug', 'show more informations and write log to ./pdown.log').env('DEBUG').implies({ verbose: true }));
		cmd.addOption(new Option('--json', 'output results and logs as JSON'));
		cmd.addOption(new Option('-p, --password <PASSWORD>', 'share password, if set').env('SHARE_PASSWORD'));
		cmd.addOption(
			new Option(
				'--puppeteerOptions <OPTIONS>',
				`options to pass to Puppeteer (JSON) - ${terminalLink('docs', 'https://pptr.dev/api/puppeteer.launchoptions)')}`
			).argParser((value: string) => {
				try {
					return parseJson(value, '--puppeteerOptions') as LaunchOptions;
				} catch (error) {
					if (error instanceof JSONError) {
						logger.error(chalk.red(error.message));
						if (error.codeFrame) logger.error(error.codeFrame);
					} else {
						logger.error(chalk.red('Failed to parse --puppeteerOptions'));
						logger.error(String(error));
					}
					process.exit(1);
				}
			})
		);
		cmd.addOption(new Option('-q, --quiet', 'suppress all output except errors').conflicts(['debug', 'verbose']));
		cmd.addOption(new Option('--speed <KBPS>', 'limit connection speed (in kilobytes per second)').argParser(parseInt));
		cmd.addOption(
			new Option(
				'-u, --user-agent <UA>',
				`override default user agent - ${terminalLink('MDN', 'https://developer.mozilla.org/en-US/docs/Glossary/User_agent')})`
			).env('USER_AGENT')
		);
		cmd.addOption(new Option('--verbose', 'same as --debug').env('DEBUG'));
		cmd.version(packageJSON.version);

		for (const event of ['option:debug', 'option:verbose']) {
			cmd.on(event, () => {
				logger.info(chalk.blue('Debug mode enabled'));
				logger.level = 'debug';
				if (!logger.transports.includes(fileTransport)) {
					logger.add(fileTransport);
				}
			});
		}

		cmd.on('option:json', () => {
			logger.transports.forEach((transport) => {
				transport.format = winston.format.combine(unlink(), uncolorize(), transport.format ?? winston.format.simple(), winston.format.json());
			});
		});

		cmd.on('option:quiet', () => {
			logger.transports.forEach((transport) => {
				transport.level = 'error';
			});
		});

		return cmd;
	}
}

const program = new RootCommand('pdown');

program
	.helpOption('--help', 'display help for command')
	.configureHelp({
		styleTitle: (title) => purple.bold(title)
	})
	.showSuggestionAfterError(true);

const argument = program
	.createArgument('[URL/ID...]', 'Proton Drive shares to process')
	.argParser((value: string, previous: Set<string> = new Set()) => {
		switch (true) {
			case value.length >= 23 && /^\w{10}#\w{12}$/.test(value.slice(-23)):
				return previous.add(`https://drive.proton.me/urls/${value.slice(-23)}`);
			case /^\w{10}#\w{12}$/.test(value):
				return previous.add(`https://drive.proton.me/urls/${value}`);
			default:
				logger.warn(chalk.hex('#38277A')(`Skipping invalid URL/ID: ${value}`));
				return previous;
		}
	});

const spinner = ora({
	// all spinners:
	// - https://jsfiddle.net/sindresorhus/2eLtsbey
	// - https://github.com/sindresorhus/cli-spinners/blob/main/spinners.json
	discardStdin: false,
	spinner: 'dots2',
	stream: process.stderr
});

const colorSpinner = () => {
	spinner.spinner = {
		...spinner.spinner,
		frames: spinner.spinner.frames.map((frame) => purple(frame))
	};
};

process.on('exit', () => spinner.stop());
process.on('unhandledRejection', () => spinner.stop());

const assertNonEmptySet = <T>(set: Set<T>) => {
	if (!set?.size) {
		console.error('At least one valid URL/ID is required.');
		process.exit(1);
	}
};

program
	.command('dl', { isDefault: true })
	.alias('download')
	.description('download Proton Drive shares')
	.addArgument(argument)
	.optionsGroup('Command Options:')
	.addOption(
		new Option('-o, --output <PATH>', 'set download folder path')
			.default(process.cwd(), 'current directory')
			.argParser((value: string) => value.replace(/^~(?=$|\/|\\)/, os.homedir()))
	)
	.addOption(new Option('-h, --human-readable', 'print sizes like 1K 234M 2G instead of bytes'))
	.addOption(new Option('--si', 'like --human-readable, but use powers of 1000 not 1024').conflicts('humanReadable'))
	.addHelpOption(new Option('--help', 'display help for command').helpGroup('Global Options:'))
	.action(async (urls: Set<string>, options: DownloadCommandOptions) => {
		assertNonEmptySet(urls);

		const pdown = new PDown({
			cookies: options.cookies && fs.readFileSync(options.cookies, 'utf8'),
			logger: logger,
			downloadPath: options.output!,
			puppeteerOptions: options.puppeteerOptions,
			speed: options.speed,
			userAgent: options.userAgent
		});

		const formatOpts: SizeFormatOptions = {
			humanReadable: options.humanReadable,
			si: options.si
		};

		const bars = new Map<string, { bar: SingleBar; startTime: number }>();
		const multibar = new MultiBar(
			{
				autopadding: true,
				barCompleteChar: '█',
				barGlue: '▒',
				barIncompleteChar: '░',
				barsize: 30,
				emptyOnZero: true,
				format: `{filename} |${purple('{bar}')}| {percentage}% | {progressLabel} | {speed}`,
				fps: 24,
				hideCursor: true,
				linewrap: true
			},
			Presets.shades_grey
		);

		pdown.on('loadstart', () => {
			if (!options.verbose && !options.quiet) {
				colorSpinner();
				spinner.start();
			}
		});
		pdown.on('loadcomplete', () => spinner.stop());
		process.on('exit', () => multibar.stop());

		pdown.on('downloadstart', ({ shareID, filename, size }) => {
			if (options.json) {
				logger.info(JSON.stringify({ event: 'downloadstart', shareID, filename, size }));
				return;
			}

			if (!bars.has(shareID) && !options.quiet) {
				const display = formatFilename(filename);
				const bar = multibar.create(size, 0, {
					filename: display,
					progressLabel: formatProgress(0, size, formatOpts),
					speed: '0B/s'
				});
				bars.set(shareID, { bar, startTime: Date.now() });
			}
		});

		pdown.on('downloadprogress', ({ shareID, filename, progress, size, speed }) => {
			if (options.json) {
				logger.info(JSON.stringify({ event: 'downloadprogress', shareID, filename, progress, size, speed }));
				return;
			}

			const bar = bars.get(shareID)?.bar;
			if (!bar) return;

			bar.setTotal(size);
			bar.update(progress, {
				filename: formatFilename(filename),
				progressLabel: formatProgress(progress, size, formatOpts),
				speed: speed ? formatSpeed(speed, formatOpts) : 'N/A'
			});
		});

		pdown.on('downloadcomplete', ({ shareID }) => {
			if (options.json) {
				logger.info(JSON.stringify({ event: 'downloadcomplete', shareID }));
				return;
			}

			const bar = bars.get(shareID)?.bar;
			const startTime = bars.get(shareID)?.startTime;
			if (!bar || !startTime) return;

			// @ts-ignore
			bar.options.barGlue = bar.options.barCompleteChar;

			const durationMs = Date.now() - startTime;
			const total = bar.getTotal();
			const averageBytesPerSecond = total / (durationMs / 1000);

			bar.update(total, {
				progressLabel: formatProgress(total, total, formatOpts),
				speed: `${formatSpeed(averageBytesPerSecond, formatOpts)} (average)`
			});

			bar.stop();
			bars.delete(shareID);
		});

		const result = await pdown.dl(urls, options.password);

		const rejected = result.filter((r) => r.status === 'rejected');
		if (rejected.length) {
			logger.error(chalk.red('Some downloads failed:'));
			rejected.forEach((r) => {
				logger.error(chalk.red(`- ${r.reason.message}`));
			});
			process.exit(1);
		}

		multibar.stop();
	});

program
	.command('ls')
	.alias('list')
	.description('list files in Proton Drive shares')
	.addArgument(argument)
	.optionsGroup('Command Options:')
	.addOption(new Option('-r, --recursive', 'list files recursively in folders').default(false))
	.addOption(new Option('-h, --human-readable', 'print sizes like 1K 234M 2G instead of bytes'))
	.addOption(new Option('--si', 'like --human-readable, but use powers of 1000 not 1024').conflicts('humanReadable'))
	.addHelpOption(new Option('--help', 'display help for command').helpGroup('Global Options:'))
	.action(async (urls: Set<string>, options: ListCommandOptions) => {
		assertNonEmptySet(urls);

		const pdown = new PDown({
			cookies: options.cookies && fs.readFileSync(options.cookies, 'utf8'),
			logger: logger,
			puppeteerOptions: options.puppeteerOptions,
			speed: options.speed,
			userAgent: options.userAgent
		});

		const formatOpts: SizeFormatOptions = {
			humanReadable: options.humanReadable,
			si: options.si
		};

		pdown.on('loadstart', () => {
			if (!options.verbose && !options.quiet) {
				colorSpinner();
				spinner.start();
			}
		});
		pdown.on('loadcomplete', () => spinner.stop());

		const result = await pdown.ls(urls, options.recursive, options.password);
		const fulfilled = result.filter((r) => r.status === 'fulfilled').map((r) => r.value);
		const rejected = result.filter((r) => r.status === 'rejected');

		if (options.json) {
			logger.info(JSON.stringify(fulfilled));
		} else {
			for (const { url, files } of fulfilled) {
				logger.info(`${terminalLink(url.split('/urls/')[1], url)}${files?.mimeType === 'folder' ? ` - ${files.name}` : ''}`);

				const flattenFiles = (file: FileInfo, path: string = ''): Array<FileInfo & { path: string }> => {
					const currentPath = path ? `${path}/${file.name}` : file.name;
					const result: Array<FileInfo & { path: string }> = [];

					// Only include if it's not a folder
					if (file.mimeType !== 'folder') {
						result.push({ ...file, path: currentPath });
					}

					// Recursively add children
					if (file.children) {
						file.children.forEach((child) => {
							result.push(...flattenFiles(child, currentPath));
						});
					}

					return result;
				};

				const filesToDisplay =
					files?.mimeType === 'folder' ? (files.children ?? []).flatMap((child) => flattenFiles(child, '')) : flattenFiles(files, '');

				filesToDisplay.sort((a, b) => {
					const depthA = (a.path.match(/\//g) || []).length;
					const depthB = (b.path.match(/\//g) || []).length;
					if (depthA !== depthB) return depthA - depthB;
					return a.path.localeCompare(b.path);
				});

				if (filesToDisplay.length > 0) {
					const table = new Table({
						head: [purple.bold('Path'), purple.bold('Size'), purple.bold('MIME Type')],
						chars: {
							bottom: '',
							'bottom-left': '',
							'bottom-mid': '',
							'bottom-right': '',
							left: '',
							'left-mid': '',
							mid: '',
							middle: ' ',
							'mid-mid': '',
							right: '',
							'right-mid': '',
							top: '',
							'top-left': '',
							'top-mid': '',
							'top-right': ''
						},
						style: { 'padding-left': 0, 'padding-right': 0 }
					});

					for (const file of filesToDisplay) {
						table.push([file.path, formatBytes(file.size, formatOpts), file.mimeType ?? '--']);
					}

					logger.info('\n' + table.toString());
				} else {
					logger.warn(chalk.yellow('No files found in this share'));
				}
			}
		}

		if (rejected.length) {
			logger.error(chalk.red('Some shares could not be listed:'));
			rejected.forEach((r) => {
				logger.error(chalk.red(`- ${r.reason.message}`));
			});
		}

		logger.debug(chalk.green(`Listed ${fulfilled.length} share${fulfilled.length !== 1 ? 's' : ''} successfully`));
	});

await program.parseAsync(process.argv);

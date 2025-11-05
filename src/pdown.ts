import path from 'path';
import winston from 'winston';
import puppeteer from 'puppeteer';
import { TimeoutError } from 'puppeteer';
import { selectors } from './selectors.js';
import { TypedEmitter } from 'tiny-typed-emitter';
import { CookieJar } from 'netscape-cookies-parser2';
import type { Browser, CookieData, HTTPResponse, LaunchOptions, Page } from 'puppeteer';
import type { FolderInfoAPIResponse, ShareInfoAPIResponse } from './types/api.d.ts';
import type { Cookies as NetscapeCookie } from 'netscape-cookies-parser2';
import type { Logger } from 'winston';

const shareIDRegex = /[A-Za-z0-9]+#[A-Za-z0-9]+/;

export { selectors };

export interface PDownOptions {
	cookies?: string;
	downloadPath?: string;
	logger?: Logger;
	puppeteerOptions?: LaunchOptions;
	speed?: number;
	userAgent?: string;
}

export interface ListResult {
	url: string;
	files: FileInfo;
}

export interface FileInfo {
	/** Files contained in folder. */
	children?: FileInfo[];
	/** MIME Type returned by Proton's API */
	mimeType: string;
	/**	Folder / filename, might not include a file extension. */
	name: string;
	/** Size in bytes. */
	size?: number;
}

export interface PDownEvents {
	downloadcomplete: (event: { shareID: string }) => void;
	downloadprogress: (event: { shareID: string; filename: string; progress: number; size: number; speed?: number }) => void;
	downloadstart: (event: { shareID: string; filename: string; size: number }) => void;
	loadcomplete: () => void;
	loadstart: () => void;
}

export default class PDown extends TypedEmitter<PDownEvents> {
	private cookies?: string;
	private downloadPath?: string;
	private logger: Logger;
	private puppeteerOptions?: LaunchOptions;
	private speed?: number;
	private userAgent?: string;

	constructor(options: PDownOptions = {}) {
		super();
		this.cookies = options.cookies;
		this.downloadPath = options.downloadPath && path.resolve(options.downloadPath);
		this.logger = options.logger || winston.createLogger({ silent: true });
		this.puppeteerOptions = options.puppeteerOptions;
		this.speed = options.speed;
		this.userAgent = options.userAgent;
	}

	private async createBrowser(): Promise<Browser> {
		const puppeteerOptions: LaunchOptions = {
			// headless: false,
			defaultViewport: null,
			...this.puppeteerOptions
		};

		this.logger.debug('Starting browser instance');
		const browser = await puppeteer.launch(puppeteerOptions);

		if (this.cookies) {
			const netscapeCookies: NetscapeCookie[] = new CookieJar(this.cookies).parse();
			const puppeteerCookies: CookieData[] = netscapeCookies.map((cookie) => ({
				name: cookie.name,
				value: cookie.value,
				domain: cookie.domain,
				path: cookie.path,
				secure: cookie.secure,
				expires: cookie.expires
			}));

			await browser.setCookie(...puppeteerCookies);
		}

		return browser;
	}

	private async createPage(browser: Browser): Promise<Page> {
		const page = await browser.newPage();

		if (this.userAgent) {
			await page.setUserAgent({ userAgent: this.userAgent });
		}

		if (this.speed) {
			const bytesPerSecond = this.speed * 1000;
			await page.emulateNetworkConditions({
				download: bytesPerSecond,
				upload: bytesPerSecond,
				latency: 0
			});
			this.logger.debug(`Throttling network to ${this.speed} kB/s`);
		}

		if (this.downloadPath) {
			const client = await page.createCDPSession();
			await client.send('Browser.setDownloadBehavior', {
				behavior: 'allow',
				eventsEnabled: true,
				downloadPath: this.downloadPath
			});

			client.on('Browser.downloadProgress', async (event) => {
				if (event.state === 'completed') {
					this.logger.debug('Download complete, closing browser\r');
					await new Promise((resolve) => setTimeout(resolve, 1000));
					await this.exit(browser);
				}
			});
		}

		return page;
	}

	private async handleApiResponse(
		response: HTTPResponse,
		shareID: string,
		setShareInfo: (info: ShareInfoAPIResponse) => void,
		setFolderInfo: (info: FolderInfoAPIResponse) => void
	) {
		const shareInfoApiCall = `/api/drive/urls/${shareID.split('#')[0]}`;
		const shareAuthApiCall = `${shareInfoApiCall}/auth`;
		const shareInfoInfoApiCall = `${shareInfoApiCall}/info`;
		const folderInfoApiCall = `https://drive.proton.me${shareInfoApiCall}/folders`;

		switch (true) {
			case !response.ok() && response.status() === 422:
				switch (true) {
					case response.url().endsWith(shareInfoInfoApiCall):
						throw new Error(`[${shareID}] Share not found or invalid URL`);
					case response.url().endsWith(shareAuthApiCall):
						throw new Error(`[${shareID}] Invalid password (API)`);
				}
				break;
			case response.url().endsWith(shareInfoApiCall):
				setShareInfo(await response.json());
				break;
			case response.url().startsWith(folderInfoApiCall):
				setFolderInfo(await response.json());
				break;
		}
	}

	private async handlePageLoad(page: Page, password?: string): Promise<void> {
		const shareID = page.url().match(shareIDRegex)?.[0];

		await page.evaluate(() => {
			// Tooltips get in the way when crawling folders
			const style = document.createElement('style');
			style.textContent = '.tooltip, [role=tooltip] { display: none !important; }';
			document.head.appendChild(style);

			localStorage.setItem('dont-ask-desktop-notification', 'true');
		});

		try {
			this.logger.debug(`[${shareID}] Locating password input`);
			const passwordInput = await page.locator(selectors.passwordInput).setTimeout(2500).waitHandle();

			if (!password) {
				throw new Error(`[${shareID}] Permission Denied: no password provided`);
			}

			this.logger.debug(`[${shareID}] Password input found, entering password`);

			await passwordInput.type(password);
			await passwordInput.press('Enter');
		} catch (error) {
			if (error instanceof TimeoutError) {
				this.logger.debug(`[${shareID}] No password input found, proceeding`);
			} else {
				throw error;
			}
		} finally {
			const result = await Promise.race([
				page
					.locator(selectors.tableRows)
					.setTimeout(2500)
					.wait()
					.then(() => 'success')
					.catch(() => undefined),
				page
					.locator(selectors.fileShareProof)
					.setTimeout(2500)
					.wait()
					.then(() => 'success')
					.catch(() => undefined),
				page
					.locator(selectors.incorrectPasswordPopup)
					.setTimeout(2500)
					.wait()
					.then(() => 'incorrect')
					.catch(() => undefined)
			]);

			if (result === 'incorrect') {
				throw new Error(`[${shareID}] Permission Denied: incorrect password`);
			}
		}
	}

	private async waitForDownload(page: Page): Promise<void> {
		const shareID = page.url().match(shareIDRegex)?.[0]!;

		return new Promise(async (resolve, reject) => {
			let progressInterval: NodeJS.Timeout | undefined;
			let emittedStart = false;

			try {
				await page.waitForSelector(selectors.downloadItem, {
					timeout: 10000
				});
			} catch (err) {
				return reject(new Error('Download did not start'));
			}

			progressInterval = setInterval(async () => {
				try {
					const downloads = await page.$$(selectors.downloadItem);
					if (downloads.length === 0) {
						if (progressInterval) clearInterval(progressInterval);
						this.emit('downloadcomplete', { shareID });
						resolve();
					}

					const downloadFileName = await page
						.$eval(selectors.downloadFilename, (el) => el.getAttribute('aria-label') || '')
						.catch(() => 'Unknown Filename');
					const progressValue = await page.$eval(selectors.downloadProgress, (el) => (el as HTMLProgressElement).value).catch(() => 0);
					const progressMax = await page.$eval(selectors.downloadProgress, (el) => (el as HTMLProgressElement).max).catch(() => 0);
					const speedText = await page.$eval(selectors.downloadSpeed, (el) => el.textContent?.trim() || '').catch(() => '');

					let speed: number | undefined;
					if (speedText && /^\d/.test(speedText)) {
						const match = speedText.match(/^([\d.]+)\s*([KMGT]?B)\/s$/i);
						if (match) {
							const num = parseFloat(match[1]);
							const unit = match[2].toUpperCase();
							const multipliers = {
								B: 1,
								KB: 1024,
								MB: 1024 ** 2,
								GB: 1024 ** 3,
								TB: 1024 ** 4
							};
							speed = num * (multipliers[unit as keyof typeof multipliers] || 1);
						}
					}

					if (!emittedStart) {
						this.emit('downloadstart', {
							shareID,
							filename: downloadFileName,
							size: progressMax
						});
						emittedStart = true;
					}

					this.emit('downloadprogress', {
						shareID,
						filename: downloadFileName,
						progress: progressValue,
						size: progressMax,
						speed
					});

					if (progressValue >= progressMax) {
						if (progressInterval) clearInterval(progressInterval);
						this.emit('downloadcomplete', { shareID });
						resolve();
					}
				} catch (error) {
					this.logger.debug(`[${shareID}] Download monitor poll error: ${error}`);
				}
			}, 500);
		});
	}

	private async crawlFolder(
		page: Page,
		visited: Set<string>,
		path: string[] = [],
		recursive?: boolean,
		callback?: (page: Page, path: string[]) => Promise<void>
	): Promise<void> {
		const shareID = page.url().match(shareIDRegex)?.[0];

		const getFolderSelectors = async () => {
			return await page.$$eval('tbody > tr', (rows) =>
				rows.flatMap((tableRow, rowIndex) => {
					const tableCells = Array.from(tableRow.querySelectorAll('td'));
					for (let i = 0; i < tableCells.length; i++) {
						const use = tableCells[i].querySelector('svg use');
						if (use && use.getAttribute('xlink:href') === '#mime-sm-folder') {
							const name = tableCells[i].querySelector('[data-testid=name-cell] span')?.ariaLabel;
							return [
								{
									selector: `tbody > tr:nth-child(${rowIndex + 1}) > td:nth-child(${i + 1})`,
									name
								}
							];
						}
					}
					return [];
				})
			);
		};

		visited.add(path.join('/'));
		await callback?.(page, path);

		const folderSelectors = await getFolderSelectors();
		const folderNames = folderSelectors
			.map((f) => f.name)
			.filter((name): name is string => typeof name === 'string' && name !== null && name !== undefined);
		this.logger.debug(`[${shareID}] ${(folderNames.length > 0 && `Folders in view: ${folderNames.join(', ')}`) || 'No folders found in view'}`);

		if (!recursive) return;

		for (const folderName of folderNames) {
			const folderPath: string[] = [...path, folderName];
			const folderKey = folderPath.join('/');

			if (visited.has(folderKey)) {
				this.logger.debug(`[${shareID}] Already visited "${folderKey}", skipping`);
				continue;
			}

			this.logger.debug(`[${shareID}] Haven't visited "${folderKey}", visiting`);
			visited.add(folderKey);

			const currentSelectors = await getFolderSelectors();
			const folder = currentSelectors.find((f) => f.name === folderName);

			if (!folder) {
				this.logger.error(`[${shareID}] No element found for folder: ${folderName}`);
				continue;
			}

			await page.locator(folder.selector).setTimeout(2500).click({ count: 1 });
			await page.locator(folder.selector).click({ count: 2 });
			await new Promise((resolve) => setTimeout(resolve, 1500));

			await callback?.(page, folderPath);

			if (recursive) await this.crawlFolder(page, visited, folderPath, recursive, callback);

			this.logger.debug(`[${shareID}] Going back up one level from ${folderPath.join('/')}`);
			await page.locator(selectors.previousFolderBreadcrumb).setTimeout(2500).hover();
			await page.locator(selectors.previousFolderBreadcrumb).click();
			await new Promise((resolve) => setTimeout(resolve, 420));
		}
	}

	private async exit(browser: Browser): Promise<void> {
		// https://github.com/puppeteer/puppeteer/issues/7922#issuecomment-1824431350
		const childProcess = browser.process();
		if (childProcess) childProcess.kill(9);
		await browser.close();
	}

	public async dl(urls: Set<string>, password?: string): Promise<PromiseSettledResult<void>[]> {
		this.emit('loadstart');

		return await Promise.allSettled(
			[...urls].map(async (url) => {
				const shareID = url.match(shareIDRegex)?.[0]!;
				const browser = await this.createBrowser();
				const page = await this.createPage(browser);

				try {
					this.logger.debug(`[${shareID}] Navigating to page`);
					await page.goto(url, { waitUntil: 'networkidle2' });
					this.logger.debug(`[${shareID}] Handling page load`);
					await this.handlePageLoad(page, password);
					this.logger.debug(`[${shareID}] Handled page load`);
					this.emit('loadcomplete');

					await page.locator(selectors.shareDownloadButton).setTimeout(20000).click();
					await this.waitForDownload(page);
				} catch (error) {
					await this.exit(browser);
					return Promise.reject(error);
				}
			})
		);
	}

	public async ls(urls: Set<string>, recursive?: boolean, password?: string): Promise<PromiseSettledResult<ListResult>[]> {
		this.emit('loadstart');
		const browser = await this.createBrowser();

		const result = await Promise.allSettled(
			[...urls].map(async (url) => {
				const shareID = url.match(shareIDRegex)?.[0]!;
				const visited = new Set<string>();
				const page = await this.createPage(browser);
				let files: FileInfo;
				let shareInfo: ShareInfoAPIResponse | undefined;
				let folderInfo: FolderInfoAPIResponse | undefined;

				const APIPromise = new Promise<void>((resolve, reject) => {
					page!.on('response', async (response) => {
						try {
							await this.handleApiResponse(
								response,
								shareID,
								(info) => {
									shareInfo = info;
									// Only resolve if it's not a folder, or if we already have folderInfo
									if (info.Token.MIMEType !== 'Folder' || folderInfo) {
										resolve();
									}
								},
								(info) => {
									folderInfo = info;
									// Only resolve if we already have shareInfo
									if (shareInfo) {
										resolve();
									}
								}
							);
						} catch (error) {
							reject(error);
						}
					});
				});

				try {
					this.logger.debug(`[${shareID}] Navigating to page`);
					await page.goto(url, { waitUntil: 'networkidle2' });
					this.logger.debug(`[${shareID}] Handling page load and waiting for API`);
					await Promise.all([this.handlePageLoad(page, password), APIPromise]);
					this.logger.debug(`[${shareID}] Handled page load and API response`);

					if (!shareInfo) return Promise.reject(new Error(`[${shareID}] Failed to process share info API response`));

					if ((shareInfo as ShareInfoAPIResponse).Token.MIMEType === 'Folder') {
						const pathMap = new Map<string, FileInfo>();
						let rootFiles: FileInfo[] = [];

						const extractFiles = async (page: Page): Promise<FileInfo[]> => {
							const result = await page.$$eval(
								selectors.tableRows,
								(rows, selectors) => {
									return rows.map((row) => {
										const sizeText = row.querySelector(selectors.itemSize)?.textContent?.trim() || '';
										const itemInfoText =
											row.querySelector(selectors.itemInfo)?.textContent?.trim() ||
											row.querySelector(selectors.itemInfoFallback)?.getAttribute('alt')?.trim() ||
											'';

										const folderMatch = /^Folder - (.+)$/.exec(itemInfoText);
										const fileMatch = /^File - ([^-]+) - (.+)$/.exec(itemInfoText);

										if (folderMatch)
											return {
												mimeType: 'folder',
												name: folderMatch[1].trim()
											};

										if (fileMatch) {
											let size = 0;
											const match = sizeText.match(/^([\d.]+)\s*(([KMGT]?)B|bytes)$/i);
											if (match) {
												const num = parseFloat(match[1]);
												const unit = match[2].toUpperCase();
												const multipliers = {
													KB: 1024,
													MB: 1024 ** 2,
													GB: 1024 ** 3,
													TB: 1024 ** 4
												};
												size = num * (multipliers[unit as keyof typeof multipliers] || 1);
											}

											return size
												? {
														mimeType: fileMatch[1].trim(),
														name: fileMatch[2].trim(),
														size
													}
												: {
														mimeType: fileMatch[1].trim(),
														name: fileMatch[2].trim()
													};
										}

										throw new Error(`[${shareID}] Invalid item format: ${itemInfoText}`);
									});
								},
								selectors
							);

							return result;
						};

						await this.crawlFolder(page, visited, [], recursive, async (page, path) => {
							const currentPath = path.join('/');

							this.logger.debug(`[${shareID}] [CALLBACK]: Crawling folder (${currentPath})`);
							const files = await extractFiles(page);
							this.logger.debug(`[${shareID}] Extracted ${files.length} files from current view`);

							// For root level, just store the files directly
							if (path.length === 0) {
								rootFiles = files;

								// Track each root file by its full path
								files.forEach((file) => pathMap.set(file.name, file));
							} else {
								// For subfolders, find the parent folder
								const folderName = path[path.length - 1];
								const parentPath = path.slice(0, -1).join('/');

								// Get the parent folder from the path map
								let parentFolder: FileInfo | undefined;

								if (parentPath === '') {
									// Parent is at root level
									parentFolder = rootFiles.find((f) => f.name === folderName);
								} else {
									// Parent is in a subfolder
									const parentFolderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
									for (const [key, value] of pathMap.entries()) {
										if (key === parentFolderPath) {
											parentFolder = value;
											break;
										}
									}
								}

								if (parentFolder) {
									parentFolder.children = files;

									files.forEach((file) => {
										const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
										pathMap.set(filePath, file);
									});
								}
							}
						});

						files = {
							mimeType: 'folder',
							name: (await page.$eval(selectors.rootFolderBreadcrumb, (el) => el.textContent)) || '',
							children: rootFiles
						};
					} else {
						files = {
							mimeType: (shareInfo as ShareInfoAPIResponse).Token.MIMEType,
							name:
								(await page
									.locator(selectors.fileShareFilename)
									.setTimeout(5000)
									.map((el) => el.getAttribute('aria-label'))
									.wait()) || '',
							size: (shareInfo as ShareInfoAPIResponse).Token.Size
						};
					}

					return { url, files };
				} catch (error) {
					return Promise.reject(error);
				} finally {
					await page.close();
				}
			})
		);

		await this.exit(browser);
		this.emit('loadcomplete');
		return result;
	}
}

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const CLI_PATH = path.resolve('./build/src/cli.js');
const DISABLE_SANDBOX = process.env.GITHUB_ACTIONS ? `--puppeteerOptions '{"args":["--no-sandbox"]}'` : '';
const TEST_OUTPUT_DIR = path.join(os.tmpdir(), 'pdown-test-output');

describe('CLI', () => {
	beforeAll(() => {
		if (!fs.existsSync(TEST_OUTPUT_DIR)) {
			fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
		}
	});

	afterAll(() => {
		if (fs.existsSync(TEST_OUTPUT_DIR)) {
			fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
		}
	});

	describe('ls', () => {
		it('should list subfolders with --recursive flag', () => {
			const expected = [
				{
					url: 'https://drive.proton.me/urls/KGER0RS624#LzmiMIuikOuj',
					files: {
						mimeType: 'folder',
						name: 'pdown',
						children: [
							{
								mimeType: 'folder',
								name: 'subfolder',
								children: [
									{
										mimeType: 'folder',
										name: 'subfolder-2',
										children: [
											{
												mimeType: 'video/mp4',
												name: 'example.mp4',
												size: 13631488
											}
										]
									},
									{
										mimeType: 'image/jpeg',
										name: 'example.jpeg',
										size: 1048576
									}
								]
							},
							{
								mimeType: 'text/plain',
								name: 'example.txt',
								size: 54
							}
						]
					}
				}
			];
			const output = execSync(`node ${CLI_PATH} ls KGER0RS624#LzmiMIuikOuj --recursive --json ${DISABLE_SANDBOX}`, { encoding: 'utf8' });
			expect(JSON.parse(JSON.parse(output).message)).toEqual(expected);
		});
	});

	describe('dl', () => {
		it('should be able to download password protected shares', () => {
			execSync(`node ${CLI_PATH} Y5J2AT9QJ0#HjVxIlCjfd99 --password love --output ${TEST_OUTPUT_DIR} ${DISABLE_SANDBOX}`, { encoding: 'utf8' });

			const files = fs.readdirSync(TEST_OUTPUT_DIR);
			expect(files.length).toBeGreaterThan(0);

			const downloadedFile = path.join(TEST_OUTPUT_DIR, files[0]);
			const stats = fs.statSync(downloadedFile);
			expect(stats.size).toBe(1127440);
		});
	});
});

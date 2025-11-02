import chalk from 'chalk';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['**/tests/**/*.test.ts'],
		name: chalk.hex('#6D4AFF')('pdown tests'),
		testTimeout: 30000,
		watch: false
	}
});

import winston from 'winston';
import { uncolorize, unlink } from './formatters.js';

const consoleTransport = new winston.transports.Console({
	format: winston.format.printf((info) => String(info.message).trim())
});

export const createFileTransport = () =>
	new winston.transports.File({
		filename: 'pdown.log',
		handleRejections: true,
		format: winston.format.combine(
			unlink(),
			uncolorize(),
			winston.format.timestamp({ format: 'YYYY-MM-DD@HH:mm:ss.sss' }),
			winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
		)
	});

export const logger = winston.createLogger({
	exitOnError: false,
	level: 'info',
	transports: [consoleTransport]
});

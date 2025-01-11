/**
 * WhackerLink - WhackerLinkRecorder
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Copyright (C) 2025 Caleb, K4PHP
 */

import fs from 'fs';
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { NetworkRecorder } from './NetworkRecorder.js';
import {WebServer} from "./web/WebServer.js";

const argv = yargs(hideBin(process.argv))
    .option('config', {
        alias: 'c',
        description: 'Path to the YAML configuration file',
        type: 'string',
        demandOption: true,
    })
    .help()
    .alias('help', 'h')
    .argv;

let config;

try {
    const configFile = readFileSync(argv.config, 'utf8');
    config = yaml.load(configFile);
} catch (err) {
    console.error('Failed to load configuration file:', err);
    process.exit(1);
}

if (!config.networks || !Array.isArray(config.networks) || config.networks.length === 0) {
    console.error('Invalid configuration: No networks defined.');
    process.exit(1);
}

const baseRecordingsDir = config.baseDirectory || 'recordings';
if (!fs.existsSync(baseRecordingsDir)) {
    fs.mkdirSync(baseRecordingsDir, { recursive: true });
}

const networkRecorder = new NetworkRecorder(baseRecordingsDir);
const delayBetweenConnections = 2000;

config.networks.forEach((network, index) => {
    setTimeout(() => networkRecorder.addNetwork(network), index * delayBetweenConnections);
});

if (config.web && config.web.enabled) {
    const webServer = new WebServer(baseRecordingsDir, config.web.port);
    webServer.start();
}
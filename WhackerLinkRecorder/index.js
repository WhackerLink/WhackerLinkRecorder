/**
 * WhackerLink - WhackerLinkLibJS
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

import { Peer } from '../WhackerLinkLibJS/Peer.js';
import fs from 'fs';
import wav from 'wav';
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

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

const activeStreams = new Map();

function handleNetwork(network) {
    if (!network.address || !network.port || !network.name) {
        console.error(`Invalid network configuration: ${JSON.stringify(network)}`);
        return;
    }

    const networkDir = `${baseRecordingsDir}/${network.name}`;
    if (!fs.existsSync(networkDir)) {
        fs.mkdirSync(networkDir, { recursive: true });
    }

    const peer = new Peer();

    peer.on('open', () => {
        console.log(`Connected to ${network.name} (${network.address}:${network.port})`);
    });

    peer.on('close', () => {
        console.log(`Connection closed for ${network.name}.`);
        activeStreams.forEach((stream, key) => {
            if (key.startsWith(network.name)) {
                stream.writer.end();
                console.log(`Stream for ${key} closed.`);
                activeStreams.delete(key);
            }
        });
    });

    peer.on('audioData', (audioPacket) => {
        const { SrcId, DstId } = audioPacket.voiceChannel;
        const streamKey = `${network.name}-${SrcId}-${DstId}`;

        if (!activeStreams.has(streamKey)) {
            const fileName = `${networkDir}/transmission_${SrcId}_${DstId}_${Date.now()}.wav`;
            const fileStream = fs.createWriteStream(fileName);
            const wavWriter = new wav.Writer({
                sampleRate: 8000,
                bitDepth: 16,
                channels: 1,
            });

            wavWriter.pipe(fileStream);
            activeStreams.set(streamKey, { writer: wavWriter, lastDataTime: Date.now() });
            console.log(`[${network.name}] Started recording stream: ${streamKey}`);
        }

        const stream = activeStreams.get(streamKey);
        stream.writer.write(audioPacket.data);
        stream.lastDataTime = Date.now();
    });

    setInterval(() => {
        const now = Date.now();
        const timeout = 2500;

        activeStreams.forEach((stream, key) => {
            if (key.startsWith(network.name) && now - stream.lastDataTime > timeout) {
                stream.writer.end();
                console.log(`[${network.name}] Ended recording stream: ${key}`);
                activeStreams.delete(key);
            }
        });
    }, 1000);

    peer.connect(network.address, network.port);
}

config.networks.forEach(handleNetwork);
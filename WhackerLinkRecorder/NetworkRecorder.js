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

import { Peer } from '../WhackerLinkLibJS/Peer.js';
import fs from 'fs';
import wav from 'wav';

export class NetworkRecorder {
    constructor(baseRecordingsDir) {
        this.baseRecordingsDir = baseRecordingsDir;
        this.activeStreams = new Map();
    }

    addNetwork(network) {
        if (!network.address || !network.port || !network.name) {
            console.error(`Invalid network configuration: ${JSON.stringify(network)}`);
            return;
        }

        const networkDir = `${this.baseRecordingsDir}/${network.name}`;
        if (!fs.existsSync(networkDir)) {
            fs.mkdirSync(networkDir, { recursive: true });
        }

        const peer = new Peer();

        peer.on('open', () => {
            console.log(`Connected to ${network.name} (${network.address}:${network.port})`);
        });

        peer.on('close', () => {
            console.log(`Connection closed for ${network.name}.`);
            this._closeStreamsForNetwork(network.name);
        });

        peer.on('audioData', audioPacket => this._handleAudioData(audioPacket, networkDir, network.name));

        setInterval(() => this._cleanupStreams(network.name), 1000);

        peer.connect(network.address, network.port);
    }

    _handleAudioData(audioPacket, networkDir, networkName) {
        const { SrcId, DstId } = audioPacket.voiceChannel;
        const talkgroupDir = `${networkDir}/${DstId}`;

        if (!fs.existsSync(talkgroupDir)) {
            fs.mkdirSync(talkgroupDir, { recursive: true });
            console.log(`[${networkName}] Created directory for talkgroup: ${DstId}`);
        }

        const streamKey = `${networkName}-${SrcId}-${DstId}`;

        if (!this.activeStreams.has(streamKey)) {
            const fileName = `${talkgroupDir}/transmission_${SrcId}_${Date.now()}.wav`;
            const fileStream = fs.createWriteStream(fileName);
            const wavWriter = new wav.Writer({
                sampleRate: 8000,
                bitDepth: 16,
                channels: 1,
            });

            wavWriter.pipe(fileStream);
            this.activeStreams.set(streamKey, { writer: wavWriter, lastDataTime: Date.now() });
            console.log(`[${networkName}] Started recording stream: ${streamKey}`);
        }

        const stream = this.activeStreams.get(streamKey);
        stream.writer.write(audioPacket.data);
        stream.lastDataTime = Date.now();
    }

    _cleanupStreams(networkName) {
        const now = Date.now();
        const timeout = 2500;

        this.activeStreams.forEach((stream, key) => {
            if (key.startsWith(networkName) && now - stream.lastDataTime > timeout) {
                stream.writer.end();
                console.log(`[${networkName}] Ended recording stream: ${key}`);
                this.activeStreams.delete(key);
            }
        });
    }

    _closeStreamsForNetwork(networkName) {
        this.activeStreams.forEach((stream, key) => {
            if (key.startsWith(networkName)) {
                stream.writer.end();
                console.log(`[${networkName}] Stream for ${key} closed.`);
                this.activeStreams.delete(key);
            }
        });
    }
}

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

import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';

export class WebServer {
    constructor(baseRecordingsDir, port) {
        this.baseRecordingsDir = baseRecordingsDir;
        this.app = express();
        this.port = port;
        this.cache = {
            networks: [],
            lastUpdated: 0
        };

        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(process.cwd(), 'web', 'views'));

        this.app.use('/recordings', express.static(this.baseRecordingsDir));

        setInterval(() => this.updateCache(), 5000);
    }

    async getNetworks() {
        if (Date.now() - this.cache.lastUpdated < 5000) {
            return this.cache.networks;
        }
        return await this.updateCache();
    }

    async updateCache() {
        try {
            const networkDirs = await fs.readdir(this.baseRecordingsDir, { withFileTypes: true });
            const networks = [];

            for (const dir of networkDirs) {
                if (!dir.isDirectory()) continue;
                const networkName = dir.name;
                const networkPath = path.join(this.baseRecordingsDir, networkName);

                const talkgroups = await fs.readdir(networkPath, { withFileTypes: true });
                const talkgroupData = [];

                for (const tgDir of talkgroups) {
                    if (!tgDir.isDirectory()) continue;
                    const talkgroupName = tgDir.name;
                    const tgPath = path.join(networkPath, talkgroupName);

                    const files = await fs.readdir(tgPath);
                    const recordings = [];

                    for (const file of files) {
                        if (!file.endsWith('.wav')) continue;
                        try {
                            const filePath = path.join(tgPath, file);
                            const fileStats = await fs.stat(filePath);
                            const timestamp = fileStats.mtime.getTime();
                            const [srcId] = file.match(/\d+/) || ['Unknown'];
                            recordings.push({
                                talkgroup: talkgroupName,
                                radioId: srcId,
                                file,
                                timestamp,
                                path: `/recordings/${networkName}/${talkgroupName}/${file}`
                            });
                        } catch (err) {
                            console.error(`Error reading file: ${file}`, err);
                        }
                    }

                    recordings.sort((a, b) => b.timestamp - a.timestamp);
                    talkgroupData.push({ name: talkgroupName, recordings });
                }

                networks.push({ name: networkName, talkgroups: talkgroupData });
            }

            this.cache.networks = networks;
            this.cache.lastUpdated = Date.now();
            return networks;
        } catch (err) {
            console.error("Error updating cache:", err);
            return [];
        }
    }

    start() {
        this.app.get('/', async (req, res) => {
            try {
                const networks = await this.getNetworks();
                res.render('index', { networks });
            } catch (err) {
                console.error('Error rendering the page:', err);
                res.status(500).send('An error occurred while loading the recordings.');
            }
        });

        this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`WebServer running at http://0.0.0.0:${this.port}`);
        });

        this.updateCache().then(r => {});
    }
}

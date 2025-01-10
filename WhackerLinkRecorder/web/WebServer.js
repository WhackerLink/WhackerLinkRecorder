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
import { readdirSync, readFileSync } from 'fs';

export class WebServer {
    constructor(baseRecordingsDir, port) {
        this.baseRecordingsDir = baseRecordingsDir;
        this.app = express();
        this.port = port;

        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(process.cwd(), 'web', 'views'));

        this.app.use('/recordings', express.static(this.baseRecordingsDir));
    }

    getNetworks() {
        const networks = [];
        const networkDirs = readdirSync(this.baseRecordingsDir, { withFileTypes: true })
            .filter(dir => dir.isDirectory())
            .map(dir => dir.name);

        for (const network of networkDirs) {
            const talkgroups = readdirSync(path.join(this.baseRecordingsDir, network), { withFileTypes: true })
                .filter(dir => dir.isDirectory())
                .map(dir => dir.name);

            const talkgroupData = talkgroups.map(talkgroup => {
                const recordings = readdirSync(path.join(this.baseRecordingsDir, network, talkgroup))
                    .filter(file => file.endsWith('.wav'))
                    .map(file => {
                        // Extract Radio ID (SrcId) from the filename or metadata
                        const [srcId] = file.match(/\d+/) || ['Unknown'];
                        return {
                            talkgroup,
                            radioId: srcId,
                            file,
                            path: `/recordings/${network}/${talkgroup}/${file}`,
                        };
                    });
                return { name: talkgroup, recordings };
            });

            networks.push({
                name: network,
                talkgroups: talkgroupData,
            });
        }
        return networks;
    }

    start() {
        this.app.get('/', (req, res) => {
            const networks = this.getNetworks();
            res.render('index', { networks });
        });

        this.app.listen(this.port, "0.0.0.0" ,() => {
            console.log(`WebServer running at http://0.0.0.0:${this.port}`);
        });
    }
}

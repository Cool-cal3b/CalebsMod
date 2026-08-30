import { Injectable } from '@nestjs/common';
import { DockerService } from '../docker/docker.service';
import { RconService } from '../rcon/rcon.service';
import { ModpackService } from '../modpack/modpack.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PackFileDto } from 'src/modpack/dto/manifest.dto';

const CLOUDFLARE_DOMAIN = 'calebwash.com';
const CLOUDFLARE_SUBDOMAIN = 'mc';

@Injectable()
export class ServerService {
  private s3Client: S3Client;
  private readonly S3_BUCKET = 'calebsmod-downloads';
  private readonly S3_REGION = 'us-west-1';

  constructor(
    private dockerService: DockerService,
    private rconService: RconService,
    private modpackService: ModpackService,
  ) {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3 credentials not configured in environment variables');
    }

    this.s3Client = new S3Client({
      region: this.S3_REGION,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      endpoint: `https://s3.${this.S3_REGION}.amazonaws.com`,
      forcePathStyle: false,
    });
  }

  async startServer() {
    await this.syncModpackFiles();
    return await this.dockerService.startServer();
  }

  private async syncModpackFiles() {
    const minecraftDataPath = process.env.MINECRAFT_DATA_PATH || './minecraft-data';
    const absoluteMinecraftPath = path.resolve(minecraftDataPath);

    const manifest = this.modpackService.getServerManifest();
    
    if (manifest.length === 0) {
      console.log('No files to sync to Minecraft server');
      return;
    }

    console.log(`Syncing ${manifest.length} files to Minecraft server...`);

    for (const file of manifest) {
      const sourceFilePath = this.modpackService.getPackFile(file.sha256);
      
      if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {
        console.warn(`Source file not found for ${file.fileName} (${file.sha256})`);
        continue;
      }

      const targetPath = path.join(absoluteMinecraftPath, file.relativePath);
      const targetDir = path.dirname(targetPath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (!fs.existsSync(targetPath)) {
        console.log(`Copying ${file.fileName} to ${file.relativePath}`);
        fs.copyFileSync(sourceFilePath, targetPath);
      } else {
        const existingSha256 = this.calculateFileSha256(targetPath);
        if (existingSha256 !== file.sha256) {
          console.log(`Updating ${file.fileName} (hash mismatch)`);
          fs.copyFileSync(sourceFilePath, targetPath);
        }
      } 
    }

    this.pruneFilesNotInManifest(manifest, absoluteMinecraftPath);

    console.log('File sync complete');
  }

  private calculateFileSha256(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  async stopServer() {
    try {
      if (this.rconService.isConnected()) {
        await this.rconService.say('Server is shutting down...');
        await this.rconService.stop();
      }
    } catch (error) {
      console.error('Error sending shutdown message:', error);
    }

    return await this.dockerService.stopServer();
  }

  async restartServer() {
    try {
      if (this.rconService.isConnected()) {
        await this.rconService.say('Server is restarting...');
      }
    } catch (error) {
      console.error('Error sending restart message:', error);
    }

    return await this.dockerService.restartServer();
  }

  async getIpAndPort() {
    const container = await this.dockerService.getContainer();
    
    let publicIp: string;
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      publicIp = data.ip;
    } catch (error) {
      console.error('Failed to get public IP:', error);
      throw new Error('Unable to retrieve public IP address');
    }

    const port = container?.NetworkSettings?.Ports?.['25565/tcp']?.[0]?.HostPort || '25565';
    
    const portString = port !== '25565' ? `:${port}` : '';
    const serverAddress = `${CLOUDFLARE_SUBDOMAIN}.${CLOUDFLARE_DOMAIN}${portString}`;
    
    return {
      ip: publicIp,
      port: port,
      serverAddress,
    };
  }

  async updateDns() {
    console.log('Updating DNS');
    const { ip } = await this.getIpAndPort();
    
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;

    if (!apiToken || !zoneId) {
      throw new Error('Cloudflare API credentials not configured');
    }

    const recordName = `${CLOUDFLARE_SUBDOMAIN}.${CLOUDFLARE_DOMAIN}`;

    try {
      const listUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${recordName}`;
      const listResponse = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        throw new Error(`Cloudflare API error (list): ${listResponse.status} - ${errorText}`);
      }

      const listData = await listResponse.json();
      
      if (listData.result && listData.result.length > 0) {
        const recordId = listData.result[0].id;
        const updateUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`;
        
        const updateResponse = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'A',
            name: recordName,
            content: ip,
            ttl: 1,
            proxied: false,
          }),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Cloudflare API error (update): ${updateResponse.status} - ${errorText}`);
        }

        return {
          success: true,
          message: `DNS record for ${recordName} updated to ${ip}`,
          ip,
          domain: recordName,
        };
      } else {
        const createUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
        
        const createResponse = await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'A',
            name: recordName,
            content: ip,
            ttl: 1,
            proxied: false,
          }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`Cloudflare API error (create): ${createResponse.status} - ${errorText}`);
        }

        return {
          success: true,
          message: `DNS record for ${recordName} created with IP ${ip}`,
          ip,
          domain: recordName,
        };
      }
    } catch (error) {
      console.error('Failed to update DNS:', error);
      throw new Error(`Failed to update DNS: ${error.message}`);
    }
  }

  async getLatestClientVersion(): Promise<string> {
    const versionFilePath = path.join(__dirname, '..', '..', 'CalebsModClientVersion.txt');
    return fs.readFileSync(versionFilePath, 'utf-8').trim();
  }

  async getLatestClientRelease(): Promise<{
    version: string;
    downloadUrl: string;
    sha256?: string;
  }> {
    const versionFilePath = path.join(__dirname, '..', '..', 'CalebsModClientVersion.txt');
    
    let version: string;
    try {
      version = fs.readFileSync(versionFilePath, 'utf-8').trim();
    } catch (error) {
      console.error('Error reading version file:', error);
      throw new Error('Unable to read client version file');
    }

    if (!version || !/^\d+\.\d+$/.test(version)) {
      throw new Error('Invalid version format in version file');
    }

    const fileName = `CalebsModClient-${version}.zip`;
    const s3Key = `client-releases/${fileName}`;

    console.log(`S3_REGION: ${this.S3_REGION} S3_BUCKET: ${this.S3_BUCKET} s3Key: ${s3Key}`);
    const command = new GetObjectCommand({
      Bucket: this.S3_BUCKET,
      Key: s3Key,
    });

    try {
      const downloadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      });

      // The digest is what lets the bootstrapper and the client's self-updater
      // refuse a corrupt download before it replaces a working binary. It is
      // optional so that releases uploaded before the sidecar existed keep
      // working; those fall back to a size check on the client side.
      const sha256 = await this.getReleaseChecksum(s3Key);

      return {
        version,
        downloadUrl,
        ...(sha256 ? { sha256 } : {}),
      };
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error(`Failed to generate download URL for version ${version}`);
    }
  }

  // Reads the ".sha256" sidecar that upload-new-client-to-s3.ps1 writes next to
  // each release. A missing sidecar is not an error: older releases have none,
  // and refusing to serve them would strand anyone still on that version.
  private async getReleaseChecksum(s3Key: string): Promise<string | undefined> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.S3_BUCKET,
          Key: `${s3Key}.sha256`,
        }),
      );

      const body = await response.Body?.transformToString();
      const digest = body?.trim().split(/\s+/)[0];

      return digest && /^[0-9a-f]{64}$/i.test(digest) ? digest : undefined;
    } catch {
      return undefined;
    }
  }

  async getStatus() {
    const dockerStatus = await this.dockerService.getServerStatus();
    
    let players: { online: number; max: number; players: string[] } = {
      online: 0,
      max: 20,
      players: [],
    };

    let rconConnected = false;

    if (dockerStatus.running) {
      try {
        const playerList = await this.rconService.listPlayers();
        const parsedPlayers = this.parsePlayerList(playerList);
        if (parsedPlayers) {
          players = parsedPlayers;
        }
        rconConnected = true;
      } catch (error) {
        rconConnected = false;
      }
    }

    return {
      dockerStatus,
      rconConnected,
      players,
    };
  }

  async getMetrics() {
    const status = await this.dockerService.getServerStatus();

    if (!status.running) {
      return {
        status: 'offline',
        message: 'Server is not running',
      };
    }

    const stats = await this.dockerService.getServerStats();

    return {
      status: 'online',
      uptime: status.startedAt,
      stats: {
        cpu: stats?.cpu_usage || 0,
        memory: {
          used: stats?.memory_usage || 0,
          limit: stats?.memory_limit || 0,
          percentage: stats
            ? ((stats.memory_usage / stats.memory_limit) * 100).toFixed(2)
            : 0,
        },
        network: {
          rx: stats?.network_rx || 0,
          tx: stats?.network_tx || 0,
        },
      },
    };
  }

  async getLogs(tail = 100) {
    return await this.dockerService.getServerLogs(tail);
  }

  async sendCommand(command: string) {
    if (!this.rconService.isConnected()) {
      throw new Error('RCON is not connected');
    }

    return await this.rconService.send(command);
  }

  private parsePlayerList(
    playerList: string,
  ): { online: number; max: number; players: string[] } | null {
    const match = playerList.match(
      /There are (\d+) of a max of (\d+) players online:(.*)/,
    );

    if (!match) {
      return null;
    }

    const online = parseInt(match[1]);
    const max = parseInt(match[2]);
    const playersStr = match[3].trim();

    const players = playersStr
      ? playersStr.split(',').map((p) => p.trim())
      : [];

    return { online, max, players };
  }

  private pruneFilesNotInManifest(manifest: PackFileDto[], absoluteMinecraftPath: string) {
    const expectedPaths = new Set(
      manifest.map(f => path.normalize(path.join(absoluteMinecraftPath, f.relativePath)))
    );

    const dirsToPrune = ['mods', 'config', 'thingpacks', 'defaultconfigs', 'resourcepacks', 'shaderpacks'];
    for (const dirName of dirsToPrune) {
      const dirPath = path.join(absoluteMinecraftPath, dirName);
      if (!fs.existsSync(dirPath)) continue;
      this.pruneDirRecursive(dirPath, absoluteMinecraftPath, expectedPaths);
    }
  }

  private pruneDirRecursive(dirPath: string, minecraftRoot: string, expectedPaths: Set<string>) {
    for (const name of fs.readdirSync(dirPath)) {
      const fullPath = path.join(dirPath, name);
      const normalizedPath = path.normalize(fullPath);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.pruneDirRecursive(fullPath, minecraftRoot, expectedPaths);
        if (fs.readdirSync(fullPath).length === 0) {
          fs.rmdirSync(fullPath);
        }
      } else if (!expectedPaths.has(normalizedPath)) {
        console.log(`Pruning (not in server manifest): ${path.relative(minecraftRoot, fullPath)}`);
        fs.rmSync(fullPath, { force: true });
      }
    }
  }
}

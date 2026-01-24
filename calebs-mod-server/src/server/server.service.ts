import { Injectable } from '@nestjs/common';
import { DockerService } from '../docker/docker.service';
import { RconService } from '../rcon/rcon.service';

const CLOUDFLARE_DOMAIN = 'calebwash.com';
const CLOUDFLARE_SUBDOMAIN = 'mc';

@Injectable()
export class ServerService {
  constructor(
    private dockerService: DockerService,
    private rconService: RconService,
  ) {}

  async startServer() {
    return await this.dockerService.startServer();
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
}

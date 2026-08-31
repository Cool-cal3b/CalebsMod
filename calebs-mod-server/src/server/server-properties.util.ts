import * as fs from 'fs';
import * as path from 'path';

export type ServerSettingType = 'enum' | 'number' | 'boolean' | 'string';

export interface ServerSettingDefinition {
  key: string;
  label: string;
  description: string;
  type: ServerSettingType;
  options?: string[];
  min?: number;
  max?: number;
  default: string;
  // Present only for settings vanilla can apply while running, via RCON.
  // Everything else is read from server.properties once at startup, so
  // changing it only takes effect after a restart.
  liveCommand?: (value: string) => string;
}

// A curated subset of server.properties. The full file has ~100 keys; most
// are rarely touched, so only the ones an admin is likely to actually want
// are exposed here.
export const SERVER_SETTINGS: ServerSettingDefinition[] = [
  {
    key: 'difficulty',
    label: 'Difficulty',
    description: 'Peaceful, easy, normal, or hard.',
    type: 'enum',
    options: ['peaceful', 'easy', 'normal', 'hard'],
    default: 'easy',
    liveCommand: (value) => `difficulty ${value}`,
  },
  {
    key: 'gamemode',
    label: 'Default game mode',
    description: 'Game mode new players join in (does not affect players already online).',
    type: 'enum',
    options: ['survival', 'creative', 'adventure', 'spectator'],
    default: 'survival',
    liveCommand: (value) => `defaultgamemode ${value}`,
  },
  {
    key: 'max-players',
    label: 'Max players',
    description: 'Maximum number of players who can be online at once.',
    type: 'number',
    min: 1,
    max: 200,
    default: '20',
  },
  {
    key: 'pvp',
    label: 'PVP',
    description: 'Whether players can fight each other.',
    type: 'boolean',
    default: 'true',
  },
  {
    key: 'motd',
    label: 'MOTD',
    description: 'Message shown in the multiplayer server list.',
    type: 'string',
    default: 'A Minecraft Server',
  },
  {
    key: 'white-list',
    label: 'Whitelist enforced',
    description: 'Only players on the whitelist can join.',
    type: 'boolean',
    default: 'false',
    liveCommand: (value) => (value === 'true' ? 'whitelist on' : 'whitelist off'),
  },
  {
    key: 'hardcore',
    label: 'Hardcore',
    description: 'Players are locked to spectator mode instead of respawning on death.',
    type: 'boolean',
    default: 'false',
  },
  {
    key: 'view-distance',
    label: 'View distance',
    description: 'Chunks (in each direction) sent to clients.',
    type: 'number',
    min: 3,
    max: 32,
    default: '10',
  },
  {
    key: 'simulation-distance',
    label: 'Simulation distance',
    description: 'Chunks (in each direction) that are actually simulated.',
    type: 'number',
    min: 3,
    max: 32,
    default: '10',
  },
  {
    key: 'spawn-protection',
    label: 'Spawn protection radius',
    description: 'Blocks around spawn only ops can edit. 0 disables it.',
    type: 'number',
    min: 0,
    max: 100,
    default: '16',
  },
  {
    key: 'allow-flight',
    label: 'Allow flight',
    description: 'Allow players to fly without being kicked for "flying".',
    type: 'boolean',
    default: 'false',
  },
];

export function serverPropertiesPath(): string {
  const dataPath = process.env.MINECRAFT_DATA_PATH || './minecraft-data';
  return path.join(path.resolve(dataPath), 'server.properties');
}

export function readServerProperties(): {
  values: Record<string, string>;
  fileExists: boolean;
} {
  const filePath = serverPropertiesPath();
  if (!fs.existsSync(filePath)) {
    return { values: {}, fileExists: false };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return { values: parseProperties(content), fileExists: true };
}

// itzg's image only fills in properties that aren't already present when the
// container next boots, so writing these directly onto the file (creating it
// if needed) is safe and persists whether or not the server has ever run.
export function writeServerProperties(updates: Record<string, string>): void {
  const filePath = serverPropertiesPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf-8')
    : '';
  fs.writeFileSync(filePath, applyPropertyUpdates(existing, updates), 'utf-8');
}

function parseProperties(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;

    values[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return values;
}

function applyPropertyUpdates(
  content: string,
  updates: Record<string, string>,
): string {
  const remaining = new Set(Object.keys(updates));
  const lines = content.length ? content.split(/\r?\n/) : [];

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;

    const idx = trimmed.indexOf('=');
    if (idx === -1) return line;

    const key = trimmed.slice(0, idx);
    if (!remaining.has(key)) return line;

    remaining.delete(key);
    return `${key}=${updates[key]}`;
  });

  for (const key of remaining) {
    newLines.push(`${key}=${updates[key]}`);
  }

  return newLines.join('\n').replace(/\n*$/, '\n');
}

// Rejects unknown keys and malformed values up front so a typo from the admin
// panel can't land a broken line in server.properties.
export function validateAndNormalizeSettings(
  updates: Record<string, unknown>,
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(updates)) {
    const definition = SERVER_SETTINGS.find((s) => s.key === key);
    if (!definition) {
      throw new Error(`Unknown server setting "${key}"`);
    }

    const value = String(rawValue);

    switch (definition.type) {
      case 'enum':
        if (!definition.options?.includes(value)) {
          throw new Error(
            `Invalid value for "${key}": expected one of ${definition.options?.join(', ')}`,
          );
        }
        break;
      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          throw new Error(`Invalid value for "${key}": expected true or false`);
        }
        break;
      case 'number': {
        const num = Number(value);
        if (!Number.isFinite(num) || !Number.isInteger(num)) {
          throw new Error(`Invalid value for "${key}": expected a whole number`);
        }
        if (definition.min !== undefined && num < definition.min) {
          throw new Error(`Invalid value for "${key}": must be at least ${definition.min}`);
        }
        if (definition.max !== undefined && num > definition.max) {
          throw new Error(`Invalid value for "${key}": must be at most ${definition.max}`);
        }
        break;
      }
      case 'string':
        break;
    }

    normalized[key] = value;
  }

  return normalized;
}

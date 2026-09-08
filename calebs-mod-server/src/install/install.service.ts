import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';

export const INSTALL_SCRIPT_PATH = Symbol('INSTALL_SCRIPT_PATH');

@Injectable()
export class InstallService {
  constructor(
    @Inject(INSTALL_SCRIPT_PATH)
    private readonly scriptPath: string,
  ) {}

  // Read per request, like the version files, so editing the script and
  // reloading is the whole update - no rebuild, no restart. It is a few KB.
  readInstallScript(): string {
    let contents: string;
    try {
      contents = fs.readFileSync(this.scriptPath, 'utf-8');
    } catch (error) {
      console.error('Error reading the install script:', error);
      throw new NotFoundException('Install script is unavailable');
    }

    // CRLF would be fatal on the other end: bash reads the carriage return as
    // part of each command and every line fails with "$'\r': command not
    // found". .gitattributes pins the file to LF, but this is served straight
    // off a Windows working copy, so normalising here means a stray editor or a
    // future checkout setting cannot break every friend's install at once.
    return contents.replace(/\r\n/g, '\n');
  }
}

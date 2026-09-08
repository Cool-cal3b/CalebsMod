import { Controller, Get, Header } from '@nestjs/common';
import { InstallService } from './install.service';

// Root-level and not under /api, because the whole value of this endpoint is
// that the URL is short enough to paste into a friend's chat window:
//
//     curl -fsSL https://mc.calebwash.com/install.sh | bash
//
// That is the one macOS install path with no Gatekeeper prompt in it - see the
// header of calebs-mod-bootstrapper/install-mac.sh for why.
@Controller()
export class InstallController {
  constructor(private readonly installService: InstallService) {}

  // text/plain rather than text/x-shellscript so a friend who pastes the URL
  // into a browser reads the script instead of downloading it. curl does not
  // care either way, and someone checking what they are about to pipe into bash
  // should be able to.
  @Get('install.sh')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  getInstallScript(): string {
    return this.installService.readInstallScript();
  }
}

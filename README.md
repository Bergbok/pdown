<div align='center'>
	<h1>pdown</h1>
	<p><b><a href='https://proton.me/drive'>Proton Drive</a> file downloader</b></p>
	<img src='https://i.imgur.com/PzHGN1J.png' width='80%'>
	<br>
	<br>
</div>

<div align='center'>
	<picture>
		<a href='https://proton.me/drive'>
			<img src='https://img.shields.io/badge/proton-drive-purple?logo=protondrive&color=6d4aff&logoColor=d5a4ff&labelColor=16141c&style=flat'>
		</a>
	</picture>
	<picture>
		<a href='https://github.com/Bergbok/pdown'>
			<img src='https://img.shields.io/github/package-json/v/Bergbok/pdown?logo=refinedgithub&color=6d4aff&logoColor=d5a4ff&labelColor=16141c&style=flat&label=github'>
		</a>
	</picture>
	<picture>
		<a href='https://www.npmjs.com/package/pdown'>
			<img src='https://img.shields.io/npm/v/pdown?logo=npm&color=6d4aff&logoColor=d5a4ff&labelColor=16141c&style=flat'>
		</a>
	</picture>
	<picture>
		<a href='https://www.npmjs.com/package/pdown'>
			<img src='https://img.shields.io/npm/d18m/pdown?logo=npm&color=6d4aff&logoColor=d5a4ff&labelColor=16141c&style=flat&label=downloads%20(18%20months)'>
		</a>
	</picture>
	<picture>
		<a href='https://github.com/Bergbok/pdown'>
			<img src='https://img.shields.io/github/stars/Bergbok/pdown?logo=refinedgithub&color=6d4aff&logoColor=d5a4ff&labelColor=16141c&style=flat'>
		</a>
	</picture>
	<picture>
		<a href='https://github.com/Bergbok/pdown/actions/workflows/test.yml'>
			<img src='https://img.shields.io/github/actions/workflow/status/Bergbok/pdown/test.yml?logo=vitest&color=6d4aff&logoColor=d5a4ff&labelColor=16141c&style=flat&label=tests'>
		</a>
	</picture>
</div><br>

Uses browser automation via [Puppeteer](https://github.com/puppeteer/puppeteer).  
Will be rewritten to use [Proton's Drive SDK](https://proton.me/blog/proton-drive-sdk-preview) once it's stable and has docs.

### Installation

```bash
# recommended method
# alias pdown to one of these
npx pdown
bunx pdown
pnpx pdown
yarn dlx pdown
```

```bash
# alternative		   # won't update automatically
npm add -g pdown   	   # npm update -g pdown
bun add -g pdown   	   # bun update -g pdown
pnpm add -g pdown	   # pnpm update -g pdown
yarn global add pdown  # yarn global upgrade pdown
# omit the global arguments when using via script
```

## Usage

### via command-line

```help
$ pdown --help
Usage: pdown [options] [command]

Commands:
  dl|download [options] <URL/ID...>  download Proton Drive shares
  ls|list [options] <URL/ID...>      list files in Proton Drive shares
  help [options] [command]           display help for command

Global Options:
  -c, --cookies <FILE>               path to a Netscape cookie file
  -d, --debug                        show more informations and write log to ./pdown.log (env: DEBUG)
  --json                             output results and logs as JSON
  -p, --password <PASSWORD>          share password, if set (env: SHARE_PASSWORD)
  --puppeteerOptions <OPTIONS>       options to pass to Puppeteer (JSON) - https://pptr.dev/api/puppeteer.launchoptions
  -q, --quiet                        suppress all output except errors
  --speed <KBPS>                     limit connection speed (in kilobytes per second)
  -u, --user-agent <UA>              override default user agent (env: USER_AGENT)
  --verbose                          same as --debug (env: DEBUG)
  -V, --version                      output the version number
  --help                             display help for command

dl Options:
  -o, --output <PATH>                set download folder path (default: current directory)
  -h, --human-readable               print sizes like 1K 234M 2G instead of bytes
  --si                               like --human-readable, but use powers of 1000 not 1024

ls Options:
  -r, --recursive                    list files recursively in folders (default: false)
  -h, --human-readable               print sizes like 1K 234M 2G instead of bytes
  --si                               like --human-readable, but use powers of 1000 not 1024
```

```bash
$ pdown ls KGER0RS624#LzmiMIuikOuj --recursive
KGER0RS624#LzmiMIuikOuj - pdown
Path                              Size      MIME Type
example.txt                       54B       text/plain
subfolder/example.jpeg            1048576B  image/jpeg
subfolder/subfolder-2/example.mp4 13631488B video/mp4

$ pdown ls KGER0RS624#LzmiMIuikOuj --json | jq '.message | fromjson'
[
  {
    "url": "https://drive.proton.me/urls/KGER0RS624#LzmiMIuikOuj",
    "files": {
      "mimeType": "folder",
      "name": "pdown",
      "children": [
        {
          "mimeType": "folder",
          "name": "subfolder"
        },
        {
          "mimeType": "text/plain",
          "name": "example.txt",
          "size": 54
        }
      ]
    }
  }
]

# download to custom location
$ pdown YXNRS51SXM#lvWyeftvX7R7 -o ~/Downloads
$ cat ~/Downloads/example.txt
:)

# download password protected share
$ pdown Y5J2AT9QJ0#HjVxIlCjfd99 --password 'love' --quiet

# download multiple shares concurrently using SI measurements - https://www.bipm.org/en/measurement-units/si-prefixes
$ pdown KGER0RS624#LzmiMIuikOuj 65PCM21WW8#CxaogwECfsqg --si --speed 1500
pdown.zip            |████████████████████████▒░░░░░░|  81% | 12.39M /  15.29M | 1.50M/s
cool video.mp4       |█▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░|   3% | 13.64M / 362.08M | 1.50M/s

# run with visible GUI
$ pdown YXNRS51SXM#lvWyeftvX7R7 --puppeteerOptions '{"headless": false}' --quiet

# run with custom chromium binary, required on ARM64 (https://github.com/puppeteer/puppeteer/issues/7740)
$ pdown YXNRS51SXM#lvWyeftvX7R7 --puppeteerOptions '{"executablePath": "/usr/bin/chromium-browser"}' --quiet
```

### via script

```typescript
import PDown from 'pdown';

const pdown = new PDown({
	downloadPath: process.cwd()
});

pdown.on('downloadcomplete', ({ shareID }) => {
	console.log(`[${shareID}] Download complete`);
});

await pdown.dl(new Set(['https://drive.proton.me/urls/65PCM21WW8#CxaogwECfsqg']));
```

## FAQ

### I get a 'Permission Denied' error.

Files have to be shared publically and item password needs to be provided if set.

<div align='center'>
	<picture>
		<a href='https://drive.proton.me/urls/65PCM21WW8#CxaogwECfsqg'>
			<img src='https://i.imgur.com/1aPtn7l.png'>
		</a>
	</picture>
</div>

### I set the permission to 'Anyone with the link', but I still can't download.

Please [open an issue](https://github.com/Bergbok/pdown/issues/new/choose)!

## Acknowledgements

Inspired by [gdown](https://github.com/wkentaro/gdown).  
Special thanks to [cli-guidelines](https://github.com/cli-guidelines/cli-guidelines).

<!--
if adding glob support:

bun add is-glob @types/is-glob micromatch @types/micromatch

cmd.addOption(new Option('--glob <GLOB>', `operate on matched files - ${terminalLink('Wikipedia', 'https://en.wikipedia.org/wiki/Glob_(programming)')}`));

micromatch(['a/b.js', 'a/c.md'], '*.js', {
	basename: true,
	dot: true,
});
-->

<!--
https://drive.proton.me/urls/KGER0RS624#LzmiMIuikOuj # pdown
https://drive.proton.me/urls/YXNRS51SXM#lvWyeftvX7R7 # example.txt
https://drive.proton.me/urls/Y5J2AT9QJ0#HjVxIlCjfd99 # example.jpeg (pass = love)
-->

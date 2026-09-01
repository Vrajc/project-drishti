#!/usr/bin/env node
/**
 * Turns a handful of sample clips into N distinct RTSP endpoints.
 *
 * Writes two files:
 *   docker/mediamtx.yml   - MediaMTX server config, one path per camera, each looping a clip
 *   docker/streams.json   - the manifest backend/prisma/seed-cameras.ts reads, so the registry
 *                           and the stream server can never disagree about which path is which
 *
 * The manifest is the single direction of truth: clips -> config + manifest -> camera seed.
 *
 * Usage:
 *   node scripts/generate-streams.js [options]
 *
 *   --clips <dir>     folder of source clips        (default media/clips)
 *   --out <dir>       where to write config         (default docker)
 *   --count <n>       how many endpoints to create  (default 56, matching the camera seed)
 *   --reencode        transcode to H.264 instead of stream-copying
 *   --on-demand       start a publisher only when something reads the path
 *   --allow-empty     write a paths-free config when no clips are present
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.mov', '.m4v', '.ts', '.webm']);

function parseArgs(argv) {
  const options = {
    clips: 'media/clips',
    out: 'docker',
    count: 56,
    reencode: false,
    onDemand: false,
    allowEmpty: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--clips') options.clips = argv[++i];
    else if (arg === '--out') options.out = argv[++i];
    else if (arg === '--count') options.count = Number(argv[++i]);
    else if (arg === '--reencode') options.reencode = true;
    else if (arg === '--on-demand') options.onDemand = true;
    else if (arg === '--allow-empty') options.allowEmpty = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
      process.exit(0);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
    }
  }

  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 500) {
    console.error(`--count must be a whole number between 1 and 500, got ${options.count}`);
    process.exit(2);
  }

  return options;
}

/** cam01 .. camNN - the same convention the camera seed falls back to. */
function streamPath(index) {
  return `cam${String(index + 1).padStart(2, '0')}`;
}

function findClips(clipsDir) {
  if (!fs.existsSync(clipsDir)) return [];

  return fs
    .readdirSync(clipsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort();
}

/**
 * The publisher command MediaMTX runs for a path.
 *
 * `-stream_loop -1` loops the file forever and `-re` paces it at real time, so a ten second
 * clip behaves like a camera that never stops. `-c copy` is the default because fifty
 * simultaneous encodes will not fit on a laptop; pass --reencode when the source codec cannot
 * be passed through.
 *
 * MediaMTX substitutes $MTX_PATH and $RTSP_PORT at runtime, so one command template serves
 * every path and the port is not baked in.
 */
function publisherCommand(clipFile, reencode) {
  const video = reencode
    ? '-c:v libx264 -preset veryfast -tune zerolatency -g 50 -pix_fmt yuv420p'
    : '-c copy';

  return (
    `ffmpeg -hide_banner -loglevel error -re -stream_loop -1 -i /media/${clipFile} ` +
    `${video} -an -f rtsp rtsp://127.0.0.1:$RTSP_PORT/$MTX_PATH`
  );
}

function buildConfig(streams, options) {
  const generated = new Date().toISOString();

  const header = `# GENERATED FILE - do not edit by hand.
# Written by scripts/generate-streams.js at ${generated}
# Regenerate with:  npm run streams:generate
#
# ${streams.length} path(s), sourced from ${options.clipCount} clip(s) in ${options.clips}/.
# Each path loops its clip forever, so a handful of files behave like a wall of cameras.

logLevel: info
logDestinations: [stdout]

# Read timeouts are generous because a looping ffmpeg publisher briefly stalls at the seam.
readTimeout: 15s
writeTimeout: 15s

rtsp: yes
rtspAddress: :8554
rtspTransports: [tcp, udp]

# HLS is what the browser plays. It is remuxed on demand rather than always, so idle paths
# cost nothing - the health poller probes over RTSP and never triggers a remux.
hls: yes
hlsAddress: :8888
hlsAlwaysRemux: no
hlsVariant: lowLatency
hlsSegmentCount: 7
hlsSegmentDuration: 1s
hlsAllowOrigin: '*'

# WebRTC is the lower-latency alternative for the expanded single-camera view.
webrtc: yes
webrtcAddress: :8889
webrtcAllowOrigin: '*'
webrtcLocalUDPAddress: :8189

# Control API, used to inspect what is actually publishing.
api: yes
apiAddress: :9997

paths:
`;

  if (streams.length === 0) {
    return (
      header +
      `  # No clips were found in ${options.clips}/, so no paths were written.\n` +
      '  # Add MP4 files there and run `npm run streams:generate` again.\n' +
      '  # MediaMTX will start and serve nothing; every camera will probe OFFLINE, which is\n' +
      '  # the honest result - there is genuinely no stream behind them.\n'
    );
  }

  const body = streams
    .map((stream) => {
      const command = publisherCommand(stream.clip, options.reencode);
      const runKey = options.onDemand ? 'runOnDemand' : 'runOnInit';
      const restartKey = options.onDemand ? 'runOnDemandRestart' : 'runOnInitRestart';
      const extra = options.onDemand ? '    runOnDemandCloseAfter: 60s\n' : '';

      return (
        `  ${stream.path}:\n` +
        `    # ${stream.cameraHint}\n` +
        `    ${runKey}: ${command}\n` +
        `    ${restartKey}: yes\n` +
        extra
      );
    })
    .join('\n');

  return header + body;
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  const clipsDir = path.resolve(REPO_ROOT, options.clips);
  const outDir = path.resolve(REPO_ROOT, options.out);
  const clips = findClips(clipsDir);

  if (clips.length === 0 && !options.allowEmpty) {
    console.error(`No video files found in ${clipsDir}`);
    console.error('');
    console.error('Add some MP4 clips there and run this again. Refusing to write a stream');
    console.error('configuration that points at files which do not exist - MediaMTX would start,');
    console.error('every publisher would fail, and the cause would only show up as fifty cameras');
    console.error('mysteriously OFFLINE.');
    console.error('');
    console.error('Pass --allow-empty if you deliberately want a paths-free config.');
    process.exit(1);
  }

  const streams = clips.length
    ? Array.from({ length: options.count }, (_, index) => ({
        path: streamPath(index),
        clip: clips[index % clips.length],
        cameraHint: `camera #${index + 1} in the registry seed`,
      }))
    : [];

  fs.mkdirSync(outDir, { recursive: true });

  const configPath = path.join(outDir, 'mediamtx.yml');
  fs.writeFileSync(
    configPath,
    buildConfig(streams, { ...options, clipCount: clips.length }),
    'utf8'
  );

  const manifestPath = path.join(outDir, 'streams.json');
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        clipsDirectory: options.clips,
        clipCount: clips.length,
        reencode: options.reencode,
        onDemand: options.onDemand,
        streams: streams.map(({ path: streamName, clip }) => ({ path: streamName, clip })),
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  const relative = (target) => path.relative(REPO_ROOT, target).replace(/\\/g, '/');

  console.log(`Clips found      : ${clips.length}${clips.length ? ` (${clips.join(', ')})` : ''}`);
  console.log(`Endpoints written: ${streams.length}`);
  console.log(`Publisher        : ${options.reencode ? 'H.264 re-encode' : 'stream copy'}`);
  console.log(`Start mode       : ${options.onDemand ? 'on demand' : 'on init'}`);
  console.log(`Config           : ${relative(configPath)}`);
  console.log(`Manifest         : ${relative(manifestPath)}`);

  if (streams.length > 0) {
    console.log('');
    console.log('Next:  docker compose up -d mediamtx');
    console.log('       npm --prefix backend run seed:cameras');
  }
}

main();

# Sample clips

Drop MP4 files here. `scripts/generate-streams.js` assigns them round-robin across the
cameras in the registry, so a handful of files become fifty-odd distinct RTSP endpoints.

```
npm run streams:generate          # writes docker/mediamtx.yml and docker/streams.json
docker compose up -d mediamtx
npm run seed:cameras --prefix backend   # re-points each camera at its stream path
```

The clips themselves are **not** committed — this folder is in `.gitignore`. Use footage you
have the right to use: crowd scenes, junction cameras, car parks. Anything H.264 in an MP4
container works with the default `-c copy` publisher; pass `--reencode` to the generator if
your source is a codec MediaMTX cannot pass through.

If this folder is empty the generator refuses to run rather than writing a configuration that
points at files that do not exist. Pass `--allow-empty` to produce a paths-free config (which
is what the committed `docker/mediamtx.yml` baseline is).

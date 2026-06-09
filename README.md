# Spectrum

## Run

### Linux desktop app

```sh
npm install
npm run dev
```

Use `npm run dev`. It runs Tauri in dev mode against a localhost frontend server, so changes to `index.html`, `styles.css`, and `app.js` reload the app window automatically.

For a production-style run, rebuild first and then start the release binary:

```sh
npm run build
npm run start
```

The Tauri build is currently Linux-only for native system audio capture. It starts `parec` against `@DEFAULT_MONITOR@`, so it works with PulseAudio or PipeWire through `pipewire-pulse`.

Install the runtime audio tool if it is missing:

```sh
sudo pacman -S pulseaudio-utils
```

or the equivalent package for your distribution.

### Browser fallback

The same frontend still works in a normal browser through the screen/window/tab audio-sharing prompt:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Use

Start playback in Spotify, then launch the Tauri app. It automatically analyzes the default Linux output device on startup.

Browser pages cannot directly attach to the Spotify desktop process. They can only analyze audio the browser is allowed to capture through the screen/window/tab sharing prompt. If the prompt does not expose audio for the Spotify desktop app on your platform, use Spotify Web Player in a browser tab and share that tab with audio enabled.

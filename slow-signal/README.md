# Slow Signal

A browser video synthesizer. Load a 3–6 minute audio track, patch eight LFOs into a feedback shader, and render the result with your audio as an MP4.

- **LFOs:** eight of them, from 10 minutes per cycle down to 0.05 s. Each can be frequency-modulated (exponential, ±4 octaves) by any other LFO, itself, or the audio's level, lows or highs.
- **Patch matrix:** routes any source to any visual control: colour, zoom, rotation, mirror segments, pattern, warp, contour bands, video feedback, chroma split and scanlines.
- **Presets:** save, load, import and export patches as `.json` files. Unnamed presets get a generated alien name built from word fragments; the same patch always suggests the same name, and the dice rolls another.
- **Master speed:** one slider scales every LFO, the pattern flow and the feedback motion from 1× down to 0.01×. It is saved with each preset.
- **Slew:** a global slew time (0–1 s) eases every visual control toward its new value, whatever is moving it.
- **Glide:** previous/next buttons step through presets, and the patch glides from where it is to the chosen preset over a set time (instant to 10 minutes). Touching any control mid-glide stops it there.
- **Render:** encodes in the browser with WebCodecs (H.264, with VP9/AV1 fallback) and [mp4-muxer](https://github.com/Vanilagy/mp4-muxer). Audio is AAC where the browser can encode it (Chrome/Edge on Mac and Windows), otherwise Opus.

The modulation engine is stepped at a fixed 240 Hz as a pure function of time, so the render matches the preview.

## Running it

It is a single `index.html` with no build step. Live at https://johnnyhawk02.github.io/slow-signal/. WebCodecs needs a secure context, so serve it over HTTPS or from `localhost`, for example:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Use a current desktop Chrome or Edge.

## Preset file format

```json
{
  "format": "slow-signal-preset",
  "version": 1,
  "name": "Night drive",
  "patch": {
    "speed": 1,
    "slew": 0,
    "lfos": [{ "period": 600, "shape": "Sine", "fm": "L3", "fmDepth": 0.5 }],
    "controls": { "hue": { "base": 0.58, "mod": { "L1": 0.5 } } }
  }
}
```

"Export all" writes a `slow-signal-bank` file with a `presets` array. Both kinds of file can be imported.

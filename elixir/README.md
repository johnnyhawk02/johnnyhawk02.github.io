# Elixir

A six-voice drum machine in the browser. **Play it: https://johnnyhawk02.github.io/elixir/**

This folder holds the Elixir app and its full source, published as part of johnnyhawk02.github.io.

Elixir's sound engine is a JavaScript port of the drum voices and FX bus in the Erica Synths LXR-02
firmware ([erica-synths/lxr-desktop-app](https://github.com/erica-synths/lxr-desktop-app),
GPL-3.0, commit a43cd4f). Elixir is unofficial: it is not made, approved or endorsed by
Erica Synths.

- **Six voices** from the firmware: three drum/tom voices, snare/clap, cymbal and a closed/open
  hi-hat, with their oscillators, FM, transients, filters, envelopes, LFOs and velocity
  modulation, and every sound parameter on knobs.
- **Everything** builds a new sound from voices of the bundled kits (the 16 free Hrtl LXR-02 DLC
  kits, by Hrtl, distributed free by Erica Synths, credited here, plus 12 generated kits), with new
  crossfeed, delay and pattern. Any LXR kit file (`.SND`) can be opened too.
- **Perform**: energy, beat and fills dials build electro patterns while it plays; a step editor
  with accents and bar conditions sits behind it.
- **Randomise** a voice or the whole kit within drum-safe ranges (or wild).
- **Presets** keep everything (sound, pattern, tempo, mixer, FX, master) under a two-word alien
  name in the browser. The preset manager stars favourites and exports them; favourites dropped
  into `src/presets/*.json` are built into the page as built-in presets. A sound can also be
  exported as an LXR `.SND`.
- **FX bus** from the firmware: distortion (tube, fold, rat), ring mod, compressor and delay
  (normal or ping-pong). Each voice can be routed through it, and kits load their own settings.
- **Mixer** with level, pan, mute and solo, and echo, distortion and ring mod sends per voice, using the firmware's FX code; a master compressor with a drum 1 sidechain duck.
- **Crossfeed**: a 6 × 6 patchbay that feeds any voice into the FM, filter or ring modulation of
  any other, with a depth control and a randomiser.

## The engine is exact

`src/lxr.js` follows the firmware's C line by line, including its float32 rounding and ARM
integer behaviour. `src/verify.mjs` runs the same parameter edits and triggers through the
port and through the firmware's own engine code (cross-compiled for the Cortex-M7 FPU and run
under qemu) and compares every sample of all six voices and of the FX bus output. Over 700 random
scenarios (176 million samples) they are identical. The compressor calls the C library's `logf`
and `expf`, so those are ported too (glibc's and newlib's share the same algorithm). The mixer, FX sends, crossfeed and pattern generator are new and
sit outside that comparison; with crossfeed at zero the engine runs exactly as verified.

The shipped firmware is built with `-O3 -ffast-math`, which rounds slightly differently: with
the init kit the largest difference is 9 LSB (−77 dB).

Not ported: the firmware's reverb (compiled out of the firmware, `USE_REVERB 0`), user samples
and the hardware sequencer. Only the stereo outputs are modelled.

## Files

| Path | What it is |
|---|---|
| `index.html` | the whole app in one file, built by `src/build.mjs` |
| `src/lxr.js` | the engine (ES module, no dependencies) |
| `src/lxr-tables.js`, `src/lxr-ui-data.js` | wavetables, init kit, parameter and menu data from the firmware |
| `src/index.src.html` | the page; `src/build.mjs` bundles it with the engine and kits |
| `src/kits/` | the generator's source kits (`.SND`): Hrtl DLC kits and generated E01–E12 |
| `src/presets/` | built-in presets: favourites exported from the preset manager (`.json`) |
| `src/verify.mjs` | the sample-for-sample comparison |
| `ref/` | the C harness and build script for the reference |

## Build and verify

```sh
node src/build.mjs --out index.html          # rebuild the page

# reference (Debian/Ubuntu): qemu-user-static gcc-arm-linux-gnueabihf libc6-dev-armhf-cross
git clone https://github.com/erica-synths/lxr-desktop-app
ref/build.sh lxr-desktop-app
node src/verify.mjs ref/ref_strict 40        # 0 mismatches
```

## Licence

GPL-3.0-only, like the firmware it is derived from (see [LICENSE](LICENSE)). "Erica Synths",
"LXR" and "LXR-02" are trademarks of Erica Synths; they are used here only to say where the
engine comes from.

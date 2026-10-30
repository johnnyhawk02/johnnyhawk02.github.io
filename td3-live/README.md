# TD-3 Live Patterns (prototype)

A single browser page that writes patterns to a Behringer TD-3 / TD-3-MO over USB with SysEx (opcode 0x78) while it plays.

## Run it

1. Download this folder (`index.html` and `td3.js` must sit side by side).
2. Plug the TD-3 in by **USB** (SysEx doesn't go over the DIN port).
3. Open `index.html` in **Chrome or Edge** (Firefox and Safari don't do Web MIDI SysEx). Double-clicking the file works.
4. Click **Connect MIDI** and allow SysEx. The TD-3 ports are picked automatically.

## Modes

- **Live write:** set Group and Slot to whatever the TD-3 is playing (pick it on the front panel; nothing can select a slot over MIDI). Every edit is re-sent to that slot.
- **Double buffer:** pick two slots. Edits go to the spare one. Press that slot on the TD-3 (it changes at the end of the bar), then click **I switched** so the editor swaps roles.

Writes are debounced, only one is in flight at a time, and the newest pattern for a slot replaces any queued one. The page waits for the TD-3's reply (or a timeout) before sending the next.

## What to test on hardware

The page has a **Hardware test** panel with a flip test (alternates two very different patterns into the live slot). Things to find out:

1. Does overwriting the playing slot take effect immediately, at the next loop, or only after reselecting it?
2. Does the sequencer stop or glitch on a write, especially at short intervals?
3. Is it different on internal clock vs USB clock?
4. **Pitch storage:** put a rest mid-pattern and check the next note lands on the right step. If not, switch Advanced → Pitch storage to "indexed".
5. **Read back target** requests the slot (opcode 0x77) and checks it matches what the editor sent.

## Files

- `td3.js` — encoder/decoder for the 0x78 pattern message (also loadable in Node with `require`).
- `index.html` — the editor UI, MIDI handling and send queue.

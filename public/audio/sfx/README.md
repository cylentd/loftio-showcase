# Stacking sound effects

| File | Original | Source | License |
|---|---|---|---|
| `squish-pop.mp3` | `pixelcrusher-squish-pop-256410.mp3`, edited: raised 11.3 dB, pitched up 5 semitones, low-passed at 3.2 kHz, 8 ms fade-in, 40 ms fade-out (mono) | Pixabay, "squish pop" by pixelcrusher, item 256410 | Pixabay Content License (https://pixabay.com/service/license-summary/) |

Picked by the owner by ear on 2026-11-08, after synthesized tones and Kenney's Impact Sounds were rejected. The edit ("D. Muffled bloop") won over four others for being cute without being distracting.

Rebuild from the original:

```
ffmpeg -i pixelcrusher-squish-pop-256410.mp3 -af volume=11.3dB,asetrate=29434,aresample=44100,lowpass=f=3200,afade=t=in:d=0.008,afade=t=out:st=0.06:d=0.04 -ac 1 -b:a 128k squish-pop.mp3
```

Which file plays for a landing and for a topple is set in `game/src/sfx-data.ts`.

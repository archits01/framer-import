# docs/

`demo.gif` is the hero shown at the top of the main README (a sped-up, silent
loop of the full flow). The full 2-minute version with sound is attached to the
[v0.5.3 release](https://github.com/archits01/framer-import/releases/tag/v0.5.3).

To regenerate the GIF from a new recording:

```bash
IN="/path/to/recording.mp4"
ffmpeg -y -i "$IN" -vf "setpts=PTS/3.5,fps=12,scale=760:-1:flags=lanczos,palettegen=stats_mode=diff" /tmp/pal.png
ffmpeg -y -i "$IN" -i /tmp/pal.png -lavfi "setpts=PTS/3.5,fps=12,scale=760:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" docs/demo.gif
```

`setpts=PTS/3.5` = 3.5× speed. Lower `fps` or `scale` if the file gets too big
(keep it under ~10 MB so GitHub renders it smoothly).

#!/usr/bin/env bash
#
# Concatenate Playwright scene recordings into a subtitled mp4 marketing short.
#
# Prerequisites:
#   - ffmpeg installed (brew install ffmpeg / apt install ffmpeg)
#   - A CJK-capable font available to ffmpeg (for Japanese subtitles)
#   - `npm run demo:record` already executed and webm files present
#
# Usage:
#   npm run demo:build
#
# Output:
#   demo-marketing.mp4
#
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Error: ffmpeg not found. Install with: brew install ffmpeg (macOS) or sudo apt install ffmpeg (Linux)" >&2
  exit 1
fi

RESULTS_DIR="test-results/demo"
OUT_DIR="test-results/demo-build"
FINAL_OUT="demo-marketing.mp4"

if [ ! -d "$RESULTS_DIR" ]; then
  echo "Error: $RESULTS_DIR not found. Run 'npm run demo:record' first." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/*.mp4 "$OUT_DIR/concat.txt" 2>/dev/null || true

# Find scene recordings sorted by scene prefix (01-, 02-, ...)
mapfile -t SCENES < <(find "$RESULTS_DIR" -type f -name "video.webm" | sort)

if [ "${#SCENES[@]}" -eq 0 ]; then
  echo "Error: no video.webm files found under $RESULTS_DIR" >&2
  exit 1
fi

echo "Found ${#SCENES[@]} scene(s):"
printf '  %s\n' "${SCENES[@]}"

# Transcode each webm to mp4 with matching codec/timebase so concat demuxer works cleanly
i=0
for scene in "${SCENES[@]}"; do
  out="$OUT_DIR/scene-$(printf '%02d' $i).mp4"
  echo "[$((i+1))/${#SCENES[@]}] Transcoding $scene -> $out"
  ffmpeg -y -loglevel error \
    -i "$scene" \
    -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30" \
    -c:v libx264 -preset medium -crf 20 \
    -c:a aac -b:a 128k -ar 44100 \
    -pix_fmt yuv420p \
    "$out"
  echo "file '$(pwd)/$out'" >> "$OUT_DIR/concat.txt"
  i=$((i+1))
done

# Concatenate
CONCAT_OUT="$OUT_DIR/concat.mp4"
echo "Concatenating scenes -> $CONCAT_OUT"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT_DIR/concat.txt" -c copy "$CONCAT_OUT"

# Burn in subtitles. ffmpeg's `subtitles` filter uses libass; on missing font, it falls back.
SUBS="scripts/demo-subtitles.srt"
if [ -f "$SUBS" ]; then
  echo "Burning in subtitles from $SUBS"
  ffmpeg -y -loglevel error \
    -i "$CONCAT_OUT" \
    -vf "subtitles=${SUBS}:force_style='Fontname=Noto Sans CJK JP,Fontsize=28,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Outline=2,Alignment=2,MarginV=60'" \
    -c:v libx264 -preset medium -crf 20 \
    -c:a copy \
    "$FINAL_OUT"
else
  echo "No subtitles file found at $SUBS; copying concat as final output."
  cp "$CONCAT_OUT" "$FINAL_OUT"
fi

echo ""
echo "Done. Output: $FINAL_OUT"
ffmpeg -i "$FINAL_OUT" 2>&1 | grep -E "Duration|Stream" || true

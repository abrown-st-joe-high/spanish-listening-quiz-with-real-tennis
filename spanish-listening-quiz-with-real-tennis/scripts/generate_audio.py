#!/usr/bin/env python3
"""
Batch-generate the sound files for a practice set instead of recording
each one by hand.

Uses edge-tts (Microsoft Edge's free neural voices) — natural-sounding,
no API key, no cost. Reads a module's JSON file, synthesizes the
"spoken" text for every item, and writes it to that module's audioPath
using the item's "id" as the filename — exactly what js/app.js expects.

Usage:
    pip install -r scripts/requirements.txt
    python scripts/generate_audio.py data/alphabet.json
    python scripts/generate_audio.py data/numbers.json --voice es-MX-JorgeNeural

List available Spanish voices:
    edge-tts --list-voices | grep es-

A few good options: es-ES-AlvaroNeural, es-ES-ElviraNeural,
es-MX-JorgeNeural, es-MX-DaliaNeural, es-US-AlonsoNeural.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("Missing dependency. Run: pip install -r scripts/requirements.txt")


async def generate_one(text: str, voice: str, out_path: Path, rate: str) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(str(out_path))


async def main(data_file: Path, voice: str, rate: str, overwrite: bool) -> None:
    module = json.loads(data_file.read_text(encoding="utf-8"))
    audio_dir = data_file.parent.parent / module["audioPath"]
    audio_dir.mkdir(parents=True, exist_ok=True)

    items = module["items"]
    print(f"Module: {module['title']}  ({len(items)} items)  voice: {voice}")
    print(f"Writing to: {audio_dir}")

    for item in items:
        out_path = audio_dir / f"{item['id']}.mp3"
        if out_path.exists() and not overwrite:
            print(f"  skip  {item['id']:<4} (exists)")
            continue
        await generate_one(item["spoken"], voice, out_path, rate)
        print(f"  made  {item['id']:<4} -> {out_path.name}  (\"{item['spoken']}\")")

    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate quiz audio files from a module JSON file.")
    parser.add_argument("data_file", type=Path, help="Path to a module JSON file, e.g. data/alphabet.json")
    parser.add_argument("--voice", default="es-ES-AlvaroNeural", help="edge-tts voice name")
    parser.add_argument("--rate", default="-8%", help="Speech rate adjustment, e.g. -8%% to slow down slightly")
    parser.add_argument("--overwrite", action="store_true", help="Regenerate files that already exist")
    args = parser.parse_args()

    asyncio.run(main(args.data_file, args.voice, args.rate, args.overwrite))

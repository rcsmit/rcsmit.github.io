#!/usr/bin/env python3
"""
generate_audio.py — version = "20260912-150000"

Genereert alle audiobestanden die de timer nodig heeft (0.wav t/m 60.wav,
hours/minutes/seconds.wav, hour/minute/second.wav enkelvoud, en beep.wav)
met de stem Emily uit Ierland via edge-tts.

Vereisten (eenmalig, op je eigen machine):
    pip install edge-tts
    ffmpeg moet geinstalleerd zijn en in PATH staan
        macOS:   brew install ffmpeg
        Windows: winget install ffmpeg   (of van ffmpeg.org)
        Linux:   sudo apt install ffmpeg

Gebruik:
    python3 generate_audio.py
    python3 generate_audio.py --out ../audio-numbers --rate +5%
    python3 generate_audio.py --voice en-IE-EmilyNeural --only 17,beep,hours

edge-tts levert audio altijd als mp3, ongeacht de extensie die je opgeeft.
Dit script vraagt daarom een mp3 op en converteert die met ffmpeg naar de
16-bit PCM wav die de browser rechtstreeks kan decoderen, met de stiltes
aan begin en eind weggesneden zodat de klok-app de klanken strak achter
elkaar kan plakken.
"""

from __future__ import annotations

import argparse
import asyncio
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit(
        "edge-tts is niet geinstalleerd.\n"
        "Installeer het met:  pip install edge-tts"
    )

DEFAULT_VOICE = "en-IE-EmilyNeural"   # Ierse, vrouwelijke neurale stem
DEFAULT_OUT = "audio-numbers"
MAX_PARALLEL = 4                       # gelijktijdige TTS-aanvragen
SAMPLE_RATE = 44100

ONES = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen",
]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty"]


def number_to_words(n: int) -> str:
    """0-60 als Engels woord. Alleen dit bereik komt in de timer voor."""
    if n < 0 or n > 60:
        raise ValueError(f"number_to_words is alleen bedoeld voor 0-60, kreeg {n}")
    if n < 20:
        return ONES[n]
    if n % 10 == 0:
        return TENS[n // 10]
    return f"{TENS[n // 10]}-{ONES[n % 10]}"


def build_clip_table() -> dict[str, str]:
    """Bestandsnaam (zonder extensie) -> tekst die uitgesproken moet worden."""
    clips: dict[str, str] = {str(n): number_to_words(n) for n in range(0, 61)}
    clips["hours"] = "hours"
    clips["minutes"] = "minutes"
    clips["seconds"] = "seconds"
    # Enkelvoud is optioneel in de app (app.js valt terug op het meervoud
    # als deze ontbreken), maar met deze erbij klinkt "1 minute" natuurlijk
    # in plaats van "1 minutes".
    clips["hour"] = "hour"
    clips["minute"] = "minute"
    clips["second"] = "second"
    # "beep" heeft geen tekst nodig — produce_one() genereert er een toon voor
    # in plaats van deze aan edge-tts te vragen.
    clips["beep"] = ""
    return clips


def check_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        sys.exit(
            "ffmpeg is niet gevonden in PATH.\n"
            "Installeer het (macOS: brew install ffmpeg, "
            "Windows: winget install ffmpeg, Linux: sudo apt install ffmpeg) "
            "en probeer het opnieuw."
        )


async def synthesize_mp3(text: str, voice: str, rate: str, pitch: str, mp3_path: Path) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(str(mp3_path))


def mp3_to_wav(mp3_path: Path, wav_path: Path) -> None:
    """
    Converteert naar mono 16-bit PCM wav en knipt stilte aan begin en eind
    weg, zodat de app.js-scheduler de clips zonder gaten achter elkaar kan
    afspelen.
    """
    silence_filter = (
        "silenceremove="
        "start_periods=1:start_duration=0.05:start_threshold=-45dB:"
        "detection=peak,"
        "areverse,"
        "silenceremove="
        "start_periods=1:start_duration=0.05:start_threshold=-45dB:"
        "detection=peak,"
        "areverse"
    )
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(mp3_path),
        "-af", silence_filter,
        "-ac", "1",
        "-ar", str(SAMPLE_RATE),
        "-sample_fmt", "s16",
        str(wav_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg faalde op {mp3_path.name}:\n{result.stderr}")


def make_beep(wav_path: Path, freq: int = 880, duration: float = 0.18) -> None:
    """
    Genereert een korte sinustoon met ffmpeg's ingebouwde signaalgenerator.
    Geen TTS-stem hiervoor nodig — een piep is geen gesproken woord.
    """
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "lavfi",
        "-i", f"sine=frequency={freq}:duration={duration}:sample_rate={SAMPLE_RATE}",
        "-af", "afade=t=out:st=0:d=0.03",
        "-ac", "1",
        "-sample_fmt", "s16",
        str(wav_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg faalde bij het genereren van beep.wav:\n{result.stderr}")


async def produce_one(
    name: str,
    text: str,
    voice: str,
    rate: str,
    pitch: str,
    out_dir: Path,
    tmp_dir: Path,
    semaphore: asyncio.Semaphore,
    force: bool,
) -> tuple[str, str | None]:
    wav_path = out_dir / f"{name}.wav"
    if wav_path.exists() and not force:
        return name, None

    if name == "beep":
        try:
            make_beep(wav_path)
            return name, None
        except Exception as exc:  # noqa: BLE001 — reported to the caller, not raised
            return name, str(exc)

    mp3_path = tmp_dir / f"{name}.mp3"
    async with semaphore:
        try:
            await synthesize_mp3(text, voice, rate, pitch, mp3_path)
            mp3_to_wav(mp3_path, wav_path)
            return name, None
        except Exception as exc:  # noqa: BLE001
            return name, str(exc)
        finally:
            mp3_path.unlink(missing_ok=True)


async def run(args: argparse.Namespace) -> int:
    check_ffmpeg()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    clips = build_clip_table()

    if args.only:
        wanted = {n.strip() for n in args.only.split(",") if n.strip()}
        unknown = wanted - clips.keys()
        if unknown:
            sys.exit(f"Onbekende clip-naam/namen: {', '.join(sorted(unknown))}")
        clips = {name: text for name, text in clips.items() if name in wanted}

    print(f"Stem:        {args.voice}")
    print(f"Snelheid:    {args.rate}   Toonhoogte: {args.pitch}")
    print(f"Doelmap:     {out_dir.resolve()}")
    print(f"Bestanden:   {len(clips)}")
    print()

    semaphore = asyncio.Semaphore(MAX_PARALLEL)
    failures: list[tuple[str, str]] = []
    done = 0
    total = len(clips)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        tasks = [
            produce_one(name, text, args.voice, args.rate, args.pitch, out_dir, tmp_dir, semaphore, args.force)
            for name, text in clips.items()
        ]
        for coro in asyncio.as_completed(tasks):
            name, error = await coro
            done += 1
            if error:
                failures.append((name, error))
                print(f"[{done}/{total}] FOUT   {name}.wav — {error}")
            else:
                print(f"[{done}/{total}] klaar  {name}.wav")

    print()
    if failures:
        print(f"{len(failures)} bestand(en) mislukt:")
        for name, error in failures:
            print(f"  - {name}: {error}")
        print("\nDraai het script opnieuw (bestaande, gelukte bestanden worden")
        print("overgeslagen tenzij je --force gebruikt) om alleen de mislukte")
        print("bestanden opnieuw te proberen, bijvoorbeeld:")
        print(f"  python3 {Path(sys.argv[0]).name} --only " + ",".join(n for n, _ in failures))
        return 1

    print("Alle bestanden gegenereerd.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--voice", default=DEFAULT_VOICE, help=f"edge-tts stemnaam (default: {DEFAULT_VOICE})")
    parser.add_argument("--out", default=DEFAULT_OUT, help=f"doelmap (default: ./{DEFAULT_OUT})")
    parser.add_argument("--rate", default="+0%", help="spreeksnelheid, bv. +10%% of -5%% (default: +0%%)")
    parser.add_argument("--pitch", default="+0Hz", help="toonhoogte, bv. +20Hz of -10Hz (default: +0Hz)")
    parser.add_argument("--only", default=None, help="komma-gescheiden lijst van clip-namen, bv. 17,beep,hours")
    parser.add_argument("--force", action="store_true", help="ook bestanden die al bestaan opnieuw genereren")
    return parser.parse_args()


if __name__ == "__main__":
    exit_code = asyncio.run(run(parse_args()))
    sys.exit(exit_code)

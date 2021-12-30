# ClaveScript

A browser-based environment for live-coding music.

# Development

ClaveScript is in early stages of development. The goal is to create a simple
programming language for controlling WebAudio synths and external synthesizers
through Web MIDI. It does not, in most cases, build static representations of
music but interprets programs (possibly multiple threads of execution) in sync
with music so that programs can react to external input (i.e. MIDI controllers)
with little delay.

Developed with Node.js version 14.5.0

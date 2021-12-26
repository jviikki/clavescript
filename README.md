# ClaveScript

A browser-based environment for live-coding music.

# Development

ClaveScript is in early stages of development. The goal is to create a simple
programming language for controlling WebAudio synths and external synthesizers
through Web MIDI. It does not build static representations of music but
evaluates programs (possibly multiple threads of execution) in real time so
that programs can react to external input (i.e. MIDI controllers) with little
delay.

Developed with Node.js version 14.5.0

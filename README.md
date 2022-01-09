# ClaveScript

A browser-based environment for live-coding music.

# What is it?

The goal is to create a simple programming language for controlling WebAudio
synths and external synthesizers through Web MIDI. It does not, in most cases,
build static representations of music but interprets programs (possibly
multiple threads of execution) in sync with music so that programs can react to
external input (i.e. MIDI controllers) with little delay.

# Example programs

The syntax (and semantics) is likely to change rapidly in the future. These
examples are here to give you an idea of what is currenly supported.

This program plays a random melody alternating between major and harmonic minor
scales. Also includes a simple bass line.

    tempo 100;

    base = 40;
    major = [0, 2, 4, 5, 7, 9, 11];
    harmonicMinor = [0, 2, 3, 5, 7, 8, 11];

    randomInteger = fun (maxVal) {
      return floor(rand() * maxVal);
    };

    craziness = fun() {
      coinToss = randomInteger(2);
      if (coinToss == 1)
        scale = major;
      else
        scale = harmonicMinor;

      for (i = 0; i < 32; i = i + 1) {
        note = randomInteger(len(scale));
        octave = randomInteger(3);
        play base + scale[note] + octave * 12;
        sleep 0.25;
      }
    };

    melody = seq {
      craziness();
    };

    loop melody;

    bass = seq {
      base = 40;

      play base;
      sleep 0.75;
      play base - 5;
      sleep 0.50;
      play base;
      sleep 0.50;
    };

    loop bass;

There's also a syntax for creating patterns that mimick traditional hardware
step sequencers.

tempo 100;

    pattern =
      step { x - x - x - x - x - x - x - x - x - x - x - x - x - x - x - | x = 88 } :=:
      step { x - x - - x - x - - x - x - - x - x - - x - x - - x - x - - | x = 44 } :=:
      step { x - - - - x x - - - - x x - - - - x x - - - - x x - - - - x | x = 25 } :+:

      step { x - x - x - x - x - x - x - x - x - x - x - x - x - x - x - | x = 88 } :=:
      step { x - x - - x - x - - x - x - - x - x - - x - x - - x - x - - | x = 44 } :=:
      step { x - - - - x x - - - - x x - - - - x x - - - - x x - - - - x | x = 25 };

    loop pattern;

# Copyright and license

    Copyright (C) 2021 Jarkko Viikki
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

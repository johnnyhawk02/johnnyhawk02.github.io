#!/bin/bash
# Builds the reference: the LXR-02 firmware's sound engine (C) plus harness.c, cross-compiled
# for the Cortex-M7 FPU, to run under qemu-arm-static. verify.mjs compares lxr.js against it.
#
#   ref/build.sh <path to a clone of erica-synths/lxr-desktop-app> [out=ref/ref_strict]
#
# Needs (Debian/Ubuntu): qemu-user-static gcc-arm-linux-gnueabihf libc6-dev-armhf-cross
set -e
LXR=$(cd "${1:?usage: ref/build.sh <lxr-desktop-app clone> [out]}" && pwd)
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=$(realpath -m "${2:-$HERE/ref_strict}")
B=$(mktemp -d)
CC="arm-linux-gnueabihf-gcc -mcpu=cortex-m7 -mthumb -mfpu=fpv5-d16 -mfloat-abi=hard -mfp16-format=ieee -DSTM32F765xx -DUSE_HAL_DRIVER -O2 -ffp-contract=off"
INC=""
for d in Core/Inc Drivers/STM32F7xx_HAL_Driver/Inc Drivers/CMSIS/Device/ST/STM32F7xx/Include Drivers/CMSIS/Include \
  FATFS/App FATFS/Target Middlewares/Third_Party/FatFs/src USB_DEVICE_MIDI/App USB_DEVICE_MIDI/Target \
  Middlewares/JS/STM32_USB_Device_Library/Core/Inc Middlewares/JS/STM32_USB_Device_Library/Class/CDC/Inc; do INC="$INC -I$LXR/$d"; done
S=$LXR/Core/Src/Soundengine
for f in DSPAudio/1PoleLp DSPAudio/CymbalVoice DSPAudio/Decay DSPAudio/distortion DSPAudio/DrumVoice DSPAudio/HiHat \
  DSPAudio/lfo DSPAudio/modulationNode DSPAudio/Oscillator DSPAudio/ResonantFilter DSPAudio/SlopeEg2 DSPAudio/Snare \
  DSPAudio/snapEg DSPAudio/transientGenerator DSPAudio/transientTables DSPAudio/wavetable DSPAudio/random DSPAudio/mixer \
  MIDI/MidiParser MIDI/ParameterArray; do
  $CC $INC -c $S/$f.c -o $B/$(basename $f).o
done
$CC $INC -c $LXR/Core/Src/Parameters.c -o $B/Parameters.o
$CC $INC -c $LXR/Core/Src/Preset/initKit.c -o $B/initKit.o
$CC $INC -c $HERE/harness.c -o $B/harness.o
$CC -c $HERE/stubs.c -o $B/stubs.o
# the objects are built for the M profile; strip the build attributes so glibc (A profile) links
for o in $B/*.o; do arm-linux-gnueabihf-objcopy --remove-section .ARM.attributes $o; done
arm-linux-gnueabihf-gcc -static $B/*.o -lm -o "$OUT"
rm -rf $B
echo "built $OUT"

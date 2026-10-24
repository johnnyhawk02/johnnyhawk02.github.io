// Reference harness: drives the original LXR sound engine code (cross-compiled for ARM,
// run under qemu) from a text script and dumps each voice's mono output blocks.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "Soundengine/config.h"
#include "Soundengine/DSPAudio/DrumVoice.h"
#include "Soundengine/DSPAudio/Snare.h"
#include "Soundengine/DSPAudio/HiHat.h"
#include "Soundengine/DSPAudio/CymbalVoice.h"
#include "Soundengine/DSPAudio/mixer.h"
#include "Soundengine/DSPAudio/modulationNode.h"
#include "Soundengine/MIDI/MidiParser.h"
#include "Soundengine/MIDI/ParameterArray.h"
#include "Soundengine/MIDI/MidiMessages.h"
#include "Soundengine/FxBus.h"
#include "Soundengine/Sequencer/sequencer.h"
#include "Parameters.h"
#include "Preset/InitKit.h"

// ---- stubs for firmware parts outside the sound engine ----
RNG_HandleTypeDef hrng;
static uint32_t rngState = 0x12345678u;
uint32_t HAL_RNG_GetRandomNumber(RNG_HandleTypeDef *h) { (void)h; uint32_t x = rngState; x ^= x << 13; x ^= x >> 17; x ^= x << 5; rngState = x; return x; }
float adc_getFaderVolume(uint8_t idx) { (void)idx; return 1.f; }
uint8_t activeParameters[NUM_PARAMS];
PatternSet seq_patternSet;
uint8_t frontParser_activeTrack;
volatile uint32_t systick_ticks;
uint8_t menu_activePage = 0;

extern uint8_t parameterOrder[END_OF_SOUND_PARAMETERS];
extern void mixer_decimateBlock(const uint8_t voiceNr, int16_t* buffer);

// trigger switch copied from voiceControl_noteOn (MidiVoiceControl.c)
void voiceControl_noteOn(uint8_t voice, uint8_t note, uint8_t vel)
{
	if(voice < 3) Drum_trigger(voice, vel, note);
	else if(voice < 4) Snare_trigger(vel, note);
	else if(voice < 5) Cymbal_trigger(vel, note);
	else HiHat_trigger(vel,voice-5,note);
}

// same dispatch as paramArray_setParameter, but as an incoming edit (updates originals)
static void setParam(uint16_t idx, uint8_t val)
{
	MidiMsg msg = {0};
	activeParameters[idx] = val;
	// PAR_NONE: the firmware would read the null parameter pointer here (address 0 is flash on
	// the STM32, so it's harmless there); it changes nothing, so skip it
	if(idx == 0) return;
	if(idx < 128) { msg.status = MIDI_CC; msg.data1 = (idx + 1) & 0x7f; }
	else { msg.status = MIDI_CC2; msg.data1 = (idx - 128) & 0x7f; }
	msg.data2 = val;
	midiParser_ccHandler(msg, 1, 0, 0.f);
}

// copy of mixer_calcNextSampleBlock without the GPIO reads: each voice's mono output, and the
// FX bus (voices routed to it, panned with their triggered pan) after FxBus_process
static void addToFxBus(int n, int16_t* data, float panL, float panR, int16_t* fxBuffer)
{
	if(mixer_audioRouting[n] != MIXER_ROUTING_FX_BUS) return;
	for(int i=0;i<OUTPUT_DMA_SIZE;i++)
	{
		int32_t y = *((int32_t*)fxBuffer);
		int32_t x = __PKHBT( (int16_t)(data[i] * panL), (int16_t)(data[i] * panR), 16);
		*((int32_t*)fxBuffer) = __QADD16(x, y);
		fxBuffer += 2;
	}
}
static void renderBlock(int16_t out[6][OUTPUT_DMA_SIZE], int16_t fxOut[OUTPUT_DMA_SIZE*2])
{
	modNode_resetTargets();
	modNode_reassignVeloMod();
	lfo_dispatchNextValue(&voiceArray[0].lfo);
	lfo_dispatchNextValue(&voiceArray[1].lfo);
	lfo_dispatchNextValue(&voiceArray[2].lfo);
	lfo_dispatchNextValue(&snareVoice.lfo);
	lfo_dispatchNextValue(&cymbalVoice.lfo);
	lfo_dispatchNextValue(&hatVoice.lfo);
	SVF_recalcFreq(&voiceArray[0].filter);
	SVF_recalcFreq(&voiceArray[1].filter);
	SVF_recalcFreq(&voiceArray[2].filter);
	SVF_recalcFreq(&snareVoice.filter);
	SVF_recalcFreq(&cymbalVoice.filter);
	SVF_recalcFreq(&hatVoice.filter);
	calcDrumVoiceAsync(0);
	calcDrumVoiceAsync(1);
	calcDrumVoiceAsync(2);
	Snare_calcAsync();
	Cymbal_calcAsync();
	HiHat_calcAsync();
	calcDrumVoiceSyncBlock(0, out[0], OUTPUT_DMA_SIZE); mixer_decimateBlock(0, out[0]);
	calcDrumVoiceSyncBlock(1, out[1], OUTPUT_DMA_SIZE); mixer_decimateBlock(1, out[1]);
	calcDrumVoiceSyncBlock(2, out[2], OUTPUT_DMA_SIZE); mixer_decimateBlock(2, out[2]);
	Snare_calcSyncBlock(out[3], OUTPUT_DMA_SIZE); mixer_decimateBlock(3, out[3]);
	Cymbal_calcSyncBlock(out[4], OUTPUT_DMA_SIZE); mixer_decimateBlock(4, out[4]);
	HiHat_calcSyncBlock(out[5], OUTPUT_DMA_SIZE); mixer_decimateBlock(5, out[5]);
	int16_t fxBusData[OUTPUT_DMA_SIZE*2];
	memset(fxBusData, 0, sizeof(fxBusData));
	memset(fxOut, 0, OUTPUT_DMA_SIZE*2*sizeof(int16_t));
	addToFxBus(0, out[0], voiceArray[0].triggeredPanL, voiceArray[0].triggeredPanR, fxBusData);
	addToFxBus(1, out[1], voiceArray[1].triggeredPanL, voiceArray[1].triggeredPanR, fxBusData);
	addToFxBus(2, out[2], voiceArray[2].triggeredPanL, voiceArray[2].triggeredPanR, fxBusData);
	addToFxBus(3, out[3], snareVoice.triggeredPanL, snareVoice.triggeredPanR, fxBusData);
	addToFxBus(4, out[4], cymbalVoice.triggeredPanL, cymbalVoice.triggeredPanR, fxBusData);
	addToFxBus(5, out[5], hatVoice.triggeredPanL, hatVoice.triggeredPanR, fxBusData);
	// FX output routed to a stereo pair (audioRouting 0 or 1): fxOut is that pair
	fxBus.audioRouting = MIXER_ROUTING_DAC2_STEREO;
	FxBus_process(fxBusData, &fxOut[0], &fxOut[1], &fxOut[0], &fxOut[1], OUTPUT_DMA_SIZE);
}

int main(int argc, char** argv)
{
#ifdef FLUSH_TO_ZERO
	{ uint32_t f; __asm volatile("vmrs %0, fpscr" : "=r"(f)); f |= (1u<<24); __asm volatile("vmsr fpscr, %0" :: "r"(f)); }
#endif
	FILE* out = fopen(argv[1], "wb");
	// soundengine_init() order
	mixer_init();
	FxBus_init();
	parameterArray_init();
	for(int i=0;i<6;i++) modNode_init(&velocityModulators[i]);
	initDrumVoice();
	Snare_init();
	HiHat_init();
	Cymbal_init();
	char cmd[16];
	while(scanf("%15s", cmd) == 1)
	{
		int a, b, c;
		if(!strcmp(cmd, "kit")) {
			// init kit, sent in the same order as preset loading
			for(int i=8;i<END_OF_SOUND_PARAMETERS;i++) activeParameters[i-8] = initKit[i];
			for(int i=0;i<END_OF_SOUND_PARAMETERS;i++) setParam(parameterOrder[i], activeParameters[parameterOrder[i]]);
		} else if(!strcmp(cmd, "p")) { scanf("%d %d", &a, &b); setParam(a, b); }
		else if(!strcmp(cmd, "vd")) { scanf("%d %d", &a, &b); modNode_setDestination(&velocityModulators[a], b); }
		else if(!strcmp(cmd, "lt")) { scanf("%d %d", &a, &b);
			Lfo* l = a < 3 ? &voiceArray[a].lfo : a == 3 ? &snareVoice.lfo : a == 4 ? &cymbalVoice.lfo : &hatVoice.lfo;
			modNode_setDestination(&l->modTarget, b); }
		else if(!strcmp(cmd, "t")) { scanf("%d %d %d", &a, &b, &c); voiceControl_noteOn(a, c, b); }
		else if(!strcmp(cmd, "seed")) { scanf("%u", &rngState); }
		else if(!strcmp(cmd, "r")) { scanf("%d", &a);
			for(int k=0;k<a;k++) { int16_t buf[6][OUTPUT_DMA_SIZE], fx[OUTPUT_DMA_SIZE*2]; renderBlock(buf, fx); fwrite(buf, sizeof(buf), 1, out); fwrite(fx, sizeof(fx), 1, out); } }
	}
	fclose(out);
	return 0;
}

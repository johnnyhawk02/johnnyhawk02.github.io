#include <stdio.h>
#include <stdint.h>
#include "Soundengine/DSPAudio/wavetable.h"
#include "Soundengine/DSPAudio/transientTables.h"
#include "Soundengine/MIDI/MidiNoteNumbers.h"
#include "Parameters.h"
#include "Preset/InitKit.h"
extern const uint8_t initKit[];
int main(){
  FILE*f;
  f=fopen("t_sine.bin","wb"); fwrite(sine_table,2,TABLESIZE+1,f); fclose(f);
  f=fopen("t_saw.bin","wb"); fwrite(sawTable,2,11*1024,f); fclose(f);
  f=fopen("t_rec.bin","wb"); fwrite(recTable,2,11*1024,f); fclose(f);
  f=fopen("t_tri.bin","wb"); fwrite(triTable,2,11*1024,f); fclose(f);
  f=fopen("t_trans.bin","wb"); fwrite(transientData,1,NUM_TRANSIENTS*TRANSIENT_SAMPLE_LENGTH,f); fclose(f);
  f=fopen("t_notes.bin","wb"); fwrite(MidiNoteFrequencies,4,128,f); fclose(f);
  f=fopen("t_kit.bin","wb"); fwrite(initKit,1,INIT_KIT_SIZE,f); fclose(f);
  f=fopen("t_order.bin","wb"); fwrite(parameterOrder,1,END_OF_SOUND_PARAMETERS,f); fclose(f);
  printf("%d notes\n",(int)(sizeof(MidiNoteFrequencies)/4));
}

// no-op stand-ins for firmware modules outside the sound engine
unsigned char menu_getActiveVoice() { return 0; }
unsigned char menu_getSubPage() { return 0; }
unsigned char menu_getViewedPattern() { return 0; }
void menu_repaint() {}
void menu_switchSubPage(unsigned char a, unsigned char b) {}
void seq_addNote() {}
unsigned short seq_getBpm() { return 120; }
unsigned char seq_getExtSync() { return 0; }
unsigned char seq_isRunning() { return 0; }
unsigned char seq_isTrackMuted(unsigned char v) { return 0; }
void seq_midiNoteOff() {}
void seq_recordAutomation() {}
void seq_sendMidiNoteOn() {}
void seq_setMute() {}
void seq_setNextPattern() {}
void seq_setRunning() {}
void seq_sync() {}
void sync_midiResetPosition() {}
void sync_midiStartStop() {}
void uart_sendFrontpanelByte() {}
void uart_sendMidi() {}
void usb_sendMidi() {}

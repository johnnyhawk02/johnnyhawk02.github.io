// Front-panel data for the prototype UI, extracted from the LXR V2 firmware menus
// (Core/Src/menu/menu.c parameter_dtypes, Core/Src/menu/Cc2Text.c modTargets). Generated, do not edit.

// display type of each sound parameter: 0B127, PM63 (shown -63..63), ON_OFF, 0b1, menu:<NAME>, ...
export const PARAM_DTYPES = {"0": "0B127", "1": "menu:WAVEFORM", "2": "menu:WAVEFORM", "3": "menu:WAVEFORM", "4": "menu:WAVEFORM", "5": "0B127", "6": "menu:WAVEFORM", "7": "menu:WAVEFORM", "8": "PM63", "9": "PM63", "10": "PM63", "11": "PM63", "12": "PM63", "13": "PM63", "14": "PM63", "15": "PM63", "16": "PM63", "17": "PM63", "18": "PM63", "19": "PM63", "20": "menu:WAVEFORM", "21": "menu:WAVEFORM", "22": "menu:WAVEFORM", "23": "menu:WAVEFORM", "24": "menu:WAVEFORM", "25": "menu:WAVEFORM", "26": "menu:WAVEFORM", "27": "0B127", "28": "0B127", "29": "PM63", "30": "PM63", "31": "0B127", "32": "0B127", "33": "PM63", "34": "PM63", "35": "0B127", "36": "0B127", "37": "0B127", "38": "0B127", "39": "0B127", "40": "0B127", "41": "0B127", "42": "0B127", "43": "0B127", "44": "0B127", "45": "0B127", "46": "0B127", "47": "0B127", "48": "0B127", "49": "0B127", "50": "0B127", "51": "0B127", "52": "0B127", "53": "0B127", "54": "0B127", "55": "0B127", "56": "0B127", "57": "0B127", "58": "0B127", "59": "0B127", "60": "0B127", "61": "0B127", "62": "0B127", "63": "0B127", "64": "0B127", "65": "0B127", "66": "0B127", "67": "0B127", "68": "0B127", "69": "0B127", "70": "0B127", "71": "0B127", "72": "0B127", "73": "0B127", "74": "0B127", "75": "0B127", "76": "0B127", "77": "0B127", "78": "0B127", "79": "0B127", "80": "0B127", "81": "0B127", "82": "0B127", "83": "PM63", "84": "0B127", "85": "PM63", "86": "0B127", "87": "PM63", "88": "0B127", "89": "0B127", "90": "0B127", "91": "0B127", "92": "0B127", "93": "0B127", "94": "PM63", "95": "PM63", "96": "PM63", "97": "0B127", "98": "0B127", "99": "PM63", "100": "PM63", "101": "PM63", "102": "0B127", "103": "0B127", "104": "0B127", "105": "0B127", "106": "0B127", "107": "0B127", "108": "0B127", "109": "0B127", "110": "0B127", "111": "0B127", "112": "0B127", "113": "0B127", "114": "0B127", "115": "0B127", "116": "0B127", "117": "0B127", "118": "0B127", "119": "0B127", "120": "0B127", "121": "0B127", "122": "0B127", "123": "0B127", "124": "0B127", "125": "0B127", "126": "0B127", "127": "0B127", "128": "0B127", "129": "0B127", "130": "0B127", "131": "0B127", "132": "0B127", "133": "0B127", "134": "menu:MIX_FM", "135": "menu:MIX_FM", "136": "menu:MIX_FM", "137": "ON_OFF", "138": "ON_OFF", "139": "ON_OFF", "140": "ON_OFF", "141": "ON_OFF", "142": "ON_OFF", "143": "0B127", "144": "0B127", "145": "0B127", "146": "0B127", "147": "0B127", "148": "0B127", "149": "TARGET_SELECTION_VELO", "150": "TARGET_SELECTION_VELO", "151": "TARGET_SELECTION_VELO", "152": "TARGET_SELECTION_VELO", "153": "TARGET_SELECTION_VELO", "154": "TARGET_SELECTION_VELO", "155": "menu:LFO_WAVES", "156": "menu:LFO_WAVES", "157": "menu:LFO_WAVES", "158": "menu:LFO_WAVES", "159": "menu:LFO_WAVES", "160": "menu:LFO_WAVES", "161": "VOICE_LFO", "162": "VOICE_LFO", "163": "VOICE_LFO", "164": "VOICE_LFO", "165": "VOICE_LFO", "166": "VOICE_LFO", "167": "TARGET_SELECTION_LFO", "168": "TARGET_SELECTION_LFO", "169": "TARGET_SELECTION_LFO", "170": "TARGET_SELECTION_LFO", "171": "TARGET_SELECTION_LFO", "172": "TARGET_SELECTION_LFO", "173": "menu:RETRIGGER", "174": "menu:RETRIGGER", "175": "menu:RETRIGGER", "176": "menu:RETRIGGER", "177": "menu:RETRIGGER", "178": "menu:RETRIGGER", "179": "menu:SYNC_RATES", "180": "menu:SYNC_RATES", "181": "menu:SYNC_RATES", "182": "menu:SYNC_RATES", "183": "menu:SYNC_RATES", "184": "menu:SYNC_RATES", "185": "0B127", "186": "0B127", "187": "0B127", "188": "0B127", "189": "0B127", "190": "0B127", "191": "menu:FILTER", "192": "menu:FILTER", "193": "menu:FILTER", "194": "menu:FILTER", "195": "menu:FILTER", "196": "menu:FILTER", "197": "0B127", "198": "0B127", "199": "0B127", "200": "0B127", "201": "0B127", "202": "0B127", "203": "menu:TRANS", "204": "menu:TRANS", "205": "menu:TRANS", "206": "menu:TRANS", "207": "menu:TRANS", "208": "menu:TRANS", "209": "0B127", "210": "0B127", "211": "0B127", "212": "0B127", "213": "0B127", "214": "0B127", "215": "menu:AUDIO_OUT", "216": "menu:AUDIO_OUT", "217": "menu:AUDIO_OUT", "218": "menu:AUDIO_OUT", "219": "menu:AUDIO_OUT", "220": "menu:AUDIO_OUT", "221": "NOTE_NAME", "222": "NOTE_NAME", "223": "NOTE_NAME", "224": "NOTE_NAME", "225": "NOTE_NAME", "226": "NOTE_NAME", "227": "NOTE_NAME", "228": "menu:FX", "229": "menu:AUDIO_OUT_FX", "230": "0B100", "231": "menu:DIST", "232": "0B127", "233": "0B127", "234": "0B127", "235": "0B127", "236": "menu:RATIO", "237": "menu:WAVEFORM", "238": "menu:REVERB", "239": "menu:DELAY", "240": "0B127", "241": "menu:ROLL_RATES", "242": "0B255", "243": "0B127", "244": "0B127", "245": "0B100", "246": "NOTE_NAME"};

// modTargets[]: what the velocity and LFO target menus offer. Parameter values of VEL_DEST_n and
// TARGET_LFOn are indices into this list. [label, parameter number]
export const MOD_TARGETS = [["EMPTY", 0], ["SAMPLE_RATE", 114], ["COARSE", 8], ["FINE", 9], ["WAVEFORM", 1], ["PWM", 228], ["ATTACK", 49], ["DECAY", 50], ["EG_SLOPE", 62], ["PITCH_DECAY", 70], ["EG_SLOPE", 78], ["MOD_AMOUNT", 74], ["VEL_DEST", 149], ["VEL_AMT", 143], ["VEL_MOD_VOL", 137], ["FM_AMOUNT", 82], ["FM_FREQ", 83], ["WAVEFORM", 20], ["MODE", 134], ["TRANSIENT_WAVE", 203], ["TRANSIENT_VOLUME", 197], ["TRANSIENT_FREQ", 209], ["FILTER_F", 37], ["FILTER_RESO", 43], ["FILTER_TYPE", 191], ["FILTER_DRIVE", 128], ["FREQ_LFO", 115], ["SYNC_LFO", 179], ["MOD_LFO", 121], ["WAVE_LFO", 155], ["RETRIGGER_LFO", 173], ["OFFSET_LFO", 185], ["VOLUME", 88], ["PAN", 94], ["SAMPLE_RATE", 108], ["DRIVE", 102], ["FX_P1", 238], ["FX_P2", 239], ["FX_P3", 240], ["FX_P4", 241], ["COARSE", 10], ["FINE", 11], ["WAVEFORM", 2], ["PWM", 229], ["ATTACK", 51], ["DECAY", 52], ["EG_SLOPE", 63], ["PITCH_DECAY", 71], ["EG_SLOPE", 79], ["MOD_AMOUNT", 75], ["VEL_DEST", 150], ["VEL_AMT", 144], ["VEL_MOD_VOL", 138], ["FM_AMOUNT", 84], ["FM_FREQ", 85], ["WAVEFORM", 21], ["MODE", 135], ["TRANSIENT_WAVE", 204], ["TRANSIENT_VOLUME", 198], ["TRANSIENT_FREQ", 210], ["FILTER_F", 38], ["FILTER_RESO", 44], ["FILTER_TYPE", 192], ["FILTER_DRIVE", 129], ["FREQ_LFO", 116], ["SYNC_LFO", 180], ["MOD_LFO", 122], ["WAVE_LFO", 156], ["RETRIGGER_LFO", 174], ["OFFSET_LFO", 186], ["VOLUME", 89], ["PAN", 95], ["SAMPLE_RATE", 109], ["DRIVE", 103], ["FX_P1", 238], ["FX_P2", 239], ["FX_P3", 240], ["FX_P4", 241], ["COARSE", 12], ["FINE", 13], ["WAVEFORM", 3], ["PWM", 230], ["ATTACK", 53], ["DECAY", 54], ["EG_SLOPE", 64], ["PITCH_DECAY", 72], ["EG_SLOPE", 80], ["MOD_AMOUNT", 76], ["VEL_DEST", 151], ["VEL_AMT", 145], ["VEL_MOD_VOL", 139], ["FM_AMOUNT", 86], ["FM_FREQ", 87], ["WAVEFORM", 22], ["MODE", 136], ["TRANSIENT_WAVE", 205], ["TRANSIENT_VOLUME", 199], ["TRANSIENT_FREQ", 211], ["FILTER_F", 39], ["FILTER_RESO", 45], ["FILTER_TYPE", 193], ["FILTER_DRIVE", 130], ["FREQ_LFO", 117], ["SYNC_LFO", 181], ["MOD_LFO", 123], ["WAVE_LFO", 157], ["RETRIGGER_LFO", 175], ["OFFSET_LFO", 187], ["VOLUME", 90], ["PAN", 96], ["SAMPLE_RATE", 110], ["DRIVE", 104], ["FX_P1", 238], ["FX_P2", 239], ["FX_P3", 240], ["FX_P4", 241], ["COARSE", 14], ["FINE", 15], ["NOISE", 27], ["MIX", 28], ["WAVEFORM", 4], ["PWM", 231], ["ATTACK", 55], ["DECAY", 56], ["REPEAT", 68], ["EG_SLOPE", 65], ["PITCH_DECAY", 73], ["EG_SLOPE", 81], ["MOD_AMOUNT", 77], ["VEL_DEST", 152], ["VEL_AMT", 146], ["VEL_MOD_VOL", 140], ["TRANSIENT_WAVE", 206], ["TRANSIENT_VOLUME", 200], ["TRANSIENT_FREQ", 212], ["FILTER_F", 40], ["FILTER_RESO", 46], ["FILTER_TYPE", 194], ["FILTER_DRIVE", 131], ["FREQ_LFO", 118], ["SYNC_LFO", 182], ["MOD_LFO", 124], ["WAVE_LFO", 158], ["RETRIGGER_LFO", 176], ["OFFSET_LFO", 188], ["VOLUME", 91], ["PAN", 99], ["SAMPLE_RATE", 111], ["DRIVE", 105], ["FX_P1", 238], ["FX_P2", 239], ["FX_P3", 240], ["FX_P4", 241], ["COARSE", 16], ["FINE", 17], ["WAVEFORM", 6], ["PWM", 232], ["ATTACK", 57], ["DECAY", 58], ["REPEAT", 69], ["EG_SLOPE", 66], ["VEL_DEST", 153], ["VEL_AMT", 147], ["VEL_MOD_VOL", 141], ["MOD_OSC1_FREQ", 29], ["MOD_OSC2_FREQ", 30], ["MOD_OSC1_GAIN", 31], ["MOD_OSC2_GAIN", 32], ["WAVEFORM", 23], ["WAVEFORM", 24], ["TRANSIENT_WAVE", 207], ["TRANSIENT_VOLUME", 201], ["TRANSIENT_FREQ", 213], ["FILTER_F", 41], ["FILTER_RESO", 47], ["FILTER_TYPE", 195], ["FILTER_DRIVE", 132], ["FREQ_LFO", 119], ["SYNC_LFO", 183], ["MOD_LFO", 125], ["WAVE_LFO", 159], ["RETRIGGER_LFO", 177], ["OFFSET_LFO", 189], ["VOLUME", 92], ["PAN", 100], ["SAMPLE_RATE", 112], ["DRIVE", 106], ["FX_P1", 238], ["FX_P2", 239], ["FX_P3", 240], ["FX_P4", 241], ["COARSE", 18], ["FINE", 19], ["WAVEFORM", 7], ["PWM", 233], ["ATTACK", 59], ["DECAY_CLOSED", 60], ["DECAY_OPEN", 61], ["EG_SLOPE", 67], ["VEL_DEST", 154], ["VEL_AMT", 148], ["VEL_MOD_VOL", 142], ["MOD_OSC1_FREQ", 33], ["MOD_OSC2_FREQ", 34], ["MOD_OSC1_GAIN", 35], ["MOD_OSC2_GAIN", 36], ["WAVEFORM", 25], ["WAVEFORM", 26], ["TRANSIENT_WAVE", 208], ["TRANSIENT_VOLUME", 202], ["TRANSIENT_FREQ", 214], ["FILTER_F", 42], ["FILTER_RESO", 48], ["FILTER_TYPE", 196], ["FILTER_DRIVE", 133], ["FREQ_LFO", 120], ["SYNC_LFO", 184], ["MOD_LFO", 126], ["WAVE_LFO", 160], ["RETRIGGER_LFO", 178], ["OFFSET_LFO", 190], ["VOLUME", 93], ["PAN", 101], ["SAMPLE_RATE", 113], ["DRIVE", 107], ["FX_P1", 238], ["FX_P2", 239], ["FX_P3", 240], ["FX_P4", 241]];
// first and last modTargets index of each voice (modTargetVoiceOffsets)
export const MOD_TARGET_VOICE_RANGES = [[2, 39], [40, 77], [78, 115], [116, 152], [153, 190], [191, 228]];

// the parameter pages of each voice, in front-panel order. [label, PAR name]
export const VOICE_PAGES = [
 {
  "name": "Drum 1",
  "groups": [
   {
    "name": "Oscillator",
    "params": [
     [
      "COARSE",
      "COARSE1"
     ],
     [
      "FINE",
      "FINE1"
     ],
     [
      "WAVEFORM",
      "OSC_WAVE_DRUM1"
     ],
     [
      "PWM",
      "PWM_1"
     ]
    ]
   },
   {
    "name": "Amp EG",
    "params": [
     [
      "ATTACK",
      "VELOA1"
     ],
     [
      "DECAY",
      "VELOD1"
     ],
     [
      "EG_SLOPE",
      "VOL_SLOPE1"
     ]
    ]
   },
   {
    "name": "Modulation",
    "params": [
     [
      "PITCH_DECAY",
      "MOD_EG1"
     ],
     [
      "EG_SLOPE",
      "PITCH_SLOPE1"
     ],
     [
      "MOD_AMOUNT",
      "MODAMNT1"
     ],
     [
      "VEL_DEST",
      "VEL_DEST_1"
     ],
     [
      "VEL_AMT",
      "VELO_MOD_AMT_1"
     ],
     [
      "VEL_MOD_VOL",
      "VOLUME_MOD_ON_OFF1"
     ]
    ]
   },
   {
    "name": "FM",
    "params": [
     [
      "FM_AMOUNT",
      "FMAMNT1"
     ],
     [
      "FM_FREQ",
      "FM_FREQ1"
     ],
     [
      "WAVEFORM",
      "MOD_WAVE_DRUM1"
     ],
     [
      "MODE",
      "MIX_MOD_1"
     ]
    ]
   },
   {
    "name": "transient sample",
    "params": [
     [
      "TRANSIENT_WAVE",
      "TRANS1_WAVE"
     ],
     [
      "TRANSIENT_VOLUME",
      "TRANS1_VOL"
     ],
     [
      "TRANSIENT_FREQ",
      "TRANS1_FREQ"
     ]
    ]
   },
   {
    "name": "filter",
    "params": [
     [
      "FILTER_F",
      "FILTER_FREQ_1"
     ],
     [
      "FILTER_RESO",
      "RESO_1"
     ],
     [
      "FILTER_TYPE",
      "FILTER_TYPE_1"
     ],
     [
      "FILTER_DRIVE",
      "FILTER_DRIVE_1"
     ]
    ]
   },
   {
    "name": "LFO",
    "params": [
     [
      "FREQ_LFO",
      "FREQ_LFO1"
     ],
     [
      "SYNC_LFO",
      "SYNC_LFO1"
     ],
     [
      "MOD_LFO",
      "AMOUNT_LFO1"
     ],
     [
      "WAVE_LFO",
      "WAVE_LFO1"
     ],
     [
      "RETRIGGER_LFO",
      "RETRIGGER_LFO1"
     ],
     [
      "OFFSET_LFO",
      "OFFSET_LFO1"
     ]
    ]
   },
   {
    "name": "MIX",
    "params": [
     [
      "VOLUME",
      "VOL1"
     ],
     [
      "PAN",
      "PAN1"
     ],
     [
      "SAMPLE_RATE",
      "VOICE_DECIMATION1"
     ],
     [
      "DRIVE",
      "DRIVE1"
     ]
    ]
   }
  ]
 },
 {
  "name": "drum 2",
  "groups": [
   {
    "name": "Oscillator",
    "params": [
     [
      "COARSE",
      "COARSE2"
     ],
     [
      "FINE",
      "FINE2"
     ],
     [
      "WAVEFORM",
      "OSC_WAVE_DRUM2"
     ],
     [
      "PWM",
      "PWM_2"
     ]
    ]
   },
   {
    "name": "Amp EG",
    "params": [
     [
      "ATTACK",
      "VELOA2"
     ],
     [
      "DECAY",
      "VELOD2"
     ],
     [
      "EG_SLOPE",
      "VOL_SLOPE2"
     ]
    ]
   },
   {
    "name": "Modulation",
    "params": [
     [
      "PITCH_DECAY",
      "MOD_EG2"
     ],
     [
      "EG_SLOPE",
      "PITCH_SLOPE2"
     ],
     [
      "MOD_AMOUNT",
      "MODAMNT2"
     ],
     [
      "VEL_DEST",
      "VEL_DEST_2"
     ],
     [
      "VEL_AMT",
      "VELO_MOD_AMT_2"
     ],
     [
      "VEL_MOD_VOL",
      "VOLUME_MOD_ON_OFF2"
     ]
    ]
   },
   {
    "name": "FM",
    "params": [
     [
      "FM_AMOUNT",
      "FMAMNT2"
     ],
     [
      "FM_FREQ",
      "FM_FREQ2"
     ],
     [
      "WAVEFORM",
      "MOD_WAVE_DRUM2"
     ],
     [
      "MODE",
      "MIX_MOD_2"
     ]
    ]
   },
   {
    "name": "transient sample",
    "params": [
     [
      "TRANSIENT_WAVE",
      "TRANS2_WAVE"
     ],
     [
      "TRANSIENT_VOLUME",
      "TRANS2_VOL"
     ],
     [
      "TRANSIENT_FREQ",
      "TRANS2_FREQ"
     ]
    ]
   },
   {
    "name": "filter",
    "params": [
     [
      "FILTER_F",
      "FILTER_FREQ_2"
     ],
     [
      "FILTER_RESO",
      "RESO_2"
     ],
     [
      "FILTER_TYPE",
      "FILTER_TYPE_2"
     ],
     [
      "FILTER_DRIVE",
      "FILTER_DRIVE_2"
     ]
    ]
   },
   {
    "name": "LFO",
    "params": [
     [
      "FREQ_LFO",
      "FREQ_LFO2"
     ],
     [
      "SYNC_LFO",
      "SYNC_LFO2"
     ],
     [
      "MOD_LFO",
      "AMOUNT_LFO2"
     ],
     [
      "WAVE_LFO",
      "WAVE_LFO2"
     ],
     [
      "RETRIGGER_LFO",
      "RETRIGGER_LFO2"
     ],
     [
      "OFFSET_LFO",
      "OFFSET_LFO2"
     ]
    ]
   },
   {
    "name": "MIX",
    "params": [
     [
      "VOLUME",
      "VOL2"
     ],
     [
      "PAN",
      "PAN2"
     ],
     [
      "SAMPLE_RATE",
      "VOICE_DECIMATION2"
     ],
     [
      "DRIVE",
      "DRIVE2"
     ]
    ]
   }
  ]
 },
 {
  "name": "drum 3",
  "groups": [
   {
    "name": "Oscillator",
    "params": [
     [
      "COARSE",
      "COARSE3"
     ],
     [
      "FINE",
      "FINE3"
     ],
     [
      "WAVEFORM",
      "OSC_WAVE_DRUM3"
     ],
     [
      "PWM",
      "PWM_3"
     ]
    ]
   },
   {
    "name": "Amp EG",
    "params": [
     [
      "ATTACK",
      "VELOA3"
     ],
     [
      "DECAY",
      "VELOD3"
     ],
     [
      "EG_SLOPE",
      "VOL_SLOPE3"
     ]
    ]
   },
   {
    "name": "Modulation",
    "params": [
     [
      "PITCH_DECAY",
      "MOD_EG3"
     ],
     [
      "EG_SLOPE",
      "PITCH_SLOPE3"
     ],
     [
      "MOD_AMOUNT",
      "MODAMNT3"
     ],
     [
      "VEL_DEST",
      "VEL_DEST_3"
     ],
     [
      "VEL_AMT",
      "VELO_MOD_AMT_3"
     ],
     [
      "VEL_MOD_VOL",
      "VOLUME_MOD_ON_OFF3"
     ]
    ]
   },
   {
    "name": "FM",
    "params": [
     [
      "FM_AMOUNT",
      "FMAMNT3"
     ],
     [
      "FM_FREQ",
      "FM_FREQ3"
     ],
     [
      "WAVEFORM",
      "MOD_WAVE_DRUM3"
     ],
     [
      "MODE",
      "MIX_MOD_3"
     ]
    ]
   },
   {
    "name": "transient sample",
    "params": [
     [
      "TRANSIENT_WAVE",
      "TRANS3_WAVE"
     ],
     [
      "TRANSIENT_VOLUME",
      "TRANS3_VOL"
     ],
     [
      "TRANSIENT_FREQ",
      "TRANS3_FREQ"
     ]
    ]
   },
   {
    "name": "filter",
    "params": [
     [
      "FILTER_F",
      "FILTER_FREQ_3"
     ],
     [
      "FILTER_RESO",
      "RESO_3"
     ],
     [
      "FILTER_TYPE",
      "FILTER_TYPE_3"
     ],
     [
      "FILTER_DRIVE",
      "FILTER_DRIVE_3"
     ]
    ]
   },
   {
    "name": "LFO",
    "params": [
     [
      "FREQ_LFO",
      "FREQ_LFO3"
     ],
     [
      "SYNC_LFO",
      "SYNC_LFO3"
     ],
     [
      "MOD_LFO",
      "AMOUNT_LFO3"
     ],
     [
      "WAVE_LFO",
      "WAVE_LFO3"
     ],
     [
      "RETRIGGER_LFO",
      "RETRIGGER_LFO3"
     ],
     [
      "OFFSET_LFO",
      "OFFSET_LFO3"
     ]
    ]
   },
   {
    "name": "MIX",
    "params": [
     [
      "VOLUME",
      "VOL3"
     ],
     [
      "PAN",
      "PAN3"
     ],
     [
      "SAMPLE_RATE",
      "VOICE_DECIMATION3"
     ],
     [
      "DRIVE",
      "DRIVE3"
     ]
    ]
   }
  ]
 },
 {
  "name": "snare/clap",
  "groups": [
   {
    "name": "Oscillator",
    "params": [
     [
      "COARSE",
      "COARSE4"
     ],
     [
      "FINE",
      "FINE4"
     ],
     [
      "NOISE",
      "NOISE_FREQ1"
     ],
     [
      "MIX",
      "MIX1"
     ],
     [
      "WAVEFORM",
      "OSC_WAVE_SNARE"
     ],
     [
      "PWM",
      "PWM_4"
     ]
    ]
   },
   {
    "name": "Amp EG",
    "params": [
     [
      "ATTACK",
      "VELOA4"
     ],
     [
      "DECAY",
      "VELOD4"
     ],
     [
      "REPEAT",
      "REPEAT4"
     ],
     [
      "EG_SLOPE",
      "VOL_SLOPE4"
     ]
    ]
   },
   {
    "name": "Modulation",
    "params": [
     [
      "PITCH_DECAY",
      "MOD_EG4"
     ],
     [
      "EG_SLOPE",
      "PITCH_SLOPE4"
     ],
     [
      "MOD_AMOUNT",
      "MODAMNT4"
     ],
     [
      "VEL_DEST",
      "VEL_DEST_4"
     ],
     [
      "VEL_AMT",
      "VELO_MOD_AMT_4"
     ],
     [
      "VEL_MOD_VOL",
      "VOLUME_MOD_ON_OFF4"
     ]
    ]
   },
   {
    "name": "FM (no entries)",
    "params": []
   },
   {
    "name": "transient sample",
    "params": [
     [
      "TRANSIENT_WAVE",
      "TRANS4_WAVE"
     ],
     [
      "TRANSIENT_VOLUME",
      "TRANS4_VOL"
     ],
     [
      "TRANSIENT_FREQ",
      "TRANS4_FREQ"
     ]
    ]
   },
   {
    "name": "filter",
    "params": [
     [
      "FILTER_F",
      "FILTER_FREQ_4"
     ],
     [
      "FILTER_RESO",
      "RESO_4"
     ],
     [
      "FILTER_TYPE",
      "FILTER_TYPE_4"
     ],
     [
      "FILTER_DRIVE",
      "FILTER_DRIVE_4"
     ]
    ]
   },
   {
    "name": "LFO",
    "params": [
     [
      "FREQ_LFO",
      "FREQ_LFO4"
     ],
     [
      "SYNC_LFO",
      "SYNC_LFO4"
     ],
     [
      "MOD_LFO",
      "AMOUNT_LFO4"
     ],
     [
      "WAVE_LFO",
      "WAVE_LFO4"
     ],
     [
      "RETRIGGER_LFO",
      "RETRIGGER_LFO4"
     ],
     [
      "OFFSET_LFO",
      "OFFSET_LFO4"
     ]
    ]
   },
   {
    "name": "MIX",
    "params": [
     [
      "VOLUME",
      "VOL4"
     ],
     [
      "PAN",
      "PAN4"
     ],
     [
      "SAMPLE_RATE",
      "VOICE_DECIMATION4"
     ],
     [
      "DRIVE",
      "SNARE_DISTORTION"
     ]
    ]
   }
  ]
 },
 {
  "name": "cymbal",
  "groups": [
   {
    "name": "Oscillator",
    "params": [
     [
      "COARSE",
      "COARSE5"
     ],
     [
      "FINE",
      "FINE5"
     ],
     [
      "WAVEFORM",
      "WAVE1_CYM"
     ],
     [
      "PWM",
      "PWM_5"
     ]
    ]
   },
   {
    "name": "Amp EG",
    "params": [
     [
      "ATTACK",
      "VELOA5"
     ],
     [
      "DECAY",
      "VELOD5"
     ],
     [
      "REPEAT",
      "REPEAT5"
     ],
     [
      "EG_SLOPE",
      "VOL_SLOPE5"
     ]
    ]
   },
   {
    "name": "Modulation",
    "params": [
     [
      "VEL_DEST",
      "VEL_DEST_5"
     ],
     [
      "VEL_AMT",
      "VELO_MOD_AMT_5"
     ],
     [
      "VEL_MOD_VOL",
      "VOLUME_MOD_ON_OFF5"
     ]
    ]
   },
   {
    "name": "FM",
    "params": [
     [
      "MOD_OSC1_FREQ",
      "MOD_OSC_F1_CYM"
     ],
     [
      "MOD_OSC2_FREQ",
      "MOD_OSC_F2_CYM"
     ],
     [
      "MOD_OSC1_GAIN",
      "MOD_OSC_GAIN1_CYM"
     ],
     [
      "MOD_OSC2_GAIN",
      "MOD_OSC_GAIN2_CYM"
     ],
     [
      "WAVEFORM",
      "WAVE2_CYM"
     ],
     [
      "WAVEFORM",
      "WAVE3_CYM"
     ]
    ]
   },
   {
    "name": "transient sample",
    "params": [
     [
      "TRANSIENT_WAVE",
      "TRANS5_WAVE"
     ],
     [
      "TRANSIENT_VOLUME",
      "TRANS5_VOL"
     ],
     [
      "TRANSIENT_FREQ",
      "TRANS5_FREQ"
     ]
    ]
   },
   {
    "name": "filter",
    "params": [
     [
      "FILTER_F",
      "FILTER_FREQ_5"
     ],
     [
      "FILTER_RESO",
      "RESO_5"
     ],
     [
      "FILTER_TYPE",
      "FILTER_TYPE_5"
     ],
     [
      "FILTER_DRIVE",
      "FILTER_DRIVE_5"
     ]
    ]
   },
   {
    "name": "LFO",
    "params": [
     [
      "FREQ_LFO",
      "FREQ_LFO5"
     ],
     [
      "SYNC_LFO",
      "SYNC_LFO5"
     ],
     [
      "MOD_LFO",
      "AMOUNT_LFO5"
     ],
     [
      "WAVE_LFO",
      "WAVE_LFO5"
     ],
     [
      "RETRIGGER_LFO",
      "RETRIGGER_LFO5"
     ],
     [
      "OFFSET_LFO",
      "OFFSET_LFO5"
     ]
    ]
   },
   {
    "name": "MIX",
    "params": [
     [
      "VOLUME",
      "VOL5"
     ],
     [
      "PAN",
      "PAN5"
     ],
     [
      "SAMPLE_RATE",
      "VOICE_DECIMATION5"
     ],
     [
      "DRIVE",
      "CYMBAL_DISTORTION"
     ]
    ]
   }
  ]
 },
 {
  "name": "HH open and closed",
  "groups": [
   {
    "name": "Oscillator",
    "params": [
     [
      "COARSE",
      "COARSE6"
     ],
     [
      "FINE",
      "FINE6"
     ],
     [
      "WAVEFORM",
      "WAVE1_HH"
     ],
     [
      "PWM",
      "PWM_6"
     ]
    ]
   },
   {
    "name": "Amp EG",
    "params": [
     [
      "ATTACK",
      "VELOA6"
     ],
     [
      "DECAY_CLOSED",
      "VELOD6_CLOSED"
     ],
     [
      "DECAY_OPEN",
      "VELOD6_OPEN"
     ],
     [
      "EG_SLOPE",
      "VOL_SLOPE6"
     ]
    ]
   },
   {
    "name": "Modulation",
    "params": [
     [
      "VEL_DEST",
      "VEL_DEST_6"
     ],
     [
      "VEL_AMT",
      "VELO_MOD_AMT_6"
     ],
     [
      "VEL_MOD_VOL",
      "VOLUME_MOD_ON_OFF6"
     ]
    ]
   },
   {
    "name": "FM",
    "params": [
     [
      "MOD_OSC1_FREQ",
      "MOD_OSC_F1"
     ],
     [
      "MOD_OSC2_FREQ",
      "MOD_OSC_F2"
     ],
     [
      "MOD_OSC1_GAIN",
      "MOD_OSC_GAIN1"
     ],
     [
      "MOD_OSC2_GAIN",
      "MOD_OSC_GAIN2"
     ],
     [
      "WAVEFORM",
      "WAVE2_HH"
     ],
     [
      "WAVEFORM",
      "WAVE3_HH"
     ]
    ]
   },
   {
    "name": "transient sample",
    "params": [
     [
      "TRANSIENT_WAVE",
      "TRANS6_WAVE"
     ],
     [
      "TRANSIENT_VOLUME",
      "TRANS6_VOL"
     ],
     [
      "TRANSIENT_FREQ",
      "TRANS6_FREQ"
     ]
    ]
   },
   {
    "name": "filter",
    "params": [
     [
      "FILTER_F",
      "FILTER_FREQ_6"
     ],
     [
      "FILTER_RESO",
      "RESO_6"
     ],
     [
      "FILTER_TYPE",
      "FILTER_TYPE_6"
     ],
     [
      "FILTER_DRIVE",
      "FILTER_DRIVE_6"
     ]
    ]
   },
   {
    "name": "LFO",
    "params": [
     [
      "FREQ_LFO",
      "FREQ_LFO6"
     ],
     [
      "SYNC_LFO",
      "SYNC_LFO6"
     ],
     [
      "MOD_LFO",
      "AMOUNT_LFO6"
     ],
     [
      "WAVE_LFO",
      "WAVE_LFO6"
     ],
     [
      "RETRIGGER_LFO",
      "RETRIGGER_LFO6"
     ],
     [
      "OFFSET_LFO",
      "OFFSET_LFO6"
     ]
    ]
   },
   {
    "name": "MIX",
    "params": [
     [
      "VOLUME",
      "VOL6"
     ],
     [
      "PAN",
      "PAN6"
     ],
     [
      "SAMPLE_RATE",
      "VOICE_DECIMATION6"
     ],
     [
      "DRIVE",
      "HAT_DISTORTION"
     ]
    ]
   }
  ]
 }
];

#!/usr/bin/env python3
"""Inline src/dsp.js and src/app.js into src/page.html and write index.html."""
import pathlib, re
here = pathlib.Path(__file__).parent
page = (here / 'src/page.html').read_text()
dsp = (here / 'src/dsp.js').read_text()
app = (here / 'src/app.js').read_text()
head = re.search(r'^(.*?</style>)', page, re.S).group(1)
body = page[len(head):].replace('/*DSP*/', dsp).replace('/*APP*/', app)
out = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       + head + '\n</head>\n<body>\n' + body + '\n</body>\n</html>\n')
(here / 'index.html').write_text(out)
print('wrote index.html', len(out), 'bytes')

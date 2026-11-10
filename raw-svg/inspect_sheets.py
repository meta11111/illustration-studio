from pathlib import Path
import xml.etree.ElementTree as ET
import re, collections, json

for path in Path(__file__).parent.glob('*.svg'):
    root=ET.parse(path).getroot()
    paths=list(root.iter('{http://www.w3.org/2000/svg}path'))
    fills=collections.Counter(n.attrib.get('fill') for n in paths)
    cmds=collections.Counter(c for n in paths for c in re.findall('[A-Za-z]',n.attrib.get('d','')))
    print(path.name, root.attrib, len(paths), fills, cmds)

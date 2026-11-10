from pathlib import Path
import json

root=Path(__file__).resolve().parent.parent
catalog=root/'src'/'catalog.js'
text=catalog.read_text(encoding='utf-8')
marker='export const subjects = '
start=text.index(marker)+len(marker)
subjects,end=json.JSONDecoder().raw_decode(text[start:])
prov=json.loads((root/'docs'/'asset-provenance.json').read_text(encoding='utf-8'))
bykey={(a['subjectId'],a['detailLevel'],a['role']):a for a in prov['assets']}
for s in subjects:
    for size,roles in s['variants'].items():
        for role,variant in roles.items():
            a=bykey[s['id'],size,role]
            variant['width']=a['width'];variant['height']=a['height'];variant['viewBox']=a['viewBox']
            variant['sourceWidth'],variant['sourceHeight']=a['sourceFigmaDimensions']
catalog.write_text(text[:start]+json.dumps(subjects,ensure_ascii=False,indent=2)+text[start+end:],encoding='utf-8')
print('Updated precise dimensions for',len(bykey),'SVG variants')

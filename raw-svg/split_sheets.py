from pathlib import Path
import re, math, json, hashlib, collections
from lxml import etree as ET

HERE=Path(__file__).resolve().parent
OUT=HERE.parent/'assets'
OUT.mkdir(exist_ok=True)
NS='http://www.w3.org/2000/svg'
SUBJECTS=['book','phone','puzzle','coin','headphones','lamp','flowers','wallet','folder','pen']
# Exact top-left coordinates from original Figma groups; sheets are exports of these selections.
POS={
 'L-main':[(391.64404296875,3467.37353515625),(2038.5771484375,3718.638671875),(3100.243408203125,3827.740478515625),(4005.3037109375,3945.818603515625),(470.02294921875,4803.08837890625),(1822.2294921875,4438.755859375),(3036.019775390625,4712.71728515625),(3868.261962890625,5095.10791015625),(365.2724609375,5920.17626953125),(1795.79638671875,6127.6298828125)],
 'L-background':[(391.64404296875,7491.5576171875),(2038.5771484375,7742.82275390625),(3100.243408203125,7851.9248046875),(4005.3037109375,7970.0029296875),(470.02294921875,8827.2724609375),(1822.2294921875,8462.939453125),(3060.913818359375,8797.6005859375),(3868.261962890625,9119.2919921875),(365.2724609375,9944.3603515625),(1795.79638671875,10151.814453125)],
 'S-main':[(268.388671875,2060.38916015625),(1294.231201171875,2253.164794921875),(1925.3394775390625,2284.115966796875),(2498.228515625,2339.800048828125),(374.8585205078125,2935.981201171875),(1192.001953125,2818.2666015625),(1918.9129638671875,2948.58447265625),(2399.5,3187.647216796875),(261.270263671875,3741.49169921875),(1298.056396484375,3857.53564453125)],
 'S-background':[(268.388671875,5161.7958984375),(1294.231201171875,5354.57177734375),(1925.3394775390625,5385.5224609375),(2498.228515625,5441.20703125),(374.8585205078125,6037.3876953125),(1192.001953125,5919.67333984375),(1891.2703857421875,6051.97998046875),(2399.5,6289.0537109375),(261.270263671875,6842.8984375),(1298.056396484375,6958.9423828125)]
}
DIM={
 'L':[(1445.892578125,976.664306640625),(796.5315551757812,461.6672058105469),(544.1632080078125,313.5343322753906),(286.6768798828125,188.50100708007812),(888.14990234375,691.54150390625),(945.9432373046875,1128.9852294921875),(590.5732421875,747.1065063476562),(630.41552734375,396.309814453125),(1240.61865234375,658.5882568359375),(508.42822265625,285.4002380371094)],
 'S':[(722.9462890625,488.3321228027344),(398.2657470703125,230.83363342285156),(272.08160400390625,156.7671661376953),(152.3905029296875,100.20225524902344),(444.074951171875,345.770751953125),(472.9715881347656,564.4925537109375),(323.2647399902344,408.94677734375),(315.207763671875,198.1549835205078),(620.3094482421875,329.29412841796875),(254.214111328125,142.7001190185547)]
}
NODE_IDS={
 'L-main':['21:29965','21:25472','21:417','24:2207','23:122','23:121','28:11628','23:211','24:1899','24:1734'],
 'L-background':['24:6273','24:6327','24:6214','24:6795','24:6484','24:6569','30:11902','24:6660','24:6772','24:6747'],
 'S-main':['24:3810','24:4746','24:4903','24:5345','24:5089','24:5485','28:11629','24:4594','24:4430','24:4287'],
 'S-background':['24:6934','24:6990','24:7147','24:7205','24:7344','24:7429','28:11766','24:7568','24:7520','24:7543']
}

def cubic(p0,p1,p2,p3,t):
    return (1-t)**3*p0+3*(1-t)**2*t*p1+3*(1-t)*t*t*p2+t**3*p3

def extrema(p0,p1,p2,p3):
    a=-p0+3*p1-3*p2+p3;b=2*(p0-2*p1+p2);c=p1-p0
    ts=[]
    if abs(a)<1e-12:
        if abs(b)>1e-12: ts=[-c/b]
    else:
        disc=b*b-4*a*c
        if disc>=0:ts=[(-b+math.sqrt(disc))/(2*a),(-b-math.sqrt(disc))/(2*a)]
    return [cubic(p0,p1,p2,p3,t) for t in ts if 0<t<1]

def bounds(d):
    tokens=re.findall(r'[MLCHVZmlchvz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?',d)
    i=0;x=y=sx=sy=0;cmd=None;xs=[];ys=[]
    while i<len(tokens):
        if tokens[i].isalpha():
            cmd=tokens[i];i+=1
            if cmd=='Z':x,y=sx,sy;xs.append(x);ys.append(y);continue
        if cmd in ('M','L'):
            x,y=map(float,tokens[i:i+2]);i+=2;xs.append(x);ys.append(y)
            if cmd=='M':sx,sy=x,y;cmd='L'
        elif cmd=='H':x=float(tokens[i]);i+=1;xs.append(x);ys.append(y)
        elif cmd=='V':y=float(tokens[i]);i+=1;xs.append(x);ys.append(y)
        elif cmd=='C':
            x1,y1,x2,y2,x3,y3=map(float,tokens[i:i+6]);i+=6
            xs.extend([x,x3]+extrema(x,x1,x2,x3));ys.extend([y,y3]+extrema(y,y1,y2,y3));x,y=x3,y3
        else:raise ValueError('Unsupported path command '+str(cmd))
    return min(xs),min(ys),max(xs),max(ys)

def union(boxes):return [min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]

report={'sourceFileKey':'Vc5WqbTfcR32TaVNrmEAZm','method':'Exact raw primitive partition by original Figma spatial bounds. Original d/paint attributes preserved; only standalone root viewBox and dimensions added.','sheets':[],'assets':[]}
for sheet,positions in POS.items():
    source=HERE/(sheet+'.svg');raw=source.read_bytes();root=ET.fromstring(raw)
    size,role=sheet.split('-');ox=min(p[0] for p in positions);oy=min(p[1] for p in positions)
    expected={s:(x-ox,y-oy,x-ox+w,y-oy+h) for s,(x,y),(w,h) in zip(SUBJECTS,positions,DIM[size])}
    buckets={s:[] for s in SUBJECTS};boxsets={s:[] for s in SUBJECTS}
    for index,n in enumerate(root):
        if ET.QName(n).localname!='path':raise ValueError('Unexpected sheet element '+n.tag)
        b=bounds(n.attrib['d']);cx=(b[0]+b[2])/2;cy=(b[1]+b[3])/2
        candidates=[s for s,(x0,y0,x1,y1) in expected.items() if x0-1<=cx<=x1+1 and y0-1<=cy<=y1+1]
        if len(candidates)!=1:raise ValueError(f'{sheet} primitive {index} bbox {b}: ambiguous {candidates}')
        sid=candidates[0];buckets[sid].append(n);boxsets[sid].append(b)
    sheet_info={'file':'raw-svg/'+source.name,'sha256':hashlib.sha256(raw).hexdigest(),'pathCount':len(root),'origin':[ox,oy],'counts':{s:len(buckets[s]) for s in SUBJECTS}}
    report['sheets'].append(sheet_info)
    for idx,sid in enumerate(SUBJECTS):
        if not buckets[sid]:raise ValueError('Empty subject '+sid)
        # Tight exact bounds keep every primitive and the source coordinate system. No clipping.
        b=union(boxsets[sid]);padding=0.02;x0,y0,x1,y1=b
        x0-=padding;y0-=padding;x1+=padding;y1+=padding;w=x1-x0;h=y1-y0
        out=ET.Element('{'+NS+'}svg',nsmap={None:NS},attrib={'width':format(w,'.12g'),'height':format(h,'.12g'),'viewBox':' '.join(format(v,'.12g') for v in (x0,y0,w,h)),'fill':root.attrib.get('fill','none')})
        for n in buckets[sid]:out.append(n)
        payload=ET.tostring(out,encoding='UTF-8',xml_declaration=False,pretty_print=True)
        filename=f'{sid}-{size}-{role}.svg';(OUT/filename).write_bytes(payload)
        report['assets'].append({'subjectId':sid,'detailLevel':size,'role':role,'nodeId':NODE_IDS[sheet][idx],'sourceSheet':'raw-svg/'+source.name,'file':'assets/'+filename,'sourcePrimitiveCount':len(buckets[sid]),'sha256':hashlib.sha256(payload).hexdigest(),'viewBox':[x0,y0,w,h],'width':w,'height':h,'sourceFigmaDimensions':list(DIM[size][idx]),'sourcePathBounds':b})
    print(sheet, len(root), sheet_info['counts'])
(HERE.parent/'docs'/'asset-provenance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Extracted',len(report['assets']),'original SVG objects')

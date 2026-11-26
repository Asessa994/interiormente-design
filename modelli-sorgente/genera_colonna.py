"""Modello originale parametrico. Eseguire: blender -b --python genera_colonna.py
Il GLB è una colonna ionica stilizzata, non una scansione archeologica.
"""
import bpy, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '../public/interiormente/models'))
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metal=0, rough=.42):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    return m

marble=material('Marmo bianco',(.88,.865,.82))
gold=material('Oro satinato',(.68,.40,.11),.85,.28)

def finish(obj,name,mat,bevel=0):
    obj.name=name; obj.data.materials.append(mat)
    if bevel:
        m=obj.modifiers.new('Spigoli ammorbiditi','BEVEL');m.width=bevel;m.segments=2
        m=obj.modifiers.new('Normali','WEIGHTED_NORMAL')
    if obj.type=='MESH':
        for p in obj.data.polygons:p.use_smooth=True
    return obj

def box(name,loc,scale,mat,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,bevel)

def lathe(name,profile,mat,n=96):
    verts=[(r*math.cos(i*2*math.pi/n),r*math.sin(i*2*math.pi/n),z)
           for z,r in profile for i in range(n)]
    faces=[]
    for j in range(len(profile)-1):
        for i in range(n):
            k=j*n+i;kn=j*n+(i+1)%n
            faces.append((k,kn,kn+n,k+n))
    faces.append(tuple(reversed(range(n))))
    faces.append(tuple((len(profile)-1)*n+i for i in range(n)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    uv=mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            vi=mesh.loops[li].vertex_index;j,i=divmod(vi,n)
            uv.data[li].uv=(i/n,profile[j][0]/5.4)
    return finish(obj,name,mat)

box('Plinto', (0,0,.09),(1.14,1.14,.18),marble)
lathe('Base attica',[(.18,.55),(.20,.56),(.25,.57),(.29,.53),(.31,.49),(.34,.49),(.38,.51),(.42,.49),(.47,.44)],marble)
lathe('Filetto oro base',[(.31,.492),(.332,.492)],gold)

n=192; rows=18;verts=[];faces=[]
for j in range(rows+1):
    t=j/rows;z=.46+4.03*t
    radius=.435-.065*t+.014*math.sin(math.pi*t)
    for i in range(n):
        a=2*math.pi*i/n
        r=radius-.024*(.5+.5*math.cos(24*a))
        verts.append((r*math.cos(a),r*math.sin(a),z))
for j in range(rows):
    for i in range(n):
        k=j*n+i;q=j*n+(i+1)%n
        faces.append((k,q,q+n,k+n))
mesh=bpy.data.meshes.new('Scanalature');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Fusto 24 scanalature',mesh);bpy.context.collection.objects.link(o)
uv=mesh.uv_layers.new(name='UVMap')
for p in mesh.polygons:
    for li in p.loop_indices:
        j,i=divmod(mesh.loops[li].vertex_index,n)
        uv.data[li].uv=(i/n,j/rows)
finish(o,o.name,marble)
lathe('Collarino',[(4.47,.37),(4.51,.39),(4.55,.42),(4.60,.43),(4.66,.44),(4.70,.48)],marble)
lathe('Filetto oro capitello',[(4.57,.433),(4.592,.433)],gold)
box('Echino',(0,0,4.78),(1.12,.72,.20),marble,.06)

def tube(name,points,radius,mat):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1
    c.bevel_depth=radius;c.bevel_resolution=3
    sp=c.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
    return o

for side in [-1,1]:
    for front in [-1,1]:
        cx=.48*side;cy=.37*front;cz=4.94
        pts=[]
        for i in range(145):
            t=i/144;a=t*math.pi*4.5;rr=.285*(1-t)+.026
            pts.append((cx+side*rr*math.cos(a),cy,cz+rr*.79*math.sin(a)))
        tube('Voluta',pts,.060,marble)
        tube('Bordo oro voluta',[(x,y+front*.049,z) for x,y,z in pts],.008,gold)
box('Abaco inferiore',(0,0,5.20),(1.48,.88,.10),marble)
box('Lama oro',(0,0,5.267),(1.50,.90,.025),gold,.008)
box('Abaco superiore',(0,0,5.33),(1.57,.95,.10),marble)

# Mesh reali esportabili, origine alla base.
for o in list(bpy.context.scene.objects):
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    if o.type=='CURVE':bpy.ops.object.convert(target='MESH')
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'colonna-ionica.glb'),export_format='GLB',use_selection=True,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE,'colonna-ionica.blend'))
print('MODELLO_ORIGINALE_COMPLETATO')

# Secondo asset: un portale ad arco, indipendente dalla colonna.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
dark=material('Pietra nera',(.035,.032,.028),0,.55)
for x in [-1.95,1.95]:
    box('Piedritto',(x,0,1.6),(.6,.72,3.2),dark,.025)
verts=[];faces=[];steps=64
for y in [-.36,.36]:
    for r in [1.65,2.25]:
        for i in range(steps+1):
            a=math.pi*i/steps
            verts.append((r*math.cos(a),y,3.2+r*math.sin(a)))
stride=steps+1
for i in range(steps):
    for a,b,reverse in [(0,stride,True),(2*stride,3*stride,False),(0,2*stride,False),(stride,3*stride,True)]:
        f=(a+i,a+i+1,b+i+1,b+i)
        faces.append(tuple(reversed(f)) if reverse else f)
for i in [0,steps]:faces.append((i,stride+i,3*stride+i,2*stride+i))
m=bpy.data.meshes.new('Arco');m.from_pydata(verts,[],faces);m.update()
o=bpy.data.objects.new('Arco',m);bpy.context.collection.objects.link(o);finish(o,'Arco',dark)
points=[(-1.66,-.375,0),(-1.66,-.375,3.2)]
points += [(1.66*math.cos(math.pi-i*math.pi/80),-.375,3.2+1.66*math.sin(math.pi-i*math.pi/80)) for i in range(81)]
points += [(1.66,-.375,0)]
tube('Profilo oro portale',points,.012,gold)
for o in list(bpy.context.scene.objects):
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    if o.type=='CURVE':bpy.ops.object.convert(target='MESH')
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'portale.glb'),export_format='GLB',use_selection=True,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE,'portale.blend'))

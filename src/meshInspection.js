// Static, world-space mesh surface crossing inspector for THREE.BufferGeometry.
// NOT a robust 3D collision engine: no containment certification, no swept motion,
// no contact normals, no tolerances, no GPU physics, no closed-manifold guarantee.
const triBox=(a,b,c)=>({
  min:[Math.min(a[0],b[0],c[0]),Math.min(a[1],b[1],c[1]),Math.min(a[2],b[2],c[2])],
  max:[Math.max(a[0],b[0],c[0]),Math.max(a[1],b[1],c[1]),Math.max(a[2],b[2],c[2])]
});
function intersects(a,b,eps=1e-7){
  for(let i=0;i<3;i++) if(a.max[i]<b.min[i]-eps||b.max[i]<a.min[i]-eps)return false;
  return true;
}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function segmentHitsTriangle(a,b,t,eps=1e-7){
  const ab=sub(b,a),p=t.points[0],e1=sub(t.points[1],p),e2=sub(t.points[2],p);
  const h=cross(ab,e2),det=dot(e1,h);
  if(Math.abs(det)<eps)return false; // coplanar/parallel not proven clear
  const inv=1/det,s=sub(a,p),u=dot(s,h)*inv;
  if(u < -eps || u > 1+eps)return false;
  const q=cross(s,e1),v=dot(ab,q)*inv;
  if(v < -eps || u+v > 1+eps)return false;
  const distance=dot(e2,q)*inv;
  return distance>=-eps && distance<=1+eps;
}
function crossing(a,b) {
  for(let i=0;i<3;i++){
    if(segmentHitsTriangle(a.points[i],a.points[(i+1)%3],b))return true;
    if(segmentHitsTriangle(b.points[i],b.points[(i+1)%3],a))return true;
  }
  return false;
}
function getTriangles(mesh, THREE,maxTriangles){
  const g=mesh.geometry,attr=g?.getAttribute('position');
  if(!attr)return {triangles:[],overflow:true};
  const idx=g.index;
  const count=idx?Math.floor(idx.count/3):Math.floor(attr.count/3);
  if(count>maxTriangles)return {triangles:[],overflow:true};
  mesh.updateWorldMatrix(true,false);
  const triangles=[];
  const v=new THREE.Vector3();
  for(let i=0;i<count;i++){
    const points=[];
    for(let k=0;k<3;k++){
      const vertex=idx?idx.getX(i*3+k):i*3+k;
      v.fromBufferAttribute(attr,vertex).applyMatrix4(mesh.matrixWorld);
      points.push([v.x,v.y,v.z]);
    }
    triangles.push({points,box:triBox(...points)});
  }
  return {triangles,overflow:false};
}
export function scanMeshSurfaces(THREE,entries,{
  maxTrianglesPerMesh=1800,maxTriangleComparisons=500000
}={}){
  if(!Array.isArray(entries)||entries.length>24)throw Error('Mesh scan limited to 24 components.');
  const items=entries.map(({id,mesh})=>{
    if(!mesh?.isMesh || typeof id!=='string')throw Error('Invalid mesh item');
    const bounds=new THREE.Box3().setFromObject(mesh);
    return {id,mesh,bounds,...getTriangles(mesh,THREE,maxTrianglesPerMesh)};
  });
  const crossings=[],inconclusive=[];
  let candidatePairs=0,comparisons=0,budgetExhausted=false;
  for(let i=0;i<items.length;i++){
    for(let j=i+1;j<items.length;j++){
      const a=items[i],b=items[j];
      if(!a.bounds.intersectsBox(b.bounds))continue;
      candidatePairs++;
      if(a.overflow||b.overflow||budgetExhausted){
        inconclusive.push({a:a.id,b:b.id,reason:'Mesh resolution or comparison budget exceeded.'});continue;
      }
      let hit=false;
      outer:for(const t of a.triangles){
        if(!intersects(t.box,{min:[b.bounds.min.x,b.bounds.min.y,b.bounds.min.z],
          max:[b.bounds.max.x,b.bounds.max.y,b.bounds.max.z]}))continue;
        for(const u of b.triangles) {
          if(!intersects(t.box,u.box))continue;
          comparisons++;
          if(comparisons>maxTriangleComparisons){
            budgetExhausted=true;break outer;
          }
          if(crossing(t,u)){hit=true;break outer;}
        }
      }
      if(hit)crossings.push({a:a.id,b:b.id});
      else inconclusive.push({a:a.id,b:b.id,
        reason:budgetExhausted?'Comparison budget exceeded.':
          'Overlapping mesh bounds, but no noncoplanar surface-edge crossing found; containment/coplanar contact untested.'});
    }
  }
  return {method:'triangle-edge-surface-screen-v1',candidatePairs,comparisons,
    crossings,inconclusive,budgetExhausted,
    disclaimer:'Only rest-pose triangle-edge surface crossings checked. Interpenetrating enclosed objects, coplanar touching faces, continuous-time collisions and full physical safety are NOT established.'};
}

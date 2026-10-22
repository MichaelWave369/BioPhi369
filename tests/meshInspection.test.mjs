import test from 'node:test';
import assert from 'node:assert/strict';
import { scanMeshSurfaces } from '../src/meshInspection.js';

// Minimal world-coordinate THREE adapters: tests do not depend on CDN modules.
class Vector3 {
  fromBufferAttribute(attr,index){this.x=attr.getX(index);this.y=attr.getY(index);this.z=attr.getZ(index);return this;}
  applyMatrix4(){return this;}
}
class Box3 {
  setFromObject(mesh){
    const attr=mesh.geometry.getAttribute('position');
    const coordinates=Array.from({length:attr.count},(_,i)=>[attr.getX(i),attr.getY(i),attr.getZ(i)]);
    this.min={x:Math.min(...coordinates.map(x=>x[0])),y:Math.min(...coordinates.map(x=>x[1])),z:Math.min(...coordinates.map(x=>x[2]))};
    this.max={x:Math.max(...coordinates.map(x=>x[0])),y:Math.max(...coordinates.map(x=>x[1])),z:Math.max(...coordinates.map(x=>x[2]))};
    return this;
  }
  intersectsBox(other){
    return this.min.x<=other.max.x&&this.max.x>=other.min.x&&
      this.min.y<=other.max.y&&this.max.y>=other.min.y&&
      this.min.z<=other.max.z&&this.max.z>=other.min.z;
  }
}
const THREE={Vector3,Box3};
function triangle(id,points){
  const attr={
    count:points.length,
    getX:i=>points[i][0],getY:i=>points[i][1],getZ:i=>points[i][2]
  };
  return {id,mesh:{isMesh:true,matrixWorld:null,updateWorldMatrix(){},geometry:{
    index:null,getAttribute:name=>name==='position'?attr:null
  }}};
}
const flat=triangle('flat',[[-1,-1,0],[1,-1,0],[0,1,0]]);
const crosses=triangle('cross',[[0,-.5,-1],[0,-.5,1],[0,.5,1]]);
const far=triangle('far',[[0,0,5],[0,1,5],[1,0,5]]);
const coplanar=triangle('coplanar',[[0,-.2,0],[.2,-.2,0],[0,.2,0]]);

test('World-space triangle-edge crossing is reported as a surface intersection',()=>{
  const check=scanMeshSurfaces(THREE,[flat,crosses]);
  assert.equal(check.candidatePairs,1);
  assert.equal(check.crossings.length,1);
  assert.deepEqual(check.crossings[0],{a:'flat',b:'cross'});
  assert.equal(check.budgetExhausted,false);
});

test('Broad-phase rejects clearly separated meshes without unnecessary narrow tests',()=>{
  const check=scanMeshSurfaces(THREE,[flat,far]);
  assert.equal(check.candidatePairs,0);
  assert.deepEqual(check.crossings,[]);
  assert.equal(check.comparisons,0);
});

test('Coplanar overlap is explicitly inconclusive, not a certificate of clearance',()=>{
  const check=scanMeshSurfaces(THREE,[flat,coplanar]);
  assert.equal(check.candidatePairs,1);
  assert.equal(check.crossings.length,0);
  assert.equal(check.inconclusive.length,1);
  assert.match(check.disclaimer,/NOT established/);
});

test('Budget exhaustion fails open as inconclusive, never success',()=>{
  const check=scanMeshSurfaces(THREE,[flat,crosses],{maxTriangleComparisons:0});
  assert.equal(check.crossings.length,0);
  assert.equal(check.inconclusive.length,1);
  assert.equal(check.budgetExhausted,true);
});

test('Out-of-limit meshes are not silently skipped as collision-free',()=>{
  const check=scanMeshSurfaces(THREE,[flat,crosses],{maxTrianglesPerMesh:0});
  assert.equal(check.crossings.length,0);
  assert.equal(check.inconclusive.length,1);
});

test('Reject more than 24 components before expensive geometry processing',()=>{
  assert.throws(()=>scanMeshSurfaces(THREE,Array(25).fill(flat)),/limited to 24/);
});

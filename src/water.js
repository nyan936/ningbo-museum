// water.js —— 环绕的三片水面共用一个 Reflector（一次额外渲染），自写水着色器
//  菲涅尔 + 水体本色下限（否则倒影一深，水面就成 R=G=B 的中性灰板）+ 两层涟漪纹理 + 日月碎光
//  另加它山堰三处过水缺口的跌水与涟漪。
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  NC, waterRippleTexture, mergeGeos, V3, mulberry32, lerp, clamp,
} from './base.js';
import { L, WATER_Y, waterRects } from './world.js';

const WATER_VERT = /* glsl */`
uniform mat4 textureMatrix;
varying vec4 vUvR;
varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vUvR = textureMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const WATER_FRAG = /* glsl */`
uniform sampler2D tDiffuse;
uniform sampler2D uRippleTex;
uniform vec3 uBody, uDeep, uSky, uSunColor, uSunDir, uWarm;
uniform float uTime, uSparkle, uNight, uRipple, uOpacity;
varying vec4 vUvR;
varying vec3 vWorld;

void main(){
  vec3 V = normalize(cameraPosition - vWorld);
  vec2 p = vWorld.xz;
  float r1 = sin(p.x * 0.55 + uTime * 1.45) * cos(p.y * 0.62 - uTime * 1.10);
  float r2 = sin((p.x + p.y) * 0.31 - uTime * 0.85);
  float r3 = sin((p.x - p.y) * 0.83 + uTime * 2.10);
  vec3 rp1 = texture2D(uRippleTex, p * 0.052 + vec2(uTime * 0.011, uTime * 0.007)).rgb;
  vec3 rp2 = texture2D(uRippleTex, p * 0.019 - vec2(uTime * 0.008, uTime * 0.013)).rgb;
  vec2 texOff = (rp1.rg - 0.5) * 0.85 + (rp2.rg - 0.5) * 0.55;
  vec2 off = (vec2(r1 * 0.0022 + r2 * 0.0014, r3 * 0.0020 + r2 * 0.0011) + texOff * 0.0028) * uRipple;
  vec4 uv4 = vUvR;
  uv4.xy += off * uv4.w;
  vec3 refl = texture2DProj(tDiffuse, uv4).rgb;

  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.6);
  vec3 body = mix(uDeep, uBody, 0.55);
  body = mix(body, uSky * 0.42, 0.05);
  body = mix(body, uWarm, uNight * 0.18);
  body = mix(body, vec3(0.045, 0.075, 0.115), uNight * 0.62);   // 夜里水就是深蓝，不是暖褐台面
  vec3 c = mix(body, refl, mix(0.36, 0.95, pow(fres, 0.62)));
  c = mix(c, uSky * vec3(0.94, 0.99, 1.02), 0.10 + 0.28 * pow(fres, 2.0));   // 掠射角保留更多天空色，否则整片读成水泥地（agy V5）

  vec3 N = normalize(vec3(-off.y * 46.0, 1.0, off.x * 46.0));
  vec3 H = normalize(normalize(uSunDir) + V);
  c += uSunColor * pow(max(dot(N, H), 0.0), 200.0) * 1.10 * uSparkle;
  c *= 0.95 + 0.10 * (rp1.r - 0.5);

  // 建筑与堰体的接地压暗（自定义 shader 收不到阴影贴图，用几何距离替代接触阴影）
  vec2 dv = abs(vWorld.xz - vec2(0.0, -3.5)) - vec2(74.2, 39.2);
  c *= mix(0.89, 1.0, smoothstep(0.0, 3.0, max(dv.x, dv.y)));   // 原来 0.80/2m，倒影被压成一条死黑（agy V5）
  float dw = abs(abs(vWorld.z) - 6.6);
  c *= mix(0.88, 1.0, smoothstep(0.0, 3.0, dw));
  c *= mix(1.0, 0.58, uNight);                      // 夜里水不该比广场铺装更亮
  c = max(c, vec3(0.014, 0.026, 0.038) * uNight);
  gl_FragColor = vec4(c, uOpacity);
}`;

function quadXZ(x0, z0, x1, z1, y) {
  const pos = new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]);
  const n = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g.toNonIndexed();
}

export function buildWater() {
  const group = new THREE.Group();
  group.name = 'water';
  const hideDuringReflect = [];
  const R = mulberry32(0x77A7);

  const rects = waterRects();
  const waterGeo = mergeGeos(rects.map((r) => quadXZ(r.x0, r.z0, r.x1, r.z1, WATER_Y)));

  const shader = {
    name: 'JiangnanWater',
    uniforms: {
      color: { value: new THREE.Color(0x8fa8b0) },
      tDiffuse: { value: null },
      uRippleTex: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      uBody: { value: new THREE.Color(NC.waterGreen) },
      uDeep: { value: new THREE.Color(NC.waterDeep) },
      uSky: { value: new THREE.Color(0xd8ecfa) },
      uSunColor: { value: new THREE.Color(0xfff2d8) },
      uSunDir: { value: V3(0, 1, 0) },
      uWarm: { value: new THREE.Color(0xffcf8a) },
      uTime: { value: 0 },
      uSparkle: { value: 1 },
      uNight: { value: 0 },
      uRipple: { value: 1 },
      uOpacity: { value: 0.92 },
    },
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
  };
  const reflector = new Reflector(waterGeo, {
    shader, textureWidth: 1024, textureHeight: 1024, color: 0xc4d6dc, clipBias: 0.0035, multisample: 0,
  });
  reflector.material.uniforms.uRippleTex.value = waterRippleTexture();
  reflector.material.transparent = true;
  reflector.material.side = THREE.DoubleSide;
  reflector.material.depthWrite = true;
  reflector.receiveShadow = false;
  reflector.castShadow = false;
  group.add(reflector);

  const origBefore = reflector.onBeforeRender;
  reflector.onBeforeRender = function (renderer, scene, camera) {
    const vis = hideDuringReflect.map((o) => o.visible);
    hideDuringReflect.forEach((o) => { o.visible = false; });
    origBefore.call(this, renderer, scene, camera);
    hideDuringReflect.forEach((o, i) => { o.visible = vis[i]; });
  };

  // ---- 跌水贴图（竖向水柱条纹，垂直滚动）----
  const cascadeTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 256;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 64, 256);
    const RR = mulberry32(0x1F0A);
    for (let i = 0; i < 90; i++) {
      const x = RR() * 64, w = 1 + RR() * 4, h = 40 + RR() * 200;
      g.fillStyle = `rgba(235,248,255,${0.12 + RR() * 0.4})`;
      g.fillRect(x, RR() * 256, w, h);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const cascades = [];
  const notches = [-118, -104, -90];
  for (const x of notches) {
    for (const sgn of [1, -1]) {
      const h = L.weir.y - WATER_Y + 0.55;
      const tex = cascadeTex.clone();
      tex.needsUpdate = true;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1.4, 1.0);
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.55, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, color: 0xdff1ff,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, h), mat);
      const zz = sgn > 0 ? L.weir.z1 + 0.05 : L.weir.z0 - 0.05;
      mesh.position.set(x, L.weir.y - h / 2 + 0.1, zz);
      group.add(mesh);
      hideDuringReflect.push(mesh);
      cascades.push({ mat, speed: 0.9 + R() * 0.5, kind: 'fall' });
      const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const foam = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), foamMat);
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(x, WATER_Y + 0.03, zz + sgn * 1.5);
      group.add(foam);
      hideDuringReflect.push(foam);
      cascades.push({ mat: foamMat, kind: 'foam' });
    }
  }
  const rings = [];
  for (const x of notches) {
    for (const sgn of [1, -1]) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.08, 40),
        new THREE.MeshBasicMaterial({ color: 0xd8ecf2, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),   // 原来 0.35 白，掠射角下会显成一条粉白线
      );
      r.rotation.x = -Math.PI / 2;
      r.position.set(x, WATER_Y + 0.02, (sgn > 0 ? L.weir.z1 : L.weir.z0) + 1.5 * sgn);   // 不再假设 z0=−z1
      r.userData.phase = R();
      group.add(r);
      hideDuringReflect.push(r);
      rings.push(r);
    }
  }

  return {
    group, reflector, hideDuringReflect, cascades,
    update(st) {
      const u = reflector.material.uniforms;
      u.uSky.value.copy(st.skyHor);
      u.uSunColor.value.copy(st.sunColor).multiplyScalar(lerp(0.55, 1.0, st.dayF));
      u.uSunDir.value.copy(st.dayF > 0.02 ? st.sunDir : st.moonDir);
      u.uSparkle.value = lerp(0.25, 1.0, Math.max(st.dayF, st.nightF * 0.7));
      u.uNight.value = st.nightF;
      u.uBody.value.setHex(NC.waterGreen).lerp(st.skyHor, st.goldenF * 0.5).multiplyScalar(lerp(0.28, 1.02, st.dayF));
      u.uDeep.value.setHex(NC.waterDeep).lerp(st.skyHor, st.goldenF * 0.3).multiplyScalar(lerp(0.22, 0.95, st.dayF));
      u.uWarm.value.setHex(0xffcf8a).multiplyScalar(0.55 + st.nightF * 0.6);
      for (const c of cascades) {
        const base = c.kind === 'foam' ? 0.20 : 0.5;
        c.mat.opacity = base * lerp(0.45, 1.0, st.dayF);
      }
    },
    tick(t, dt, st) {
      const u = reflector.material.uniforms;
      u.uTime.value = t;
      u.uRipple.value = lerp(0.55, 1.25, clamp(st.goldenF + 0.3, 0, 1));
      for (const c of cascades) {
        if (c.kind === 'fall' && c.mat.map) c.mat.map.offset.y = (t * c.speed * 0.55) % 1;
      }
      for (const r of rings) {
        const life = (t * 0.5 + r.userData.phase) % 1;
        const sc = 0.8 + life * 3.4;
        r.scale.set(sc, sc, sc);
        r.material.opacity = (1 - life) * 0.13 * (0.45 + st.dayF * 0.55);
      }
    },
  };
}

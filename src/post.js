// post.js —— 后处理链：RenderPass → Bloom → OutputPass(ACES+sRGB) → 卡通描边 → 调色
//  描边是"精致卡通风"的关键：深度 + 法线双通道 Sobel，给所有 layer 0 的物体描一圈墨线。
//  法线/深度用一次额外的整场景渲染拿到（MeshNormalMaterial 覆盖），天空/远山/水/草木放在
//  layer 1，不参与描边（既不浪费一次反射渲染，也避免草叶产生噪点边）。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const OutlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uNear: { value: 0.35 },
    uFar: { value: 9000 },
    uDepthThresh: { value: 0.09 },
    uFadeNear: { value: 320 },
    uFadeFar: { value: 640 },
    uNormalThresh: { value: 0.32 },
    uStrength: { value: 0.85 },
    uInk: { value: new THREE.Color(0x1b1a20) },
    uAspect: { value: 1.777 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tNormal, tDepth;
    uniform vec2 uTexel;
    uniform float uNear, uFar, uDepthThresh, uNormalThresh, uStrength, uAspect, uFadeNear, uFadeFar;
    uniform vec3 uInk;
    varying vec2 vUv;

    float linDepth(vec2 uv){
      float d = texture2D(tDepth, uv).x;
      float z = d * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
    }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 t = uTexel;
      // 3×3 邻域（不跳下标，GLSL ES 1.0 安全）：深度差归一化（除以自身深度），远近物体都能描到
      float dc = linDepth(vUv);
      float de = 0.0;
      vec3 nc = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
      float ne = 0.0;
      for (int iy = -1; iy <= 1; iy++){
        for (int ix = -1; ix <= 1; ix++){
          if (ix == 0 && iy == 0) continue;
          vec2 uv = vUv + vec2(float(ix) * t.x, float(iy) * t.y);
          float di = linDepth(uv);
          de = max(de, abs(di - dc) / max(dc, 1.0));
          vec3 ni = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
          if (dot(ni, ni) > 0.05 && dot(nc, nc) > 0.05) ne = max(ne, 1.0 - dot(normalize(ni), normalize(nc)));
        }
      }
      float edge = smoothstep(uDepthThresh, uDepthThresh * 3.2, de)
                 + smoothstep(uNormalThresh, uNormalThresh * 2.4, ne) * 0.85;
      // 远处不描边：地面远边缘/远山/远城否则会被描成一条横贯画面的硬黑带
      edge = clamp(edge, 0.0, 1.0) * uStrength * (1.0 - smoothstep(uFadeNear, uFadeFar, dc));
      vec3 col = mix(c.rgb, uInk, edge);
      gl_FragColor = vec4(col, c.a);
    }`,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSat: { value: 1.09 },
    uContrast: { value: 1.045 },
    uWarm: { value: new THREE.Vector3(1.02, 1.0, 0.97) },
    uVig: { value: 0.32 },
    uGrain: { value: 0.02 },
    uTime: { value: 0 },
    uLift: { value: 0.014 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uSat, uContrast, uVig, uGrain, uTime, uLift;
    uniform vec3 uWarm;
    varying vec2 vUv;
    void main(){
      vec4 t = texture2D(tDiffuse, vUv);
      vec3 c = t.rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uContrast + 0.5;
      c = c * uWarm;
      c = c * (1.0 - uLift) + uLift;
      float d = distance(vUv, vec2(0.5, 0.48));
      c *= 1.0 - smoothstep(0.34, 0.94, d) * uVig;
      float n = fract(sin(dot(vUv * vec2(1213.7, 917.3) + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a);
    }`,
};

export function buildPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const dpr = renderer.getPixelRatio();
  const W = Math.max(2, Math.floor(size.x * dpr)), H = Math.max(2, Math.floor(size.y * dpr));

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x * 0.7, size.y * 0.7), 0.40, 0.85, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- 描边所需的 法线 + 深度 缓冲 ----
  const normalRT = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true, stencilBuffer: false });
  normalRT.depthTexture = new THREE.DepthTexture(W, H, THREE.UnsignedIntType);
  normalRT.depthTexture.format = THREE.DepthFormat;
  const normalMat = new THREE.MeshNormalMaterial();
  const normalCam = camera.clone();

  const outline = new ShaderPass(OutlineShader);
  outline.uniforms.tNormal.value = normalRT.texture;
  outline.uniforms.tDepth.value = normalRT.depthTexture;
  outline.uniforms.uNear.value = camera.near;
  outline.uniforms.uFar.value = camera.far;
  outline.uniforms.uTexel.value.set(1 / W, 1 / H);
  composer.addPass(outline);

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  let outlineOn = true;
  let hideForNormal = [];
  const state = { strength: 0.85 };

  function renderNormal() {
    normalCam.copy(camera);   // 一次同步矩阵/投影/near-far/layers，避免手工漏项

    const prev = scene.overrideMaterial;
    const prevBg = scene.background;
    // 天空/远山/水面/草木不写入法线缓冲：既省掉一次反射渲染，也免了草叶的噪点边
    const saved = hideForNormal.map((o) => o.visible);
    hideForNormal.forEach((o) => { o.visible = false; });
    scene.overrideMaterial = normalMat;
    scene.background = null;
    renderer.setRenderTarget(normalRT);
    renderer.clear();
    renderer.render(scene, normalCam);
    renderer.setRenderTarget(null);
    scene.overrideMaterial = prev;
    scene.background = prevBg;
    hideForNormal.forEach((o, i) => { o.visible = saved[i]; });
  }

  return {
    composer, bloom, grade, outline, normalRT,
    setOutline(on) { outlineOn = on; },
    setHideForNormal(list) { hideForNormal = list; },
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w * 0.7, h * 0.7);
      const W2 = Math.max(2, Math.floor(w * renderer.getPixelRatio()));
      const H2 = Math.max(2, Math.floor(h * renderer.getPixelRatio()));
      normalRT.setSize(W2, H2);
      outline.uniforms.uTexel.value.set(1 / W2, 1 / H2);
    },
    update(t, st) {
      grade.uniforms.uTime.value = t;
      grade.uniforms.uVig.value = 0.28 + st.nightF * 0.16 + st.goldenF * 0.06;
      grade.uniforms.uSat.value = 1.10 - st.nightF * 0.06 + st.goldenF * 0.05;
      grade.uniforms.uContrast.value = 1.045 + st.goldenF * 0.05;
      grade.uniforms.uWarm.value.set(1.0 + st.goldenF * 0.04, 1.0 + st.goldenF * 0.01, 1.0 - st.goldenF * 0.015);
      grade.uniforms.uGrain.value = 0.018 + st.nightF * 0.012;
      bloom.strength = 0.26 + st.nightF * 0.26 + st.goldenF * 0.14;
      bloom.threshold = 0.86 - st.nightF * 0.10;
      outline.uniforms.uStrength.value = outlineOn ? state.strength : 0.0;
      outline.uniforms.uInk.value.setHex(0x1b1a20).multiplyScalar(1.0 - st.nightF * 0.35);
    },
    setBloom(on) { bloom.enabled = on; },
    render() {
      if (outline.enabled) renderNormal();
      composer.render();
    },
  };
}

// sandbox-сторінка (app.html): чекає від обгортки HTML + JS активної версії і запускає їх.
import type { Boot } from './boot';

let booted = false;
window.addEventListener('message', (e: MessageEvent<Boot>) => {
  if (e.source !== parent || e.data?.type !== 'boot' || booted) return;
  booted = true;
  window.__T11_BOOT = e.data;
  const doc = new DOMParser().parseFromString(e.data.html, 'text/html');
  document.title = doc.title;
  for (const n of doc.head.querySelectorAll('style, link[rel=stylesheet]')) document.head.appendChild(document.adoptNode(n));
  for (const s of doc.body.querySelectorAll('script')) s.remove();
  document.body.replaceWith(document.adoptNode(doc.body));
  const s = document.createElement('script');
  s.textContent = e.data.js;
  document.body.appendChild(s);
});
parent.postMessage({ t: 'ready' }, '*');

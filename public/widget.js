(function () {
  var script = document.currentScript;
  if (!script) return;
  var id = String(script.getAttribute('data-restaurant-id') || '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return;
  var origin = new URL(script.src).origin;
  var frame = document.createElement('iframe');
  frame.src = origin + '/widget-embed?restaurant=' + encodeURIComponent(id) + '&site=' + encodeURIComponent(location.hostname || '');
  frame.title = 'Booki booking assistant';
  frame.allow = 'microphone; autoplay';
  frame.setAttribute('aria-label', 'Booki booking assistant');
  frame.style.cssText = 'position:fixed;bottom:0;right:0;width:400px;height:640px;max-width:100vw;max-height:100vh;border:0;background:transparent;z-index:2147483000;color-scheme:normal';
  var mount = function () { document.body.appendChild(frame); };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();

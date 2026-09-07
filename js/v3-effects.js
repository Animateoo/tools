(function() {
  var canvas = document.getElementById('waveCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w, h, time = 0;
  
  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }
  
  function draw() {
    ctx.clearRect(0, 0, w, h);
    time += 0.008;
    
    // Draw 3 layers of waves
    for (var layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      var amp = 30 + layer * 15;
      var freq = 0.003 + layer * 0.001;
      var speed = time * (1 + layer * 0.3);
      var yBase = h * 0.5 + layer * 40;
      
      ctx.moveTo(0, h);
      for (var x = 0; x <= w; x += 3) {
        var y = yBase + Math.sin(x * freq + speed) * amp + Math.cos(x * freq * 0.7 + speed * 0.8) * amp * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      
      // Gradient yellow to blue per layer
      var grad = ctx.createLinearGradient(0, 0, w, 0);
      if (layer === 0) {
        grad.addColorStop(0, 'rgba(246,211,45,0.12)');
        grad.addColorStop(1, 'rgba(59,130,246,0.12)');
      } else if (layer === 1) {
        grad.addColorStop(0, 'rgba(59,130,246,0.08)');
        grad.addColorStop(1, 'rgba(246,211,45,0.08)');
      } else {
        grad.addColorStop(0, 'rgba(246,211,45,0.05)');
        grad.addColorStop(0.5, 'rgba(59,130,246,0.07)');
        grad.addColorStop(1, 'rgba(246,211,45,0.05)');
      }
      ctx.fillStyle = grad;
      ctx.fill();
    }
    
    requestAnimationFrame(draw);
  }
  
  resize();
  window.addEventListener('resize', resize);
  draw();
})();

var rouletteIndex = 0;
function nextRouletteTool() {
  if (typeof ANIMATEO_TOOLS === 'undefined') return;
  rouletteIndex = (rouletteIndex + 1) % ANIMATEO_TOOLS.length;
  var tool = ANIMATEO_TOOLS[rouletteIndex];
  var nameEl = document.getElementById('rouletteName');
  var tagEl = document.getElementById('rouletteTag');
  if (nameEl) nameEl.textContent = tool.name;
  if (tagEl) tagEl.textContent = tool.tag;
}
// Auto-rotate every 3 seconds
setInterval(function() {
  nextRouletteTool();
}, 3000);

(function() {
  var track = document.getElementById('marqueeTrack');
  if (!track) return;
  var items = ['After Effects', 'Premiere Pro', 'Illustrator', 'Photoshop', 'CEP Extensions', 'ScriptUI', '10 Tools', 'Free & Open'];
  // Duplicate for seamless loop
  var html = '';
  for (var i = 0; i < 3; i++) {
    items.forEach(function(item) {
      html += '<span>' + item + '</span>';
    });
  }
  track.innerHTML = html;
})();

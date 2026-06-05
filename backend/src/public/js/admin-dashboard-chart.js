(function () {
  var svg = document.getElementById('dash-chart-svg');
  var tip = document.getElementById('dash-chart-tip');
  if (!svg || !tip) return;

  svg.addEventListener('mouseover', function (e) {
    var dot = e.target.closest('.dash-chart-dot');
    if (!dot) return;
    var views = dot.getAttribute('data-views');
    var label = dot.getAttribute('data-label');
    tip.textContent = label + ' — ' + views + ' návštev';
    tip.style.display = '';
    // Show visible dot
    var visDot = dot.nextElementSibling;
    if (visDot) visDot.setAttribute('r', '4');
  });

  svg.addEventListener('mouseout', function (e) {
    var dot = e.target.closest('.dash-chart-dot');
    if (!dot) return;
    tip.style.display = 'none';
    var visDot = dot.nextElementSibling;
    if (visDot) visDot.setAttribute('r', '0');
  });

  svg.addEventListener('mousemove', function (e) {
    if (tip.style.display === 'none') return;
    var rect = svg.closest('.dash-card-body').getBoundingClientRect();
    tip.style.left = e.clientX - rect.left + 12 + 'px';
    tip.style.top = e.clientY - rect.top - 36 + 'px';
    tip.style.position = 'absolute';
  });
})();

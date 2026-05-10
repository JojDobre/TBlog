/**
 * ByteZone — Auth pages JS
 *
 * - Password show/hide toggle (data-toggle-pw="<inputId>")
 * - Password strength meter (input[data-strength] + #pw-strength)
 */
'use strict';

(function () {
  // ── Password show / hide ──────────────────────────────────────────────
  document.querySelectorAll('[data-toggle-pw]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-toggle-pw');
      var input = document.getElementById(id);
      if (!input) return;
      var isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? 'Skryť' : 'Zobraziť';
    });
  });

  // ── Password strength meter ───────────────────────────────────────────
  var pwInput = document.querySelector('input[data-strength]');
  var strengthWrap = document.getElementById('pw-strength');
  if (!pwInput || !strengthWrap) return;

  var bars = strengthWrap.querySelectorAll('.auth-strength-bar > span');
  var label = strengthWrap.querySelector('.auth-strength-label');

  var labels = ['Príliš slabé', 'Slabé', 'OK', 'Silné', 'Skvelé'];
  var colors = [
    'oklch(0.65 0.2 25)',
    'oklch(0.7 0.18 50)',
    'oklch(0.75 0.15 90)',
    'oklch(0.72 0.17 155)',
    'oklch(0.7 0.18 165)',
  ];

  function calcStrength(pwd) {
    var s = 0;
    if (pwd.length >= 8) s++;
    if (pwd.length >= 12) s++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
    if (/\d/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return Math.min(s, 4);
  }

  pwInput.addEventListener('input', function () {
    var pwd = pwInput.value;
    if (!pwd.length) {
      strengthWrap.hidden = true;
      return;
    }
    strengthWrap.hidden = false;
    var strength = calcStrength(pwd);
    var color = colors[strength];

    for (var i = 0; i < bars.length; i++) {
      bars[i].style.background = i < strength ? color : '';
    }
    label.textContent = labels[strength];
    label.style.color = color;
  });
})();

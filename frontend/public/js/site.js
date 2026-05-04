/**
 * ByteZone — Frontend JS (Phase 6.1)
 *
 * Hero slider: auto-rotácia každých 6.5s, dot navigation, arrows.
 */

(function () {
  'use strict';

  var slider = document.querySelector('[data-hero-slider]');
  if (!slider) return;

  var slides = slider.querySelectorAll('.hero-slide');
  var dots = slider.querySelectorAll('[data-slide-dot]');
  var prevBtn = slider.querySelector('[data-slide-prev]');
  var nextBtn = slider.querySelector('[data-slide-next]');

  if (slides.length <= 1) return;

  var current = 0;
  var interval = null;
  var DELAY = 6500;

  function goTo(idx) {
    slides[current].classList.remove('hero-slide--active');
    dots[current].classList.remove('active');

    current = ((idx % slides.length) + slides.length) % slides.length;

    slides[current].classList.add('hero-slide--active');
    dots[current].classList.add('active');
  }

  function next() {
    goTo(current + 1);
  }
  function prev() {
    goTo(current - 1);
  }

  function startAuto() {
    stopAuto();
    interval = setInterval(next, DELAY);
  }

  function stopAuto() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  // Dot clicks
  dots.forEach(function (dot) {
    dot.addEventListener('click', function (e) {
      e.stopPropagation();
      var idx = Number(dot.getAttribute('data-slide-dot'));
      goTo(idx);
      startAuto(); // reset timer
    });
  });

  // Arrow clicks
  if (prevBtn)
    prevBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      prev();
      startAuto();
    });
  if (nextBtn)
    nextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      next();
      startAuto();
    });

  // Pause on hover, resume on leave
  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);

  startAuto();

  // Carousel scroll buttons
  var track = document.querySelector('[data-carousel-track]');
  var prevC = document.querySelector('[data-carousel-prev]');
  var nextC = document.querySelector('[data-carousel-next]');
  if (track && prevC && nextC) {
    prevC.addEventListener('click', function () {
      track.scrollBy({ left: -340, behavior: 'smooth' });
    });
    nextC.addEventListener('click', function () {
      track.scrollBy({ left: 340, behavior: 'smooth' });
    });
  }
})();

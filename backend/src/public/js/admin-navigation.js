(function () {
  'use strict';

  // === NAVBAR ===
  var navJson = document.getElementById('nav-links-json');
  var navList = document.getElementById('nav-list');
  var navAdd = document.getElementById('nav-add');
  var navLinks = [];
  try { navLinks = JSON.parse(navJson.value || '[]'); } catch (e) { navLinks = []; }

  function renderNav() {
    navList.innerHTML = '';
    navLinks.forEach(function (link, i) {
      var row = document.createElement('div');
      row.className = 'nav-edit-row';
      row.innerHTML =
        '<input type="text" class="form-control form-control-sm" value="' + esc(link.label) + '" placeholder="Názov" data-key="label">' +
        '<input type="text" class="form-control form-control-sm" value="' + esc(link.href) + '" placeholder="/cesta" data-key="href">' +
        '<button type="button" class="tpl-act" data-action="up" title="Hore"><i class="bi bi-arrow-up"></i></button>' +
        '<button type="button" class="tpl-act" data-action="down" title="Dolu"><i class="bi bi-arrow-down"></i></button>' +
        '<button type="button" class="tpl-act tpl-act-del" data-action="del" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
      row.querySelectorAll('input').forEach(function (inp) {
        inp.addEventListener('input', function () {
          navLinks[i][inp.getAttribute('data-key')] = inp.value;
          syncNav();
        });
      });
      row.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var a = btn.getAttribute('data-action');
          if (a === 'del') { navLinks.splice(i, 1); }
          else if (a === 'up' && i > 0) { var t = navLinks[i]; navLinks[i] = navLinks[i - 1]; navLinks[i - 1] = t; }
          else if (a === 'down' && i < navLinks.length - 1) { var t2 = navLinks[i]; navLinks[i] = navLinks[i + 1]; navLinks[i + 1] = t2; }
          syncNav(); renderNav();
        });
      });
      navList.appendChild(row);
    });
  }

  function syncNav() { navJson.value = JSON.stringify(navLinks); }

  navAdd.addEventListener('click', function () {
    navLinks.push({ href: '/', label: 'Nový' });
    syncNav(); renderNav();
    var last = navList.lastElementChild;
    if (last) last.querySelector('input').focus();
  });

  renderNav();

  // === FOOTER SECTIONS ===
  var footerJson = document.getElementById('footer-sections-json');
  var footerList = document.getElementById('footer-sections-list');
  var footerAdd = document.getElementById('footer-section-add');
  var sections = [];
  try { sections = JSON.parse(footerJson.value || '[]'); } catch (e) { sections = []; }

  function renderFooter() {
    footerList.innerHTML = '';
    sections.forEach(function (sec, si) {
      var card = document.createElement('div');
      card.className = 'nav-section-card';

      // Section header
      var head = document.createElement('div');
      head.className = 'nav-section-head';
      head.innerHTML =
        '<input type="text" class="form-control form-control-sm" value="' + esc(sec.title) + '" placeholder="Názov sekcie" style="flex:1">' +
        '<button type="button" class="tpl-act" data-action="up" title="Hore"><i class="bi bi-arrow-up"></i></button>' +
        '<button type="button" class="tpl-act" data-action="down" title="Dolu"><i class="bi bi-arrow-down"></i></button>' +
        '<button type="button" class="tpl-act tpl-act-del" data-action="del" title="Odstrániť sekciu"><i class="bi bi-x-lg"></i></button>';
      head.querySelector('input').addEventListener('input', function () {
        sections[si].title = this.value;
        syncFooter();
      });
      head.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var a = btn.getAttribute('data-action');
          if (a === 'del') { sections.splice(si, 1); }
          else if (a === 'up' && si > 0) { var t = sections[si]; sections[si] = sections[si - 1]; sections[si - 1] = t; }
          else if (a === 'down' && si < sections.length - 1) { var t2 = sections[si]; sections[si] = sections[si + 1]; sections[si + 1] = t2; }
          syncFooter(); renderFooter();
        });
      });
      card.appendChild(head);

      // Links
      var linksWrap = document.createElement('div');
      linksWrap.className = 'nav-section-links';
      (sec.links || []).forEach(function (link, li) {
        var row = document.createElement('div');
        row.className = 'nav-edit-row nav-edit-row-sm';
        row.innerHTML =
          '<input type="text" class="form-control form-control-sm" value="' + esc(link.label) + '" placeholder="Názov" data-key="label">' +
          '<input type="text" class="form-control form-control-sm" value="' + esc(link.href) + '" placeholder="/cesta" data-key="href">' +
          '<button type="button" class="tpl-act tpl-act-del" data-action="del-link" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
        row.querySelectorAll('input').forEach(function (inp) {
          inp.addEventListener('input', function () {
            sections[si].links[li][inp.getAttribute('data-key')] = inp.value;
            syncFooter();
          });
        });
        row.querySelector('[data-action="del-link"]').addEventListener('click', function () {
          sections[si].links.splice(li, 1);
          syncFooter(); renderFooter();
        });
        linksWrap.appendChild(row);
      });

      var addLink = document.createElement('button');
      addLink.type = 'button';
      addLink.className = 'bz-art-btn bz-art-btn-sm';
      addLink.style.cssText = 'width:100%;margin-top:4px;font-size:11px';
      addLink.innerHTML = '<i class="bi bi-plus"></i> Pridať odkaz';
      addLink.addEventListener('click', function () {
        if (!sections[si].links) sections[si].links = [];
        sections[si].links.push({ href: '/', label: 'Nový' });
        syncFooter(); renderFooter();
      });
      linksWrap.appendChild(addLink);
      card.appendChild(linksWrap);

      footerList.appendChild(card);
    });
  }

  function syncFooter() { footerJson.value = JSON.stringify(sections); }

  footerAdd.addEventListener('click', function () {
    sections.push({ title: 'Nová sekcia', links: [] });
    syncFooter(); renderFooter();
  });

  renderFooter();

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
})();

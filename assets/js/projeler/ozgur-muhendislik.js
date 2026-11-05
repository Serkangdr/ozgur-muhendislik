// Özgür Mühendislik — Lenis kaydırma, açılış, osiloskop dalgası, imleci izleyen
// ışık, 3B eğim, zaman çizelgesi, mobil menü ve erişilebilir detay penceresi.
// GSAP yüklenemezse ya da azaltılmış hareket istenirse sayfa animasyonsuz çalışır.
(function () {
  'use strict';

  const root = document.documentElement;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const MOTION = hasGsap && !REDUCED;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) =>
    s.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

  root.classList.add('is-js');
  if (hasGsap) {
    root.classList.add('has-gsap');
    gsap.registerPlugin(ScrollTrigger);
  }

  // --- LENIS ---
  let lenis = null;
  if (MOTION && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // --- MOBİL MENÜ ---
  const hamburger = $('.hamburger');
  const navLinks = $('.nav-links');
  const setMenu = (open) => {
    if (!hamburger || !navLinks) return;
    hamburger.classList.toggle('active', open);
    navLinks.classList.toggle('active', open);
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
  };
  if (hamburger) {
    hamburger.addEventListener('click', () => setMenu(!navLinks.classList.contains('active')));
  }

  // --- SAYFA İÇİ BAĞLANTILAR ---
  $$('a[href^="#"]:not(.skip)').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id === '#') {
        e.preventDefault(); // kart içindeki "İncele" gibi yer tutucu bağlantılar sayfayı zıplatmasın
        return;
      }
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      setMenu(false);
      if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { offset: -90, duration: 1.4 });
      else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
    });
  });

  // --- DETAY PENCERESİ ---
  (function modal() {
    const overlay = $('#detailModal');
    if (!overlay) return;
    const box = $('.modal-content', overlay);
    const closeBtn = $('.modal-close', overlay);
    const img = $('#modalImg');
    let lastFocus = null;

    const open = (card) => {
      $('#modalTitle').textContent = $('.card-title', card).textContent.trim();
      $('#modalDesc').textContent = $('.card-desc', card).textContent.trim();
      const src = $('.card-img', card);
      img.src = src.currentSrc || src.src;
      img.alt = src.alt;
      lastFocus = document.activeElement;
      overlay.hidden = false;
      if (lenis) lenis.stop();
      if (MOTION) {
        gsap.fromTo(
          overlay,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.35, ease: 'power2.out' },
        );
        gsap.fromTo(
          box,
          { y: 50, scale: 0.96, autoAlpha: 0 },
          { y: 0, scale: 1, autoAlpha: 1, duration: 0.9, ease: 'expo.out' },
        );
      }
      closeBtn.focus();
    };
    const close = () => {
      if (overlay.hidden) return;
      const done = () => {
        overlay.hidden = true;
        if (hasGsap) gsap.set([overlay, box], { clearProps: 'all' });
        if (lenis) lenis.start();
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      };
      if (!MOTION) return done();
      gsap.to(box, { y: 24, autoAlpha: 0, duration: 0.3, ease: 'power2.in' });
      gsap.to(overlay, { autoAlpha: 0, duration: 0.35, ease: 'power2.in', onComplete: done });
    };

    $$('.interactive').forEach((card) => {
      card.setAttribute('aria-haspopup', 'dialog');
      // içinde bağlantı olmayan kartlar klavyeyle de açılabilsin
      if (!$('a, button', card)) {
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${$('.card-title', card).textContent.trim()} — detay`);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open(card);
          }
        });
      }
      card.addEventListener('click', (e) => {
        e.preventDefault();
        open(card);
      });
    });
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        close();
        setMenu(false);
      }
      // odak pencerenin içinde döner
      if (e.key === 'Tab' && !overlay.hidden) {
        const f = $$('button, a[href]', overlay);
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  })();

  // --- OSİLOSKOP (hero kartında, imlece tepki veren dalga) ---
  (function scope() {
    const cv = $('[data-scope]');
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d');
    const card = cv.parentElement;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', () => {
      resize();
      if (REDUCED) draw();
    });

    let tx = 0.5;
    let ty = 0.5;
    let mx = 0.5;
    let my = 0.5;
    let t = 0;
    let running = false;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top) / r.height;
    });
    card.addEventListener('pointerleave', () => {
      tx = 0.5;
      ty = 0.5;
    });

    const traces = [
      { color: 'rgba(3, 105, 161, 0.85)', amp: 1, f: 1, ph: 0, lw: 1.7 },
      { color: 'rgba(29, 78, 216, 0.4)', amp: 0.7, f: 1.6, ph: 1.2, lw: 1.2 },
      { color: 'rgba(15, 118, 110, 0.45)', amp: 0.5, f: 2.3, ph: 2.4, lw: 1 },
    ];

    function draw() {
      mx += (tx - mx) * 0.06;
      my += (ty - my) * 0.06;
      ctx.clearRect(0, 0, w, h);

      // ölçek ızgarası
      ctx.beginPath();
      for (let x = 0.5; x < w; x += 28) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = h - 0.5; y > 0; y -= 28) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.strokeStyle = 'rgba(11, 22, 38, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const mid = h * 0.6;
      const amp = h * (0.1 + (1 - my) * 0.22);
      const freq = 0.006 + mx * 0.012;
      traces.forEach((tr) => {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const env = Math.sin((Math.PI * x) / w);
          const y =
            mid +
            Math.sin(x * freq * tr.f + t * 1.6 + tr.ph) * amp * tr.amp * env +
            Math.sin(x * freq * tr.f * 3.1 - t * 2.2) * amp * 0.12 * env;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = tr.color;
        ctx.lineWidth = tr.lw;
        ctx.stroke();
      });
      t += 0.016;
      if (running) requestAnimationFrame(draw);
    }

    if (REDUCED) {
      draw();
      return;
    }
    // ekranda değilken çizim durur
    new IntersectionObserver(([entry]) => {
      const was = running;
      running = entry.isIntersecting;
      if (running && !was) requestAnimationFrame(draw);
    }).observe(cv);
  })();

  // --- İMLECİ İZLEYEN IŞIK ---
  if (FINE) {
    $$('.spot').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  // --- 3B EĞİM + MIKNATIS ---
  if (FINE && MOTION) {
    $$('[data-tilt]').forEach((card) => {
      gsap.set(card, { transformPerspective: 1000 });
      const rx = gsap.quickTo(card, 'rotationX', { duration: 0.7, ease: 'power3' });
      const ry = gsap.quickTo(card, 'rotationY', { duration: 0.7, ease: 'power3' });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 7);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 7);
      });
      card.addEventListener('pointerleave', () => {
        rx(0);
        ry(0);
      });
    });
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.25);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      el.addEventListener('pointerleave', () => {
        xTo(0);
        yTo(0);
      });
    });
  }

  // --- KAYDIRMA ---
  function scrollFx() {
    // menüdeki ilerleme çizgisi + aktif bölüm
    gsap.to('.nav__progress i', {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
    });
    const links = $$('[data-nav]');
    ['top', 'about', 'projects', 'publications', 'contact'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el,
        // kısa footer ekranın ortasına hiç ulaşamaz; daha erken yakalanır
        start: id === 'contact' ? 'top 62%' : 'top 45%',
        end: 'bottom 45%',
        onToggle: (self) => {
          if (self.isActive)
            links.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === id));
        },
      });
    });

    // zaman çizelgesi: ray çizilir, noktalar yanar
    gsap.to('[data-rail]', {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.timeline', start: 'top 72%', end: 'bottom 62%', scrub: 0.5 },
    });
    $$('.timeline-item').forEach((item) => {
      ScrollTrigger.create({
        trigger: item,
        start: 'top 70%',
        onEnter: () => item.classList.add('is-lit'),
        onLeaveBack: () => item.classList.remove('is-lit'),
      });
    });

    if (REDUCED) {
      $$('.timeline-item').forEach((i) => i.classList.add('is-lit'));
      gsap.set('[data-rail]', { scaleY: 1 });
      return;
    }

    $$('[data-reveal-words]').forEach((el) => {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      el.setAttribute('aria-label', text);
      el.innerHTML = text
        .split(' ')
        .map((w) => `<span class="w" aria-hidden="true"><span>${esc(w)}</span></span>`)
        .join(' ');
      gsap.from($$('.w > span', el), {
        yPercent: 110,
        duration: 1.2,
        stagger: 0.07,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    });
    $$('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        y: 50,
        autoAlpha: 0,
        duration: 1.2,
        ease: 'expo.out',
        clearProps: 'opacity,visibility',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });
    ScrollTrigger.batch('[data-reveal-card]', {
      start: 'top 90%',
      once: true,
      onEnter: (els) =>
        gsap.from(els, {
          y: 70,
          autoAlpha: 0,
          duration: 1.3,
          stagger: 0.1,
          ease: 'expo.out',
          clearProps: 'opacity,visibility', // transform kalsın: 3B eğim perspektifini korur
        }),
    });
    const mark = $('[data-footer-mark]');
    if (mark) {
      gsap.from(mark, {
        yPercent: 60,
        autoAlpha: 0,
        duration: 1.4,
        ease: 'expo.out',
        scrollTrigger: { trigger: mark, start: 'top 95%', once: true },
      });
    }
  }

  // --- AÇILIŞ ---
  function intro() {
    const lines = $$('.hero-title .line > span');
    const items = $$('[data-hero-item]');
    const cards = $$('[data-hero-card]');
    const all = [...lines, ...items, ...cards];
    if (!MOTION) {
      all.forEach((el) => (el.style.opacity = '1'));
      return;
    }
    gsap.set(lines, { yPercent: 115, opacity: 1 });
    gsap.set(items, { y: 26, opacity: 0 });
    gsap.set(cards, { y: 46, opacity: 0, scale: 0.985 });
    gsap
      .timeline({ defaults: { ease: 'expo.out' }, delay: 0.05 })
      .to(cards, { y: 0, opacity: 1, scale: 1, duration: 1.4, stagger: 0.07 }, 0)
      .to(lines, { yPercent: 0, duration: 1.4, stagger: 0.1 }, 0.15)
      .to(items, { y: 0, opacity: 1, duration: 1.1, stagger: 0.07 }, 0.4)
      .add(() => gsap.set(cards, { clearProps: 'transform' }));
  }

  if (hasGsap) {
    scrollFx();
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }
  intro();
})();

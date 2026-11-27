function animateIntroLead() {
  const lead = document.querySelector('.intro-copy .lead');
  if (!lead || !window.Splitting || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;

  const visual = document.createElement('span');
  visual.append(...Array.from(lead.childNodes, node => node.cloneNode(true)));
  visual.setAttribute('aria-hidden', 'true');
  const [{ chars }] = Splitting({ target: visual, by: 'chars' });
  const original = document.createElement('span');
  original.className = 'visually-hidden';
  original.append(...lead.childNodes);
  lead.append(original, visual);

  chars.at(-1).addEventListener('animationend', () => {
    lead.replaceChildren(...original.childNodes);
  }, { once: true });
}
animateIntroLead();

function initReadingProgress() {
  const menu = [...document.querySelectorAll('.mast-inner nav a')];
  const sections = menu.map(link => document.getElementById(link.hash.slice(1)));
  const ruler = document.querySelector('.section-ruler');
  const bar = document.querySelector('.reading-progress');
  const page = document.scrollingElement;
  const ticks = menu.map(link => {
    const tick = document.createElement('a');
    tick.href = link.hash;
    const label = document.createElement('span');
    label.textContent = link.textContent;
    tick.append(label);
    ruler.append(tick);
    return tick;
  });

  let frame = 0;
  function update() {
    frame = 0;
    const range = page.scrollHeight - document.documentElement.clientHeight;
    ruler.hidden = bar.hidden = range <= 0;
    const top = page.scrollTop;
    const fraction = range > 0 ? Math.min(1, Math.max(0, top / range)) : 0;
    bar.style.setProperty('--read', fraction);
    bar.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));

    const starts = sections.map(section => section.getBoundingClientRect().top + top - 110);
    starts[0] = 0;
    const active = fraction === 1 ? sections.length - 1 : Math.max(0, starts.findLastIndex(start => start <= top));
    for (let i = 0; i < ticks.length; i++) {
      for (const link of [menu[i], ticks[i]]) {
        if (i === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
      const end = Math.min(starts[i + 1] ?? range, range);
      const progress = (top - starts[i]) / Math.max(1, end - starts[i]);
      const fill = i < active || fraction === 1 ? 1 : Math.max(0, Math.min(1, progress));
      ticks[i].style.setProperty('--fill', (100 * fill) + '%');
    }
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  window.addEventListener('scroll', schedule, { passive:true });
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.body);
  update();
}
initReadingProgress();

function monthIndex(date) {
  const [year, month] = date.split('-').map(Number);
  return year * 12 + month - 1;
}

function addChart(panel) {
  const origin = monthIndex(panel.dataset.origin);
  const limit = monthIndex(panel.dataset.end) + 1;
  const recentStart = limit - 24;
  function position(month, earlyShare) {
    if (month < recentStart) return earlyShare * (month - origin) / (recentStart - origin);
    return earlyShare + (100 - earlyShare) * (month - recentStart) / (limit - recentStart);
  }
  const chapter = document.createElement('section');
  chapter.className = 'chron-chapter';
  const heading = document.createElement('h3');
  heading.className = 'timeline-ticks';
  heading.setAttribute('aria-label', '시간축');
  const chart = document.createElement('div');
  chart.className = 'chron-chart';
  const boundary = document.createElement('span');
  for (const month of [origin, recentStart, limit - 1]) {
    const tick = document.createElement('span');
    tick.textContent = Math.floor(month / 12) + '.' + String(month % 12 + 1).padStart(2, '0');
    heading.append(tick);
  }
  boundary.className = 'scale-break';
  chart.append(boundary);
  chapter.append(heading, chart);
  panel.insertBefore(chapter, panel.querySelector('ol'));

  const fullContrast = monthIndex(panel.querySelector('.tone-degree').dataset.start);
  const age = month => Math.max(0, Math.min(1, (month-origin)/(fullContrast-origin)));
  const bounds = [];
  const entries = [];
  for (const item of panel.querySelectorAll('ol > li')) {
    const start = Math.max(origin, monthIndex(item.dataset.start));
    const ongoing = item.hasAttribute('data-ongoing');
    const end = ongoing ? limit : Math.min(limit, monthIndex(item.dataset.end || item.dataset.start) + 1);
    if (end <= start) continue;
    const point = !ongoing && !item.dataset.end;
    let lane = bounds.findIndex(value => value <= start);
    if (lane < 0) lane = bounds.length;
    bounds[lane] = end;
    const mark = document.createElement('span');
    mark.className = 'chart-mark ' + item.className + (point ? ' point-mark' : '');
    const label = item.querySelector('.row-name').cloneNode(true);
    label.className = 'chart-label ' + item.className;
    if (ongoing) label.classList.add('ongoing');
    const date = item.querySelector('.row-date').cloneNode(true);
    label.append(date);
    const leader = document.createElement('span');
    leader.className = 'chart-leader';
    if (item.classList.contains('earlier-event')) {
      const strength = age(start);
      for (const node of [item,label]) node.style.setProperty('--age', (strength*100)+'%');
      leader.style.setProperty('--leader-opacity', .3 + .7*strength);
      const stop = 100*Math.min(1,(fullContrast-start)/(end-start));
      const alpha = month => .24 + .76*age(month);
      mark.style.setProperty('--age-mask', 'linear-gradient(to right, rgb(0 0 0 / '+alpha(start)+'), rgb(0 0 0 / '+alpha(end)+') '+stop+'%)');
    }
    label.title = label.textContent.replace('↘', '').trim();
    for (const el of [mark, leader]) el.setAttribute('aria-hidden', 'true');
    const entry = document.createElement('div');
    entry.className = 'chart-entry';
    entry.append(leader, mark, label);
    chart.append(entry);
    entries.push({start, end, point, lane, mark, label, leader});
  }
  const axis = document.createElement('div');
  axis.className = 'chart-axis';
  chart.prepend(axis);

  function layout() {
    const width = chart.clientWidth;
    if (!width) return;
    const earlyShare = Math.min(40, Math.max(29, 34000 / width));
    chapter.style.setProperty('--early-share', earlyShare + '%');
    const sides = [[], []];
    const rows = [];
    const gap = 10;
    const step = Math.max(...entries.map(entry => entry.label.offsetHeight)) + gap;
    for (const [index, entry] of entries.entries()) {
      const x = position(entry.start, earlyShare);
      entry.mark.style.left = entry.leader.style.left = x + '%';
      if (!entry.point) entry.mark.style.width = (position(entry.end, earlyShare) - x) + '%';
      const anchor = width * x / 100;
      const w = entry.label.offsetWidth;
      const left = Math.min(width - w, Math.max(0, anchor - 8));
      const choices = sides.map(levels => {
        const available = levels.findIndex(right => right + gap <= left);
        return available < 0 ? levels.length : available;
      });
      const side = choices[0] === choices[1] ? index % 2 : Number(choices[1] < choices[0]);
      const level = choices[side];
      sides[side][level] = left + w;
      rows.push({side, level, left});
    }
    const axisY = sides[0].length * step + 14;
    const trackHeight = Math.max(1, bounds.length) * 8;
    boundary.style.top = axisY - 8 + 'px';
    boundary.style.height = trackHeight + 16 + 'px';
    axis.style.top = axisY + 'px';
    axis.style.height = trackHeight + 'px';
    chart.style.height = axisY + trackHeight + 14 + sides[1].length * step + 'px';
    entries.forEach(({lane, label, mark, leader}, i) => {
      const {side, level, left} = rows[i];
      const y = axisY + lane * 8 + 3;
      const labelY = side ? axisY + trackHeight + 14 + level * step : axisY - 14 - level * step - label.offsetHeight;
      const tip = side ? labelY : labelY + label.offsetHeight;
      Object.assign(label.style, {left:left + 'px', top:labelY + 'px'});
      mark.style.top = y + 'px';
      Object.assign(leader.style, {top:Math.min(tip,y) + 'px', height:Math.abs(y-tip) + 'px'});
    });
  }
  new ResizeObserver(layout).observe(chapter);
  document.fonts.ready.then(layout);
  layout();
}

addChart(document.getElementById('all-range'));
document.getElementById('timeline').classList.add('plotted');

function initPostCarousel() {
  const strip = document.getElementById('post-strip');
  const controls = document.querySelector('.post-actions');
  const [previous, next] = controls.querySelectorAll('button');
  const cards = [...strip.children];

  function updateButtons() {
    previous.disabled = strip.scrollLeft <= 1;
    next.disabled = strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 1;
  }

  function move(direction) {
    const offsets = cards.map(card => card.getBoundingClientRect().left - strip.getBoundingClientRect().left);
    const target = direction > 0 ? offsets.find(offset => offset > 2) : offsets.filter(offset => offset < -2).pop();
    if (target === undefined) return;
    strip.scrollBy({ left:target, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    updateButtons();
  }

  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  strip.addEventListener('scroll', updateButtons, { passive:true });
  strip.addEventListener('scrollend', updateButtons);
  new ResizeObserver(updateButtons).observe(strip);
  controls.hidden = false;
  updateButtons();
}
initPostCarousel();

const demo = document.querySelector('.embedded-demo video');
function showVideoSource() {
  document.querySelector('.video-fallback').hidden = false;
  const figure = demo.closest('figure');
  if (figure.classList.contains('has-error')) return;
  figure.classList.add('has-error');
  const still = document.createElement('img');
  still.className = 'video-still';
  still.src = demo.poster;
  still.alt = '실업급여 상담 AI 시연 화면';
  figure.insertBefore(still, demo);
}
demo.addEventListener('error', showVideoSource);
if (demo.error) showVideoSource();

function renderPixelEdge(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const phase = Math.random() * Math.PI * 2;
  const ink = getComputedStyle(canvas).getPropertyValue('--ink').trim();
  const paper = getComputedStyle(canvas).getPropertyValue('--paper').trim();
  const base = document.createElement('canvas');
  const background = base.getContext('2d');
  const cells = [];
  let width, height, scale, pitch;
  let timer, visible = false, time = 0, last = 0;

  function paintCell(context, x, y, size) {
    const side = Math.round(size * scale);
    if (side < 1) return;
    context.fillRect(Math.round(x * scale - side / 2), Math.round(y * scale - side / 2), side, side);
  }
  function setup() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = base.width = Math.round(width * scale);
    canvas.height = base.height = Math.round(height * scale);
    pitch = width < 600 ? 5 : 7;
    cells.length = 0;
    background.fillStyle = paper;
    background.fillRect(0, 0, base.width, base.height);
    background.fillStyle = ink;
    const spread = height * .19;
    for (let x = 0; x < width + pitch; x += pitch) {
      const u = x / width;
      const contour = height * (.50 + .13 * Math.sin(u * 12 + phase)
        + .095 * Math.sin(u * 21 - phase) + .036 * Math.sin(x / 29 + phase));
      const solid = Math.min(Math.ceil((contour + spread) / pitch) * pitch, height);
      const left = Math.round(x * scale);
      background.fillRect(left, Math.round(solid * scale), Math.round((x + pitch) * scale) - left, base.height);
      for (let y = Math.max(0, solid - Math.ceil(2.75 * spread / pitch) * pitch); y < solid; y += pitch) {
        const depth = (y + pitch / 2 - contour) / spread;
        const density = Math.max(0, Math.min(1, (depth + 1.55) / 2.55));
        if (Math.random() > density ** 1.25) continue;
        const edgeSize = Math.min(pitch, pitch * (.12 + density ** 1.6 * (1 + Math.random() * .55)));
        const cx = x + pitch / 2, cy = y + pitch / 2;
        if (density > .85 || Math.random() > .46) {
          paintCell(background, cx, cy, edgeSize);
        } else {
          cells.push({x:cx, y:cy, size:edgeSize, from:Math.random(), to:Math.random(),
            start:-Math.random() * 2, duration:2 + Math.random() * 3});
        }
      }
    }
    draw();
  }
  function draw() {
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = ink;
    for (const cell of cells) {
      let t = (time - cell.start) / cell.duration;
      if (t >= 1) {
        cell.from = cell.to;
        cell.to = Math.random();
        cell.start = time;
        cell.duration = 2 + Math.random() * 4;
        t = 0;
      }
      const blend = t * t * (3 - 2 * t);
      ctx.globalAlpha = cell.from + (cell.to - cell.from) * blend;
      paintCell(ctx, cell.x, cell.y, cell.size);
    }
    ctx.globalAlpha = 1;
  }
  function tick() {
    const now = performance.now();
    time += Math.min(.3, (now - last) / 1000);
    last = now;
    draw();
    timer = setTimeout(tick, 100);
  }
  function sync() {
    clearTimeout(timer);
    last = performance.now();
    if (visible && !reduced.matches && !document.hidden) tick();
  }
  setup();
  new ResizeObserver(setup).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
}
renderPixelEdge(document.querySelector('.pixel-shore'));

if ('IntersectionObserver' in window) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 650;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
      const value = entry.target;
      observer.unobserve(value);
      if (reducedMotion.matches) continue;

      const label = value.querySelector('.notice-count');
      const total = parseInt(label.textContent, 10);
      const ticker = document.createElement('span');
      ticker.setAttribute('aria-hidden', 'true');
      label.after(ticker);
      label.classList.add('visually-hidden');
      const start = performance.now();

      function draw(now) {
        const time = Math.min(1, (now - start) / duration);
        if (time >= 1 || reducedMotion.matches) {
          ticker.remove();
          label.classList.remove('visually-hidden');
          value.style.removeProperty('--progress');
          return;
        }
        const progress = 1 - (1 - time) ** 3;
        ticker.textContent = Math.round(total * progress) + '건';
        value.style.setProperty('--progress', progress);
        requestAnimationFrame(draw);
      }
      draw(start);
    }
  }, { threshold: 0.5 });
  for (const value of document.querySelectorAll('.notice-types .notice-value')) observer.observe(value);
}

function initSemanticFlow() {
  const figure = document.querySelector('.semantic-flow');
  if (!figure || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      figure.querySelectorAll('[data-flow-step]').forEach((step, index) => {
        step.style.setProperty('--flow-delay', (index * 260) + 'ms');
      });
      figure.classList.add('flow-visible');
    }
  }, { threshold:0.3 });
  observer.observe(figure);
}
initSemanticFlow();

const certificateDialog = document.getElementById('certificate-dialog');
const certificateButton = document.querySelector('.certificate-open');
certificateButton.addEventListener('click', () => {
  certificateDialog.querySelectorAll('img[data-src]').forEach(image => {
    image.src = image.dataset.src;
    image.removeAttribute('data-src');
  });
  certificateDialog.showModal();
  certificateDialog.querySelector('.certificate-pages').scrollTop = 0;
});
certificateDialog.addEventListener('click', event => {
  if (event.target === certificateDialog) certificateDialog.close();
});


function initProjectStacks() {
  let active = null;
  let pinned = false;

  function close() {
    if (!active) return;
    document.getElementById(active.getAttribute('aria-controls')).hidden = true;
    active.setAttribute('aria-expanded', 'false');
    active.removeAttribute('aria-describedby');
    active = null;
    pinned = false;
  }
  function show(button) {
    if (active === button) return;
    close();
    active = button;
    const id = button.getAttribute('aria-controls');
    document.getElementById(id).hidden = false;
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-describedby', id);
  }
  document.querySelectorAll('.tech-group').forEach(group => {
    group.querySelectorAll('.tech-chip').forEach(button => {
      button.addEventListener('pointerenter', event => {
        if (event.pointerType === 'mouse') show(button);
      });
      button.addEventListener('focus', () => show(button));
      button.addEventListener('click', () => {
        if (active === button && pinned) return close();
        show(button);
        pinned = true;
      });
    });
    group.addEventListener('pointerleave', () => {
      if (group.contains(active) && !pinned && document.activeElement !== active) close();
    });
    group.addEventListener('focusout', event => {
      if (group.contains(active) && !group.contains(event.relatedTarget)) close();
    });
  });
  document.addEventListener('pointerdown', event => {
    if (active && !event.target.closest('.tech-group')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
}
initProjectStacks();

function initProjectGallery(gallery) {
  const frames = [...gallery.querySelectorAll('.gallery-slide')];
  const expand = gallery.querySelector('.gallery-expand');
  const viewer = expand && document.getElementById(expand.getAttribute('aria-controls'));
  const tools = gallery.querySelector('.gallery-tools');
  const toggle = tools.querySelector('[data-toggle]');
  const counter = gallery.querySelector('.gallery-index');
  const caption = gallery.querySelector('figcaption strong');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let requested = 0;
  const slideIndex = index => (index + frames.length) % frames.length;
  const images = frames.map(frame => frame.querySelector('img'));

  function preloadNearby() {
    for (const offset of [0, 1, -1]) {
      images[slideIndex(current + offset)].loading = 'eager';
    }
  }
  let visible = false;
  let hovered = false;
  let playing = !motion.matches;
  let timer;

  async function advance(offset) {
    const target = requested = slideIndex(requested + offset);
    const image = images[target];
    image.loading = 'eager';
    if (target !== current) {
      try {
        await image.decode();
      } catch {

      }
    }
    if (target !== requested) return;
    frames[current].hidden = true;
    current = target;
    frames[current].hidden = false;
    counter.textContent = [current + 1, frames.length].map(n => String(n).padStart(2,'0')).join(' / ');
    caption.textContent = frames[current].dataset.caption;
    if (viewer?.open) syncView();
    preloadNearby();
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    toggle.setAttribute('aria-label',playing ? '자동 전환 일시정지' : '자동 전환 재생');
    toggle.toggleAttribute('data-paused', !playing);
    if (requested === current && visible && playing && !hovered && !document.hidden && !viewer?.open) {
      timer = setTimeout(() => advance(1), 5500);
    }
  }
  function syncView() {
    const source = images[current];
    const viewImage = viewer.querySelector('.gallery-view-image');
    viewImage.src = source.dataset.fullSrc || source.currentSrc || source.src;
    viewImage.alt = source.alt;
    viewer.querySelector('.gallery-view-bar strong').textContent = caption.textContent;
    viewer.querySelector('.gallery-view-count').textContent = counter.textContent;
  }
  if (viewer) {
    expand.hidden = false;
    expand.addEventListener('click', () => {
      syncView();
      viewer.showModal();
      schedule();
    });
    viewer.querySelector('[data-dismiss]').addEventListener('click', () => viewer.close());
    viewer.querySelectorAll('[data-step]').forEach(button => {
      button.addEventListener('click', () => advance(Number(button.dataset.step)));
    });
    viewer.addEventListener('click', event => {
      if (event.target !== viewer) return;
      const {left, right, top, bottom} = viewer.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) viewer.close();
    });
    viewer.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      advance(event.key === 'ArrowLeft' ? -1 : 1);
    });
    viewer.addEventListener('close', () => {
      expand.focus({preventScroll:true});
      schedule();
    });
  }
  tools.hidden = false;
  tools.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button === toggle) {
      playing = !playing;
    } else {
      playing = false;
      advance(Number(button.dataset.move));
    }
    schedule();
  });
  gallery.addEventListener('pointerenter', event => {
    hovered = event.pointerType === 'mouse';
    schedule();
  });
  gallery.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  gallery.addEventListener('focusin', event => {
    if (event.target.matches(':focus-visible')) { playing = false; schedule(); }
  });
  const approaching = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    preloadNearby();
    approaching.disconnect();
  }, { rootMargin:'480px 0px' });
  approaching.observe(gallery);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= .4;
    schedule();
  }, { threshold:[0,.4] }).observe(gallery);
  motion.addEventListener('change', () => { playing = !motion.matches; schedule(); });
  document.addEventListener('visibilitychange', schedule);
  schedule();
}
document.querySelectorAll('.project-gallery').forEach(initProjectGallery);

function initStoreStrip(figure) {
  const viewport = figure.querySelector('.nook-viewport');
  const sequence = viewport.firstElementChild;
  const toggle = figure.querySelector('button');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let duplicate, width = 0, visible = false, paused = false, hovered = false;
  let frame = 0, previous = 0, position = 0;

  function advance(time) {
    if (previous) position = (position + Math.min(time - previous, 64) * .025) % width;
    viewport.scrollLeft = position;
    previous = time;
    frame = requestAnimationFrame(advance);
  }

  function update() {
    cancelAnimationFrame(frame);
    previous = 0;
    position = width ? viewport.scrollLeft % width : 0;
    toggle.hidden = !duplicate;
    toggle.toggleAttribute('data-paused', paused);
    toggle.setAttribute('aria-label', paused ? '화면 자동 이동 재생' : '화면 자동 이동 일시정지');
    if (duplicate && visible && !document.hidden && !paused && !hovered) {
      frame = requestAnimationFrame(advance);
    }
  }

  function measure() {
    width = sequence.offsetWidth;
    const loop = width > viewport.clientWidth + 1 && !reduced.matches;
    if (loop && !duplicate) {
      duplicate = sequence.cloneNode(true);
      duplicate.setAttribute('aria-hidden', 'true');
      duplicate.inert = true;
      viewport.append(duplicate);
    } else if (!loop && duplicate) {
      viewport.scrollLeft %= width || 1;
      duplicate.remove();
      duplicate = null;
    }
    viewport.tabIndex = width > viewport.clientWidth + 1 ? 0 : -1;
    update();
  }

  function pause() { paused = true; update(); }
  toggle.addEventListener('click', () => { paused = !paused; update(); });
  viewport.addEventListener('pointerdown', pause, {passive:true});
  viewport.addEventListener('wheel', event => { if (event.deltaX || event.shiftKey) pause(); }, {passive:true});
  viewport.addEventListener('focus', pause);
  figure.addEventListener('pointerenter', event => { hovered = event.pointerType === 'mouse'; update(); });
  figure.addEventListener('pointerleave', () => { hovered = false; update(); });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }).observe(figure);
  const size = new ResizeObserver(measure);
  size.observe(sequence);
  size.observe(viewport);
  reduced.addEventListener('change', measure);
  document.addEventListener('visibilitychange', update);
  measure();
}
document.querySelectorAll('.nook-strip').forEach(initStoreStrip);



/* ==========================================================
   IQ TRAVEL — Animation Engine
   Three.js Greece Map + GSAP ScrollTrigger + Lenis + Lang Toggle
   ========================================================== */

// ─── SMOOTH SCROLL (Lenis) ───
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const lenis = new Lenis({
    duration: 1.4,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 2,
});

// Single RAF loop — drive Lenis through GSAP ticker only (no double loop)
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
lenis.on('scroll', ScrollTrigger.update);

// After full page load (fonts, images, layout stable) — refresh ScrollTrigger
// This is the main fix for the mobile "need to refresh" bug
window.addEventListener('load', () => {
    ScrollTrigger.refresh();
});

// ─── LANGUAGE TOGGLE ───
let currentLang = 'el'; // Greek is default

function setLanguage(lang) {
    currentLang = lang;
    const elements = document.querySelectorAll('[data-el][data-en]');
    elements.forEach(el => {
        const text = el.getAttribute(`data-${lang}`);
        if (text) {
            el.innerHTML = text;
        }
    });

    // Update toggle button states
    document.querySelectorAll('.lang-toggle').forEach(btn => {
        const active = btn.querySelector('.lang-active');
        const inactive = btn.querySelector('.lang-inactive');
        if (lang === 'el') {
            active.textContent = 'EL';
            inactive.textContent = 'EN';
        } else {
            active.textContent = 'EN';
            inactive.textContent = 'EL';
        }
    });

    // Update HTML lang attribute
    document.documentElement.lang = lang === 'el' ? 'el' : 'en';

    // Toggle funding logos & content based on language
    document.querySelectorAll('.funding-logo-gr').forEach(el => el.style.display = lang === 'el' ? '' : 'none');
    document.querySelectorAll('.funding-logo-en').forEach(el => el.style.display = lang === 'en' ? '' : 'none');
    document.querySelectorAll('.funding-content-gr').forEach(el => el.style.display = lang === 'el' ? '' : 'none');
    document.querySelectorAll('.funding-content-en').forEach(el => el.style.display = lang === 'en' ? '' : 'none');
}

// Bind toggle buttons
document.querySelectorAll('.lang-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const newLang = currentLang === 'el' ? 'en' : 'el';
        setLanguage(newLang);
    });
});

// ─── THREE.JS — GREECE MAP WITH COMMUTING ROUTES ───
(function initThreeJS() {
    const canvas = document.getElementById('three-canvas');
    const container = document.getElementById('hero-map-container');
    if (!canvas || !container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 1000);
    camera.position.set(0, 0, 22); // zoomed out enough to show all of Greece

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const worldGroup = new THREE.Group();
    worldGroup.position.set(0, 0, 0);
    scene.add(worldGroup);

    // ── Geo → Scene coordinate conversion ──
    // Map lat/lng directly into SVG viewBox space (-5 -5 85 90)
    // then convert SVG coords to Three.js scene units so dots sit exactly on the SVG map
    // SVG viewBox: x: -5→80 (85 wide), y: -5→85 (90 tall)
    // Greece bounds: lng 19.3→29.6, lat 34.7→41.8
    const LNG_MIN = 19.3,  LNG_MAX = 29.6;
    const LAT_MIN = 34.7,  LAT_MAX = 41.8;
    const SVG_X_MIN = -5,  SVG_X_MAX = 80;  // viewBox x range
    const SVG_Y_MIN = -5,  SVG_Y_MAX = 85;  // viewBox y range (y flipped: north=low y)

    // Scene units: shift SVG_CX left of geometric centre to push dots rightward
    // Geometric centre would be 37.5; using 30 shifts all dots ~1.2 units right
    const SVG_CX = 30;   // <– lowered from 37.5 to shift dots right
    const SVG_CY = (SVG_Y_MIN + SVG_Y_MAX) / 2; // 40
    const SVG_SCALE = 0.155; // scene units per SVG unit — tuned to camera z:22

    function geo(lat, lng) {
        const svgX = SVG_X_MIN + (lng - LNG_MIN) / (LNG_MAX - LNG_MIN) * (SVG_X_MAX - SVG_X_MIN);
        const svgY = SVG_Y_MIN + (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * (SVG_Y_MAX - SVG_Y_MIN);
        return {
            x: (svgX - SVG_CX) * SVG_SCALE,
            y: -(svgY - SVG_CY) * SVG_SCALE
        };
    }

    // SVG base layer handles the map — Three.js overlays markers, routes, vehicles, particles

    // ── CITY / PORT MARKERS ──
    const cities = [
        // ── Major hubs (well spaced across the country) ──
        { name: 'Αθήνα',           lat: 37.98, lng: 23.73, size: 0.17, major: true },
        { name: 'Θεσσαλονίκη',    lat: 40.58, lng: 22.97, size: 0.15, major: true },
        { name: 'Ηράκλειο',        lat: 35.34, lng: 25.14, size: 0.14, major: true },
        { name: 'Πάτρα',           lat: 38.25, lng: 21.73, size: 0.13, major: true },
        { name: 'Ρόδος',           lat: 36.43, lng: 28.22, size: 0.12, major: true },
        // ── Mainland — spread across N/W/C/S ──
        { name: 'Ιωάννινα',        lat: 39.66, lng: 20.85, size: 0.09, major: false },
        { name: 'Κοζάνη',          lat: 40.30, lng: 21.79, size: 0.09, major: false },
        { name: 'Λάρισα',          lat: 39.64, lng: 22.42, size: 0.10, major: false },
        { name: 'Βόλος',           lat: 39.37, lng: 22.95, size: 0.09, major: false },
        { name: 'Καβάλα',          lat: 40.94, lng: 24.40, size: 0.09, major: false },
        { name: 'Αλεξανδρούπολη',  lat: 40.85, lng: 25.87, size: 0.08, major: false },
        { name: 'Λαμία',           lat: 38.90, lng: 22.43, size: 0.08, major: false },
        { name: 'Άγρινιο',         lat: 38.62, lng: 21.41, size: 0.08, major: false },
        { name: 'Τρίπολη',         lat: 37.51, lng: 22.38, size: 0.08, major: false },
        { name: 'Καλαμάτα',        lat: 37.04, lng: 22.11, size: 0.08, major: false },
        // ── Ionian — one per island, well spaced ──
        { name: 'Κέρκυρα',         lat: 39.62, lng: 19.92, size: 0.10, major: false },
        { name: 'Λευκάδα',         lat: 38.83, lng: 20.71, size: 0.08, major: false },
        { name: 'Κεφαλονιά',       lat: 38.18, lng: 20.45, size: 0.09, major: false },
        { name: 'Ζάκυνθος',        lat: 37.65, lng: 20.90, size: 0.09, major: false },
        // ── Cyclades — curated, no near-duplicates ──
        { name: 'Άνδρος',          lat: 37.83, lng: 24.90, size: 0.08, major: false },
        { name: 'Σύρος',           lat: 37.45, lng: 24.94, size: 0.08, major: false },
        { name: 'Μύκονος',         lat: 37.45, lng: 25.33, size: 0.10, major: false },
        { name: 'Νάξος',           lat: 37.05, lng: 25.38, size: 0.09, major: false },
        { name: 'Πάρος',           lat: 37.09, lng: 25.12, size: 0.08, major: false },
        { name: 'Μήλος',           lat: 36.72, lng: 24.42, size: 0.08, major: false },
        { name: 'Σαντορίνη',       lat: 36.39, lng: 25.46, size: 0.10, major: false },
        { name: 'Αμοργός',         lat: 36.83, lng: 25.90, size: 0.08, major: false },
        { name: 'Κέα',             lat: 37.64, lng: 24.20, size: 0.07, major: false },
        { name: 'Σίφνος',          lat: 36.97, lng: 24.73, size: 0.07, major: false },
        // ── NE Aegean — one per island ──
        { name: 'Θάσος',           lat: 40.69, lng: 24.70, size: 0.08, major: false },
        { name: 'Λήμνος',          lat: 39.91, lng: 25.35, size: 0.08, major: false },
        { name: 'Λέσβος',          lat: 39.10, lng: 26.30, size: 0.10, major: false },
        { name: 'Χίος',            lat: 38.37, lng: 26.07, size: 0.09, major: false },
        { name: 'Ικαρία',          lat: 37.60, lng: 26.17, size: 0.07, major: false },
        { name: 'Σάμος',           lat: 37.75, lng: 26.85, size: 0.09, major: false },
        // ── Sporades — spread out ──
        { name: 'Σκιάθος',         lat: 39.16, lng: 23.49, size: 0.08, major: false },
        { name: 'Σκόπελος',        lat: 39.08, lng: 23.78, size: 0.07, major: false },
        // ── Dodecanese — one per island, spread ──
        { name: 'Πάτμος',          lat: 37.32, lng: 26.55, size: 0.08, major: false },
        { name: 'Κως',             lat: 36.89, lng: 27.10, size: 0.09, major: false },
        { name: 'Νίσυρος',         lat: 36.59, lng: 27.17, size: 0.07, major: false },
        // ── Saronic — spread out ──
        { name: 'Αίγινα',          lat: 37.75, lng: 23.43, size: 0.08, major: false },
        { name: 'Ύδρα',            lat: 37.35, lng: 23.46, size: 0.07, major: false },
        { name: 'Σπέτσες',         lat: 37.26, lng: 23.10, size: 0.07, major: false },
        // ── Crete — spread across east/west ──
        { name: 'Χανιά',           lat: 35.51, lng: 24.02, size: 0.10, major: false },
        { name: 'Ρέθυμνο',         lat: 35.37, lng: 24.47, size: 0.08, major: false },
        { name: 'Άγιος Νικόλαος',  lat: 35.19, lng: 25.72, size: 0.08, major: false },
        { name: 'Σητεία',          lat: 35.21, lng: 26.10, size: 0.07, major: false },
    ];

    const locationGroup = new THREE.Group();
    const dotData = [];

    cities.forEach(city => {
        const pos = geo(city.lat, city.lng);
        const sz = city.size;

        // Outer soft glow disk
        const glowGeo = new THREE.CircleGeometry(sz * 3, 32);
        const glowMat = new THREE.MeshBasicMaterial({
            color: city.major ? 0x00e8c0 : 0x00bcd4,
            transparent: true,
            opacity: 0.03,
            side: THREE.DoubleSide
        });
        const glowDisk = new THREE.Mesh(glowGeo, glowMat);
        glowDisk.position.set(pos.x, pos.y, 0.001);
        locationGroup.add(glowDisk);

        // Pulsing halo ring
        const ringGeo = new THREE.RingGeometry(sz * 1.6, sz * 2.6, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: city.major ? 0x00e8c0 : 0x00bcd4,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(pos.x, pos.y, 0.008);
        locationGroup.add(ring);

        // Second ring for major cities
        if (city.major) {
            const outerRingGeo = new THREE.RingGeometry(sz * 3.2, sz * 4.5, 32);
            const outerRingMat = new THREE.MeshBasicMaterial({
                color: 0x00c9a7,
                transparent: true,
                opacity: 0.1,
                side: THREE.DoubleSide
            });
            const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
            outerRing.position.set(pos.x, pos.y, 0.004);
            locationGroup.add(outerRing);
        }

        // Core dot
        const dotGeo = new THREE.CircleGeometry(sz, 32);
        const dotMat = new THREE.MeshBasicMaterial({
            color: city.major ? 0x00ffe0 : 0x00d4e8,
            transparent: true,
            opacity: city.major ? 1.0 : 0.85,
            side: THREE.DoubleSide
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(pos.x, pos.y, 0.012);
        locationGroup.add(dot);

        dotData.push({ dot, ring, ringMat, glowDisk, glowMat, pos, city });
    });

    worldGroup.add(locationGroup);

    // ── AMBIENT SEA PARTICLES ──
    const seaCount = 1800;
    const seaGeo = new THREE.BufferGeometry();
    const seaPos = new Float32Array(seaCount * 3);
    const seaCol = new Float32Array(seaCount * 3);
    const seaSizes = new Float32Array(seaCount);

    for (let i = 0; i < seaCount; i++) {
        seaPos[i * 3]     = (Math.random() - 0.5) * 22;
        seaPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
        seaPos[i * 3 + 2] = (Math.random() - 0.5) * 3 - 1.5;

        const m = Math.random();
        // Vary between deep ocean blue and cyan
        seaCol[i * 3]     = 0;
        seaCol[i * 3 + 1] = 0.35 + m * 0.45;
        seaCol[i * 3 + 2] = 0.55 + m * 0.35;
        seaSizes[i] = Math.random();
    }

    seaGeo.setAttribute('position', new THREE.BufferAttribute(seaPos, 3));
    seaGeo.setAttribute('color',    new THREE.BufferAttribute(seaCol, 3));

    const seaMat = new THREE.PointsMaterial({
        size: 0.022,
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
    });

    const seaParticles = new THREE.Points(seaGeo, seaMat);
    worldGroup.add(seaParticles);

    // ── MOUSE INTERACTION ──
    let mouseX = 0, mouseY = 0;
    let smoothX = 0, smoothY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    });

    // ── ANIMATION LOOP ──
    function animate() {
        requestAnimationFrame(animate);
        const time = Date.now() * 0.001;

        // Smooth parallax
        smoothX += (mouseX * 0.45 - smoothX) * 0.03;
        smoothY += (mouseY * 0.28 - smoothY) * 0.03;
        worldGroup.position.x = smoothX * 0.75;
        worldGroup.position.y = smoothY * 0.4;
        worldGroup.rotation.y = smoothX * 0.012;
        worldGroup.rotation.x = -smoothY * 0.008;

        // Pulse city markers
        dotData.forEach((d, i) => {
            const pulse = Math.sin(time * 2.2 + i * 0.6) * 0.5 + 0.5;
            d.ringMat.opacity = 0.12 + pulse * 0.35;
            d.ring.scale.setScalar(1 + pulse * 0.4);
            d.glowMat.opacity = 0.015 + pulse * 0.04;
        });

        // Drift sea particles
        const positions = seaGeo.attributes.position.array;
        for (let i = 0; i < seaCount; i++) {
            positions[i * 3 + 1] += Math.sin(time * 0.35 + i * 0.01) * 0.0005;
            positions[i * 3]     += Math.cos(time * 0.22 + i * 0.018) * 0.0003;
        }
        seaGeo.attributes.position.needsUpdate = true;

        renderer.render(scene, camera);
    }

    animate();

    // Resize
    window.addEventListener('resize', () => {
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
        renderer.setSize(cw, ch);
    });
})();

// ─── PRELOADER ───
const loaderTl = gsap.timeline({
    onComplete: () => {
        document.getElementById('loader').style.display = 'none';
        heroEntrance();
    }
});

loaderTl
    .to('.loader-logo-img', {
        opacity: 1, scale: 1, y: 0,
        duration: 0.8, ease: 'back.out(1.7)'
    })
    .to('.loader-tagline', { opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.3')
    .to('.loader-bar-fill', { width: '100%', duration: 1.5, ease: 'power2.inOut' }, '-=0.3')
    .to('.loader-inner', { scale: 0.9, opacity: 0, duration: 0.4, ease: 'power2.in' }, '+=0.2')
    .to('.loader', { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '-=0.2');

// ─── HERO ENTRANCE ───
function heroEntrance() {
    const heroTl = gsap.timeline();
    heroTl
        .to('.hero-bg-layer', { scale: 1, duration: 2, ease: 'power2.out' })
        .to('.hero-badge', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=1.5')
        .to('.title-line span', { y: 0, duration: 1.2, stagger: 0.15, ease: 'expo.out' }, '-=1.2')
        .to('.hero-subtitle', { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }, '-=0.6')
        .to('.hero-buttons', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.5')
        .to('.scroll-cue', { opacity: 1, duration: 1, ease: 'power2.out' }, '-=0.3');
}

// ─── HERO PARALLAX ───
gsap.to('.hero-bg-layer', {
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    y: 250, scale: 1.3, ease: 'none'
});

gsap.to('.hero-content', {
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    y: 150, opacity: 0, ease: 'none'
});

// ─── NAVBAR + TOPBAR SCROLL ───
let lastScrollY = 0;
ScrollTrigger.create({
    start: 100,
    onUpdate: (self) => {
        const nav = document.getElementById('navbar');
        const topbar = document.getElementById('iq-topbar');
        const scrollY = self.scroll();

        if (scrollY > 100) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        // Hide topbar when scrolling down, show when at top
        if (topbar) {
            if (scrollY > 60 && scrollY > lastScrollY) {
                topbar.style.transform = 'translateY(-100%)';
                nav.style.top = '0';
            } else if (scrollY < 60 || scrollY < lastScrollY) {
                topbar.style.transform = 'translateY(0)';
                nav.style.top = '34px';
            }
        }

        lastScrollY = scrollY;
    }
});

// ─── HAMBURGER ───
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('open');
    });
    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            mobileMenu.classList.remove('open');
        });
    });
}

// ─── SMOOTH ANCHOR SCROLL ───
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) lenis.scrollTo(target, { offset: -114, duration: 1.5 });
    });
});

// ─── SCROLL ANIMATIONS ───
gsap.from('.about .section-label', {
    scrollTrigger: { trigger: '.about', start: 'top 80%' },
    y: 30, opacity: 0, duration: 0.8, ease: 'power3.out'
});

gsap.from('.about .big-heading .line-reveal', {
    scrollTrigger: { trigger: '.about .big-heading', start: 'top 80%' },
    y: 80, opacity: 0, duration: 1, stagger: 0.15, ease: 'expo.out'
});

gsap.from('.about-desc', {
    scrollTrigger: { trigger: '.about-right', start: 'top 75%' },
    y: 40, opacity: 0, duration: 0.8, stagger: 0.2, ease: 'power3.out'
});

gsap.from('.highlight', {
    scrollTrigger: { trigger: '.about-highlights', start: 'top 85%' },
    y: 30, opacity: 0, scale: 0.9, duration: 0.6, stagger: 0.12, ease: 'back.out(1.7)'
});

gsap.from('.services .section-label', {
    scrollTrigger: { trigger: '.services', start: 'top 80%' },
    y: 30, opacity: 0, duration: 0.8
});

gsap.from('.services .section-heading .line-reveal', {
    scrollTrigger: { trigger: '.services .section-heading', start: 'top 80%' },
    y: 60, opacity: 0, duration: 1, stagger: 0.12, ease: 'expo.out'
});

gsap.from('.service-card', {
    scrollTrigger: { trigger: '.services-grid', start: 'top 80%' },
    y: 80, opacity: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out'
});

gsap.from('.how-it-works .section-label', {
    scrollTrigger: { trigger: '.how-it-works', start: 'top 80%' },
    y: 30, opacity: 0, duration: 0.8
});

gsap.from('.how-it-works .section-heading .line-reveal', {
    scrollTrigger: { trigger: '.how-it-works .section-heading', start: 'top 80%' },
    y: 60, opacity: 0, duration: 1, stagger: 0.12, ease: 'expo.out'
});

gsap.from('.step', {
    scrollTrigger: { trigger: '.steps-grid', start: 'top 80%' },
    y: 60, opacity: 0, duration: 0.8, stagger: 0.2, ease: 'power3.out'
});

gsap.from('.step-number', {
    scrollTrigger: { trigger: '.steps-grid', start: 'top 75%' },
    scale: 0, duration: 0.6, stagger: 0.2, ease: 'back.out(2)', delay: 0.3
});

// Stats Counter
document.querySelectorAll('.stat-number').forEach(num => {
    const target = parseInt(num.getAttribute('data-target'));
    ScrollTrigger.create({
        trigger: num, start: 'top 85%', once: true,
        onEnter: () => {
            gsap.to(num, {
                innerText: target, duration: 2, snap: { innerText: 1 }, ease: 'power2.out',
                onUpdate: function () { num.textContent = Math.round(this.targets()[0].innerText || 0); }
            });
            gsap.from(num.closest('.stat'), { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out' });
        }
    });
});

gsap.from('.showcase .section-label', {
    scrollTrigger: { trigger: '.showcase', start: 'top 80%' },
    y: 30, opacity: 0, duration: 0.8
});

gsap.from('.showcase .section-heading .line-reveal', {
    scrollTrigger: { trigger: '.showcase .section-heading', start: 'top 80%' },
    y: 60, opacity: 0, duration: 1, stagger: 0.12, ease: 'expo.out'
});

gsap.from('.feature-item', {
    scrollTrigger: { trigger: '.feature-list', start: 'top 80%' },
    x: -50, opacity: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out'
});

// ─── PHONE ENTRANCE ───
(function () {
    const phoneEl = document.querySelector('.phone-frame');
    if (!phoneEl) return;

    phoneEl.style.animation = 'none';
    phoneEl.style.opacity   = '0';

    // Start: slightly below, gently tilted, faded out
    gsap.set(phoneEl, {
        transformPerspective: 1200,
        transformOrigin: '50% 100%',
        rotateX: 18,
        rotateY: -22,
        y: 60,
        scale: 0.88,
        opacity: 0,
    });

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: '.showcase-phone',
            start: 'top 82%',
            once: true,
        }
    });

    tl
        // ① Rise into place — single smooth arc, no bouncing
        .to(phoneEl, {
            rotateX: 4,
            rotateY: -6,
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 1.4,
            ease: 'expo.out',
        })
        // ② Seamlessly hand off to gentle ambient float
        .call(() => {
            gsap.to(phoneEl, {
                rotateY: 6,
                rotateX: -4,
                y: -12,
                duration: 4,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
            });
        });
})();


// ─── PRICING SECTION ───
gsap.from('.pricing .section-label', {
    scrollTrigger: { trigger: '.pricing', start: 'top 80%' },
    y: 30, opacity: 0, duration: 0.8, ease: 'power3.out'
});

gsap.from('.pricing .section-heading .line-reveal', {
    scrollTrigger: { trigger: '.pricing .section-heading', start: 'top 80%' },
    y: 60, opacity: 0, duration: 1, stagger: 0.12, ease: 'expo.out'
});

gsap.from('.pricing-subtitle', {
    scrollTrigger: { trigger: '.pricing-subtitle', start: 'top 85%' },
    y: 20, opacity: 0, duration: 0.8, ease: 'power3.out'
});

gsap.from('.pricing-card', {
    scrollTrigger: { trigger: '.pricing-grid', start: 'top 80%' },
    y: 70, opacity: 0, duration: 0.9, stagger: 0.15, ease: 'power3.out'
});

gsap.from('.pricing-note', {
    scrollTrigger: { trigger: '.pricing-note', start: 'top 92%' },
    y: 15, opacity: 0, duration: 0.7, ease: 'power2.out'
});

gsap.from('.footer-brand, .footer-nav, .footer-copy', {
    scrollTrigger: { trigger: 'footer', start: 'top 95%' },
    y: 16, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out'
});

// ─── CONTACT MODAL ───
(function () {
    const overlay  = document.getElementById('contact-modal');
    const form     = document.getElementById('contact-form');
    const success  = document.getElementById('contact-success');
    const closeBtn = document.getElementById('contact-modal-close');

    function openModal() {
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        // reset
        form.hidden    = false;
        success.hidden = true;
        form.reset();
    }

    function closeModal() {
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    // Triggers: nav button, mobile button, pricing CTA strip button
    document.querySelectorAll('#nav-contact-btn, #mobile-contact-btn, .open-contact').forEach(el => {
        el.addEventListener('click', openModal);
    });

    // Close via ✕ button
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Close via overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Close via Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
    });

    // ── Web3Forms endpoint (free email forwarding) ──
    const WEB3FORMS_KEY = '0910b7db-91df-437f-8d6e-b554fbaf0257';
    const FORM_CONFIGURED = !WEB3FORMS_KEY.includes('YOUR_ACCESS_KEY');

    // Form submit → POST to Web3Forms API
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // ── Validate required fields ──
            const inputs = form.querySelectorAll('[required]');
            let valid = true;
            inputs.forEach(inp => {
                if (!inp.value.trim()) {
                    inp.style.borderColor = 'rgba(255,80,80,0.55)';
                    valid = false;
                } else {
                    inp.style.borderColor = '';
                }
            });
            if (!valid) return;

            // ── Lock button + show loading state ──
            const submitBtn = form.querySelector('.contact-submit');
            const submitText = submitBtn.querySelector('.contact-submit-text');
            const originalText = submitText.textContent;
            submitBtn.disabled = true;
            submitText.textContent = currentLang === 'en' ? 'Sending...' : 'Αποστολή...';

            // ── Guard: endpoint not configured yet ──
            if (!FORM_CONFIGURED) {
                submitBtn.disabled = false;
                submitText.textContent = originalText;
                let errEl = form.querySelector('.contact-error-msg');
                if (!errEl) {
                    errEl = document.createElement('p');
                    errEl.className = 'contact-error-msg';
                    form.appendChild(errEl);
                }
                errEl.textContent = currentLang === 'en'
                    ? 'Form not yet connected. Please try again later.'
                    : 'Η φόρμα δεν έχει συνδεθεί ακόμα. Δοκιμάστε αργότερα.';
                gsap.from(errEl, { opacity: 0, y: 6, duration: 0.3 });
                gsap.fromTo(submitBtn, { x: -6 }, { keyframes: { x: [-6, 6, -4, 4, 0] }, duration: 0.4, ease: 'none' });
                return;
            }

            // ── Collect form data ──
            const payload = {
                access_key: WEB3FORMS_KEY,
                name:    form.querySelector('[name="name"]').value.trim(),
                email:   form.querySelector('[name="email"]').value.trim(),
                subject: form.querySelector('[name="subject"]').value || 'IQ Travel Contact Form',
                message: form.querySelector('[name="message"]').value.trim(),
                from_name: 'IQ Travel Website',
            };

            try {
                const res = await fetch('https://api.web3forms.com/submit', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(payload),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.message || 'Server error');
                }

                // ── Success ──
                gsap.to(form, {
                    opacity: 0, y: -12, duration: 0.3, ease: 'power2.in',
                    onComplete: () => {
                        form.hidden    = true;
                        success.hidden = false;
                        gsap.from(success, { opacity: 0, y: 12, duration: 0.4, ease: 'power3.out' });
                        setTimeout(closeModal, 3200);
                    }
                });

            } catch (err) {
                // ── Error state ──
                console.error('Contact form error:', err);
                submitBtn.disabled = false;
                submitText.textContent = originalText;

                // Shake the button
                gsap.fromTo(submitBtn, { x: -6 }, { keyframes: { x: [-6, 6, -4, 4, 0] }, duration: 0.4, ease: 'none' });

                // Show inline error below form
                let errEl = form.querySelector('.contact-error-msg');
                if (!errEl) {
                    errEl = document.createElement('p');
                    errEl.className = 'contact-error-msg';
                    form.appendChild(errEl);
                }
                errEl.textContent = currentLang === 'en'
                    ? 'Something went wrong. Please try again.'
                    : 'Κάτι πήγε στραβά. Παρακαλώ δοκιμάστε ξανά.';
                gsap.from(errEl, { opacity: 0, y: 6, duration: 0.3 });
            }
        });
    }
})();

// ─── MAGNETIC BUTTONS ───
document.querySelectorAll('.nav-cta').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        gsap.to(btn, { x: x * 0.18, y: y * 0.18, duration: 0.3, ease: 'power2.out' });
    });
    btn.addEventListener('mouseleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
    });
});

// ─── SERVICE CARD 3D TILT ───
document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(card, { rotateY: x * 10, rotateX: -y * 10, duration: 0.4, ease: 'power2.out', transformPerspective: 800 });
    });
    card.addEventListener('mouseleave', () => {
        gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    });
});

// ─── FUNDING MODAL ───
(function () {
    const overlay  = document.getElementById('funding-modal');
    const closeBtn = document.getElementById('funding-modal-close');
    const openBtn  = document.getElementById('funding-sticky-btn');

    function openFundingModal() {
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function closeFundingModal() {
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    if (openBtn) openBtn.addEventListener('click', openFundingModal);
    if (closeBtn) closeBtn.addEventListener('click', closeFundingModal);

    // Close on overlay click
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFundingModal();
    });

    // Close via Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('is-open')) closeFundingModal();
    });
})();

console.log('🚀 IQ-TRAVEL — Greece Map v2 + GSAP Animations Loaded');

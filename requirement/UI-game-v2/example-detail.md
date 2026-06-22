<!DOCTYPE html><html class="light" lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Machine Ledger - Foundry Detail</title>
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<!-- Google Fonts: Crimson Pro (Serif), JetBrains Mono (Mono), Inter (Sans) -->
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;700&amp;family=Inter:wght@400;500;600;800&amp;display=swap" rel="stylesheet">
<!-- Material Symbols -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            "colors": {
                    "inverse-primary": "#c1c8ca",
                    "on-secondary-fixed-variant": "#4e453d",
                    "surface-container-highest": "#e7e2d9",
                    "surface-container": "#f3ede4",
                    "on-tertiary": "#ffffff",
                    "surface-tint": "#586062",
                    "outline-variant": "#c3c7c8",
                    "error": "#ba1a1a",
                    "tertiary-container": "#2a3538",
                    "background": "#fff9ef",
                    "secondary-fixed-dim": "#d2c4b9",
                    "primary": "#181f21",
                    "tertiary-fixed": "#d9e4e9",
                    "on-surface-variant": "#434749",
                    "tertiary-fixed-dim": "#bdc8cd",
                    "on-error": "#ffffff",
                    "ink-black": "#2D3436",
                    "ledger-paper": "#FDFBF7",
                    "on-tertiary-fixed-variant": "#3e484c",
                    "primary-container": "#2d3436",
                    "on-secondary": "#ffffff",
                    "inverse-on-surface": "#f6f0e7",
                    "on-primary-fixed-variant": "#41484a",
                    "inverse-surface": "#32302a",
                    "surface-highlight": "#E8DFD0",
                    "on-primary-container": "#959c9f",
                    "outline": "#747879",
                    "surface-container-high": "#ede7de",
                    "surface-container-low": "#f9f3ea",
                    "surface-bright": "#fff9ef",
                    "on-error-container": "#93000a",
                    "surface-dim": "#dfd9d1",
                    "surface-variant": "#e7e2d9",
                    "on-primary-fixed": "#161d1f",
                    "error-container": "#ffdad6",
                    "on-primary": "#ffffff",
                    "secondary": "#675c54",
                    "on-background": "#1d1b16",
                    "on-tertiary-fixed": "#131d21",
                    "on-secondary-fixed": "#211a14",
                    "on-surface": "#1d1b16",
                    "on-secondary-container": "#6d625a",
                    "secondary-container": "#efe0d5",
                    "faded-border": "#B2A59B",
                    "ink-grey": "#636E72",
                    "primary-fixed": "#dde4e6",
                    "parchment-base": "#FCF8F3",
                    "surface-container-lowest": "#ffffff",
                    "on-tertiary-container": "#929da2",
                    "primary-fixed-dim": "#c1c8ca",
                    "tertiary": "#152023",
                    "surface": "#fff9ef",
                    "secondary-fixed": "#efe0d5"
            },
            "borderRadius": {
                    "DEFAULT": "0.125rem",
                    "lg": "0.25rem",
                    "xl": "0.5rem",
                    "card": "2rem",
                    "full": "0.75rem"
            },
            "spacing": {
                    "margin-mobile": "16px",
                    "margin-desktop": "32px",
                    "gutter": "24px",
                    "container-max": "1440px",
                    "base": "4px"
            },
            "fontFamily": {
                    "headline-sm": ["Crimson Pro"],
                    "data-lg": ["JetBrains Mono"],
                    "headline-xl": ["Crimson Pro"],
                    "data-display": ["JetBrains Mono"],
                    "label-caps": ["Inter"],
                    "label-mono": ["JetBrains Mono"],
                    "headline-lg": ["Crimson Pro"],
                    "body-md": ["Inter"]
            },
            "fontSize": {
                    "headline-sm": ["18px", {"lineHeight": "1.2", "fontWeight": "600"}],
                    "data-lg": ["18px", {"lineHeight": "1.4", "fontWeight": "500"}],
                    "headline-xl": ["48px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "400"}],
                    "data-display": ["48px", {"lineHeight": "1", "letterSpacing": "-0.05em", "fontWeight": "400"}],
                    "label-caps": ["10px", {"lineHeight": "1", "letterSpacing": "0.2em", "fontWeight": "800"}],
                    "label-mono": ["9px", {"lineHeight": "1", "letterSpacing": "0.1em", "fontWeight": "700"}],
                    "headline-lg": ["24px", {"lineHeight": "1.2", "fontWeight": "700"}],
                    "body-md": ["14px", {"lineHeight": "1.5", "fontWeight": "400"}]
            }
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body {
            background-color: #fff9ef;
            background-image: url("https://www.transparenttextures.com/patterns/felt.png");
        }
        .vintage-shadow {
            box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08);
        }
        .trend-line {
            stroke-dasharray: 1000;
            stroke-dashoffset: 1000;
            animation: draw 2s ease-out forwards;
        }
        @keyframes draw {
            to { stroke-dashoffset: 0; }
        }
    </style>
</head>
<body class="bg-background text-on-background min-h-screen selection:bg-surface-highlight">
<!-- SideNavBar Anchor -->
<aside class="h-screen w-64 fixed left-0 top-0 bg-surface border-r border-surface-container-high flex flex-col p-gutter gap-4 z-40">
<div class="mb-8">
<div class="flex items-center gap-3 mb-2">
<div class="w-10 h-10 bg-primary flex items-center justify-center rounded-lg shadow-sm">
<span class="material-symbols-outlined text-white" style="font-variation-settings: 'FILL' 1;">factory</span>
</div>
<div>
<h1 class="font-headline-sm text-headline-sm font-extrabold uppercase tracking-widest text-primary leading-none">Machine Ledger</h1>
<p class="font-label-mono text-label-mono text-secondary mt-1">Precision Foundry v1.0</p>
</div>
</div>
</div>
<nav class="flex-grow space-y-2">
<!-- Foundry (Active) -->
<a class="flex items-center gap-3 px-4 py-3 bg-primary text-on-primary font-bold rounded-xl transition-all active:scale-95" href="#">
<span class="material-symbols-outlined" data-icon="factory" style="font-variation-settings: 'FILL' 1;">factory</span>
<span class="font-label-caps text-label-caps">Foundry</span>
</a>
<!-- Data -->
<a class="flex items-center gap-3 px-4 py-3 text-secondary hover:text-primary font-medium hover:bg-surface-container-high rounded-xl transition-all active:scale-95" href="#">
<span class="material-symbols-outlined" data-icon="analytics">analytics</span>
<span class="font-label-caps text-label-caps">Data</span>
</a>
<!-- Market -->
<a class="flex items-center gap-3 px-4 py-3 text-secondary hover:text-primary font-medium hover:bg-surface-container-high rounded-xl transition-all active:scale-95" href="#">
<span class="material-symbols-outlined" data-icon="show_chart">show_chart</span>
<span class="font-label-caps text-label-caps">Market</span>
</a>
<!-- Officer -->
<a class="flex items-center gap-3 px-4 py-3 text-secondary hover:text-primary font-medium hover:bg-surface-container-high rounded-xl transition-all active:scale-95" href="#">
<span class="material-symbols-outlined" data-icon="person">person</span>
<span class="font-label-caps text-label-caps">Officer</span>
</a>
</nav>
<div class="pt-6 border-t border-surface-container-high flex flex-col gap-2">
<button class="w-full bg-primary text-white py-3 rounded-xl font-label-caps text-label-caps tracking-widest hover:bg-ink-black transition-colors mb-4 active:scale-90">
            New Entry
        </button>
<a class="flex items-center gap-3 px-4 py-2 text-secondary font-medium font-label-caps text-label-caps hover:text-primary transition-all" href="#">
<span class="material-symbols-outlined text-sm" data-icon="help">help</span>
            Support
        </a>
<a class="flex items-center gap-3 px-4 py-2 text-secondary font-medium font-label-caps text-label-caps hover:text-primary transition-all" href="#">
<span class="material-symbols-outlined text-sm" data-icon="history">history</span>
            Archive
        </a>
</div>
</aside>
<!-- Main Content Area -->
<main class="ml-64 p-margin-desktop min-h-screen">
<!-- Top Title Block -->
<header class="mb-12 flex justify-between items-end border-b border-surface-container-high pb-4">
<div>
<span class="font-label-mono text-label-mono text-secondary uppercase tracking-widest">Department of Industrial Operations</span>
<h2 class="font-headline-xl text-headline-xl text-primary mt-2 italic font-bold">Foundry Ledger #0842</h2>
</div>
<div class="text-right">
<span class="font-label-mono text-label-mono text-secondary">TIMESTAMP</span>
<p class="font-data-lg text-data-lg text-primary tabular-nums">24 OCT 1892 // 14:00</p>
</div>
</header>
<!-- Two Column Content Grid -->
<div class="grid grid-cols-12 gap-gutter">
<!-- Left Column: Hero Art & Primary Metric -->
<div class="col-span-12 lg:col-span-7 space-y-gutter">
<!-- Large Hero Card -->
<div class="bg-ledger-paper border border-surface-container-high overflow-hidden vintage-shadow group rounded-xl">
<div class="relative h-[480px] w-full overflow-hidden">
<img class="w-full h-full object-cover grayscale-[30%] sepia-[20%] group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCgbQOQkF6AuCMNbP2kD_pAGh4xQfesAxWkx3XJcWTwAie7IzVlJ86BJ8Qr72ipr1AoyOtVHH7TJFAkHO7NtSbLmDEEPI-r39i8tcs7NNUVLsMbY2wgdkj75r03nbbvQAKMTSpjxiMVer2PJeLpCgdhQOvNsw0rychVb0rYRmV8tktMOqp1_VOZp9co3YDqN3G5LUXIEOygs4fHCIZl7Jsfxq8s4yZvDisdV-kxqrydOEyBlDKwbluKcMU5ChrEdeTWk8On7HvcZiHK">
<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
<div class="absolute bottom-6 left-6 right-6">
<span class="inline-block px-3 py-1 bg-surface/90 backdrop-blur-sm border border-outline/20 text-ink-black font-label-mono text-[10px] tracking-widest uppercase mb-2 rounded-sm">Live Production Feed</span>
<h3 class="font-headline-lg text-white text-headline-lg">Central Smelting Chamber Alpha</h3>
</div>
</div>
</div>
<!-- Primary Financial Metric -->
<div class="bg-ledger-paper border border-surface-container-high p-8 flex flex-col items-center justify-center text-center vintage-shadow rounded-xl">
<span class="font-label-caps text-label-caps text-ink-grey mb-4 tracking-[0.25em]">Current Ledger Standing</span>
<div class="flex flex-col">
<span class="font-label-mono text-label-mono text-secondary mb-1">AGGREGATE CAPITAL</span>
<h4 class="font-data-display text-data-display text-ink-black tracking-tighter tabular-nums">$1,100.00</h4>
</div>
<div class="w-1/2 h-px bg-surface-container-high mt-8"></div>
</div>
<!-- Historical Trend Graph Section -->
<div class="bg-ledger-paper border border-surface-container-high p-8 vintage-shadow flex flex-col gap-6 rounded-xl">
<div class="flex justify-between items-center border-b border-surface-container-high pb-4">
<div>
<h5 class="font-headline-sm text-headline-sm text-primary italic">Historical Production Trend</h5>
<p class="font-label-mono text-[10px] text-secondary uppercase tracking-widest mt-1">Metric: Foundry Output // Period: Last 30 Days</p>
</div>
<div class="text-right">
<span class="font-label-mono text-label-mono text-secondary">MEAN AVG.</span>
<p class="font-data-lg text-data-lg text-primary tabular-nums">74.2%</p>
</div>
</div>
<div class="relative h-64 w-full mt-4">
<!-- Grid Lines -->
<div class="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
<div class="border-t border-secondary w-full"></div>
<div class="border-t border-secondary w-full"></div>
<div class="border-t border-secondary w-full"></div>
<div class="border-t border-secondary w-full"></div>
</div>
<!-- SVG Line Chart -->
<svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
<!-- X and Y Axes -->
<line stroke="#747879" stroke-width="0.5" x1="0" x2="100" y1="100" y2="100"></line>
<line stroke="#747879" stroke-width="0.5" x1="0" x2="0" y1="0" y2="100"></line>
<!-- Trend Line (Oxidized Bronze/Charcoal style) -->
<path class="trend-line" d="M0,80 L5,75 L10,82 L15,60 L20,65 L25,55 L30,40 L35,45 L40,30 L45,35 L50,25 L55,28 L60,15 L65,22 L70,35 L75,30 L80,45 L85,40 L90,20 L95,25 L100,10" fill="none" stroke="#181f21" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path>
<!-- Area under the line -->
<path class="opacity-5" d="M0,80 L5,75 L10,82 L15,60 L20,65 L25,55 L30,40 L35,45 L40,30 L45,35 L50,25 L55,28 L60,15 L65,22 L70,35 L75,30 L80,45 L85,40 L90,20 L95,25 L100,10 L100,100 L0,100 Z" fill="url(#gradient-fill)"></path>
<defs>
<linearGradient id="gradient-fill" x1="0%" x2="0%" y1="0%" y2="100%">
<stop offset="0%" style="stop-color:#181f21; stop-opacity:1"></stop>
<stop offset="100%" style="stop-color:#181f21; stop-opacity:0"></stop>
</linearGradient>
</defs>
</svg>
<!-- Axes Labels -->
<div class="absolute -bottom-6 left-0 right-0 flex justify-between font-label-mono text-[9px] text-secondary uppercase tracking-widest">
<span class="">Sept 24</span>
<span class="">Oct 04</span>
<span class="">Oct 14</span>
<span class="">Oct 24</span>
</div>
</div>
</div>
</div>
<!-- Right Column: Breakdown & Actions -->
<div class="col-span-12 lg:col-span-5 flex flex-col gap-gutter">
<!-- Status Block -->
<div class="bg-surface-container-low border border-surface-container-high p-6 relative overflow-hidden rounded-xl">
<div class="flex items-center gap-4">
<div class="bg-ledger-paper p-3 rounded-xl border border-surface-container-high shadow-sm">
<span class="material-symbols-outlined text-ink-black text-2xl">verified_user</span>
</div>
<div>
<h5 class="font-headline-sm text-headline-sm text-primary italic">System Integrity</h5>
<p class="font-body-md text-body-md text-secondary">
                            Foundry status: <span class="text-primary font-bold">92% efficiency</span> • OPERATIONAL
                        </p>
</div>
</div>
</div>
<!-- Secondary Metrics Bento Grid -->
<div class="grid grid-cols-2 gap-4 rounded-xl">
<!-- Lock -->
<div class="bg-ledger-paper border border-surface-container-high p-6 flex flex-col justify-between hover:bg-surface-container-lowest transition-all vintage-shadow rounded-xl">
<div class="flex justify-between items-start mb-4">
<span class="font-label-mono text-label-mono text-ink-grey uppercase tracking-widest font-bold">Lock</span>
<span class="material-symbols-outlined text-ink-grey/60 text-lg">lock</span>
</div>
<span class="font-data-lg text-data-lg text-ink-black tabular-nums font-bold">$100.00</span>
</div>
<!-- Buffer -->
<div class="bg-ledger-paper border border-surface-container-high p-6 flex flex-col justify-between hover:bg-surface-container-lowest transition-all vintage-shadow rounded-xl">
<div class="flex justify-between items-start mb-4">
<span class="font-label-mono text-label-mono text-ink-grey uppercase tracking-widest font-bold">Buffer</span>
<span class="material-symbols-outlined text-ink-grey/60 text-lg">layers</span>
</div>
<span class="font-data-lg text-data-lg text-ink-black tabular-nums font-bold">$100.00</span>
</div>
<!-- Market -->
<div class="bg-ledger-paper border border-surface-container-high p-6 flex flex-col justify-between hover:bg-surface-container-lowest transition-all vintage-shadow rounded-xl">
<div class="flex justify-between items-start mb-4">
<span class="font-label-mono text-label-mono text-ink-grey uppercase tracking-widest font-bold">Market</span>
<span class="material-symbols-outlined text-ink-grey/60 text-lg">trending_up</span>
</div>
<span class="font-data-lg text-data-lg text-ink-black tabular-nums font-bold">$50.00</span>
</div>
<!-- Available -->
<div class="bg-surface border border-primary p-6 flex flex-col justify-between vintage-shadow rounded-xl">
<div class="flex justify-between items-start mb-4">
<span class="font-label-mono text-label-mono text-primary font-extrabold tracking-widest">AVAIL</span>
<span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1;">bolt</span>
</div>
<span class="font-data-lg text-data-lg text-primary font-bold tabular-nums">$800.00</span>
</div>
</div>
<!-- Action Section -->
<div class="mt-4 flex flex-col gap-4 rounded-xl">
<button class="w-full bg-ink-black text-white py-5 px-8 rounded-lg flex items-center justify-center gap-3 font-headline-sm text-lg font-bold hover:bg-primary transition-all active:scale-[0.98] shadow-lg group"><span class="material-symbols-outlined">bolt</span> ENGAGE ALLOCATION </button>
<div class="grid grid-cols-2 gap-4">
<button class="flex-1 bg-ledger-paper border border-surface-container-high py-4 font-label-caps text-label-caps tracking-widest text-ink-black hover:bg-surface-container transition-colors active:scale-95 flex items-center justify-center gap-2 font-extrabold uppercase rounded-lg">
<span class="material-symbols-outlined text-lg">history_edu</span>
                        LOG
                    </button>
<button class="flex-1 bg-ledger-paper border border-surface-container-high py-4 font-label-caps text-label-caps tracking-widest text-ink-black hover:bg-surface-container transition-colors active:scale-95 flex items-center justify-center gap-2 font-extrabold uppercase rounded-lg">
<span class="material-symbols-outlined text-lg">logout</span>
                        EXTRACT
                    </button>
</div>
</div>
<!-- Footer Note -->
<div class="mt-auto pt-12 rounded-xl">
<div class="border-t border-surface-container-high pt-4">
<p class="font-label-mono text-[9px] text-secondary leading-relaxed uppercase tracking-widest">
                        Warning: Mechanical extraction of capital requires level 4 officer clearance. All ledger adjustments are finalized upon physical stamping. This foundry is governed by the Precision Act of 1888.
                    </p>
</div>
</div>
</div>
</div>
</main>
<script>
    // Micro-interaction for hover effects on metrics
    document.querySelectorAll('.rounded-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            if (!card.classList.contains('bg-surface-container-low')) {
                card.style.transform = 'translateY(-4px)';
            }
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });
</script>


</body></html>
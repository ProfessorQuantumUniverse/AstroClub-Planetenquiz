// Baut aus den Quelldateien eine einzige, komplett eigenstaendige HTML-Datei,
// die ohne Internet und ohne Webserver per Doppelklick laeuft (file://).
//
//   node build-offline.mjs              -> Planetenquiz-offline.html (mit Schriften)
//   node build-offline.mjs --no-fonts   -> ohne Google Fonts, nur Systemschriften
//
// Alles wird eingebettet: CSS, JS, Bilder als data:-URIs, die Quizdaten als
// JSON-Block. Das ist noetig, weil fetch() und relative Pfade unter file://
// von der Same-Origin-Policy blockiert werden.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = import.meta.dirname;
const OUT = join(ROOT, 'Planetenquiz-offline.html');
const FONT_CACHE = join(ROOT, '.fontcache');
const WITH_FONTS = !process.argv.includes('--no-fonts');

const MIME = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
};

const read = (name) => readFile(join(ROOT, name), 'utf8');

async function dataUri(file) {
    const buf = await readFile(join(ROOT, file));
    const mime = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
    return `data:${mime};base64,${buf.toString('base64')}`;
}

// Ersetzt url('datei.jpg') / src="datei.jpg" durch eingebettete data:-URIs.
async function inlineAssets(text, pattern) {
    const files = new Set();
    for (const m of text.matchAll(pattern)) files.add(m[1]);

    for (const file of files) {
        if (/^(data:|https?:|\/\/)/.test(file)) continue;
        if (!existsSync(join(ROOT, file))) {
            console.warn(`  ! nicht gefunden, bleibt unveraendert: ${file}`);
            continue;
        }
        const uri = await dataUri(file);
        text = text.split(file).join(uri);
        console.log(`  + eingebettet: ${file}`);
    }
    return text;
}

// Fasst @font-face-Regeln zusammen, die auf dieselbe Datei zeigen. Die
// einzelnen font-weight-Werte werden zu einem Bereich (z.B. "400 700").
function mergeFontFaces(css) {
    const groups = new Map();
    let out = '';
    let lastEnd = 0;

    for (const m of css.matchAll(/@font-face\s*\{[^}]*\}/g)) {
        const rule = m[0];
        const url = rule.match(/url\((https:\/\/[^)]+)\)/)?.[1];
        const weight = rule.match(/font-weight:\s*([\d\s]+);/)?.[1].trim();
        if (!url || !weight) continue;

        out += css.slice(lastEnd, m.index);
        lastEnd = m.index + rule.length;

        const key = url + '|' + (rule.match(/font-style:\s*(\w+);/)?.[1] || 'normal');
        const seen = groups.get(key);
        const weights = weight.split(/\s+/).map(Number);

        if (seen) {
            // Regel entfaellt, ihr Gewicht wandert in die erste Regel der Gruppe.
            seen.weights.push(...weights);
        } else {
            const marker = `/*__FONTFACE_${groups.size}__*/`;
            groups.set(key, { rule, weights, marker });
            out += marker;
        }
    }
    out += css.slice(lastEnd);

    for (const { rule, weights, marker } of groups.values()) {
        const min = Math.min(...weights);
        const max = Math.max(...weights);
        const range = min === max ? `${min}` : `${min} ${max}`;
        out = out.replace(marker, rule.replace(/font-weight:\s*[\d\s]+;/, `font-weight: ${range};`));
    }
    return out;
}

// Hebt mehrfach genutzte data:-URIs in CSS-Variablen, damit dieselben Bytes
// nicht mehrfach in der Datei stehen.
function dedupeCssAssets(css) {
    const counts = new Map();
    for (const m of css.matchAll(/url\((['"]?)(data:[^'")]+)\1\)/g)) {
        counts.set(m[2], (counts.get(m[2]) || 0) + 1);
    }

    const vars = [];
    let i = 0;
    for (const [uri, count] of counts) {
        if (count < 2) continue;
        const name = `--embedded-asset-${i++}`;
        vars.push(`\t${name}: url(${uri});`);
        for (const q of ['"', "'", '']) {
            css = css.split(`url(${q}${uri}${q})`).join(`var(${name})`);
        }
        console.log(`  + ${count}x genutztes Asset zusammengefasst -> var(${name})`);
    }
    return vars.length ? `:root {\n${vars.join('\n')}\n}\n${css}` : css;
}

// Laedt die Google-Fonts-Definition und bettet die woff2-Dateien ein.
// Ergebnis wird in .fontcache/ abgelegt, damit spaetere Builds offline klappen.
async function inlineFonts(importUrl) {
    const cacheFile = join(FONT_CACHE, 'fonts.css');
    if (existsSync(cacheFile)) {
        console.log('  + Schriften aus .fontcache/');
        return readFile(cacheFile, 'utf8');
    }

    try {
        const res = await fetch(importUrl, {
            headers: {
                // Ohne moderne UA liefert Google veraltete truetype-Formate aus.
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let css = await res.text();

        // Nur die lateinischen Subsets einbetten - der Rest waere Ballast.
        const blocks = css.split(/(?=\/\* )/).filter(
            (b) => !b.startsWith('/* ') || /^\/\* latin(-ext)? \*\//.test(b)
        );
        css = blocks.join('');

        // Inter und Space Grotesk sind Variable Fonts: alle Schnitte einer Familie
        // zeigen auf dieselbe Datei. Ohne Zusammenfassen landet sie zwoelfmal in
        // der Ausgabe - darum je Datei nur ein @font-face mit Gewichtsbereich.
        css = mergeFontFaces(css);

        const urls = [...new Set([...css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)].map((m) => m[1]))];
        let bytes = 0;
        for (const url of urls) {
            const font = await fetch(url);
            if (!font.ok) throw new Error(`HTTP ${font.status} fuer ${url}`);
            const buf = Buffer.from(await font.arrayBuffer());
            bytes += buf.length;
            css = css.split(url).join(`data:font/woff2;base64,${buf.toString('base64')}`);
        }

        await mkdir(FONT_CACHE, { recursive: true });
        await writeFile(cacheFile, css, 'utf8');
        console.log(`  + ${urls.length} Schriftschnitte eingebettet (${(bytes / 1024).toFixed(0)} KB)`);
        return css;
    } catch (err) {
        console.warn(`  ! Schriften nicht ladbar (${err.message}) - nutze Systemschriften`);
        return '';
    }
}

async function build() {
    console.log('Baue Planetenquiz-offline.html ...');

    let html = await read('index.html');
    let css = await read('Planetenquiz.css');
    const js = await read('Planetenquiz.js');
    const quizData = await read('quizData.json');

    // 1. Google-Fonts-@import durch eingebettete Schriften ersetzen
    const importMatch = css.match(/@import\s+url\(['"]?(https:\/\/fonts\.googleapis\.com[^'")]+)['"]?\);?/);
    let fontCss = '';
    if (importMatch) {
        if (WITH_FONTS) fontCss = await inlineFonts(importMatch[1]);
        else console.log('  - Schriften uebersprungen (--no-fonts)');
        css = css.replace(importMatch[0], '');
    }

    // 2. Bilder aus CSS und HTML einbetten
    css = dedupeCssAssets(await inlineAssets(css, /url\(['"]?([^'")]+)['"]?\)/g));
    html = await inlineAssets(html, /(?:src|href)=["']([^"']+\.(?:jpg|jpeg|png|gif|svg|webp|ico))["']/gi);

    // 3. Stylesheet-Link durch <style> ersetzen
    html = html.replace(
        /\s*<link\s+rel=["']stylesheet["']\s+href=["']Planetenquiz\.css["']\s*\/?>/,
        `\n\t<style>\n${fontCss}\n${css}\n\t</style>`
    );

    // 4. Script-Tag durch Quizdaten + Inline-JS ersetzen.
    //    "</" wird escaped, damit der JSON-Block das <script> nicht vorzeitig schliesst.
    const safeJson = JSON.stringify(JSON.parse(quizData)).split('</').join('<\\/');
    html = html.replace(
        /\s*<script\s+src=["']Planetenquiz\.js["']\s+defer\s*>\s*<\/script>/,
        `\n\t<script type="application/json" id="quizDataEmbedded">${safeJson}</script>\n\t<script>\n${js}\n\t</script>`
    );

    // 5. Elemente entfernen, die nur auf der Online-Seite Sinn ergeben
    //    (z.B. der Download-Link, der in der Offline-Datei auf sich selbst zeigt)
    //    Ein direkt davorstehender Kommentar gehoert zum Block und faellt mit weg.
    //    (?!-->) verhindert, dass der Kommentarteil ueber sein Ende hinauslaeuft und
    //    dabei alles bis zum naechsten Kommentar verschluckt.
    const stripped = html.replace(
        /\s*(?:<!--(?:(?!-->)[\s\S])*-->\s*)?<(\w+)[^<>]*\sdata-online-only[^<>]*>[\s\S]*?<\/\1>/g,
        ''
    );
    if (stripped !== html) console.log('  - data-online-only-Block entfernt');
    html = stripped;

    // 6. Sicherstellen, dass nichts uebrig blieb
    const leftovers = [...html.matchAll(/(?:src|href)=["'](?!data:|#)([^"':]+)["']/g)].map((m) => m[1]);
    if (leftovers.length) {
        console.warn(`  ! noch externe Verweise im Ergebnis: ${leftovers.join(', ')}`);
    }

    // Jedes id aus der Quelle muss auch im Ergebnis stehen - bis auf die
    // absichtlich entfernten Online-Bloecke. Faengt zu gierige Ersetzungen ab.
    const idsOf = (s) => new Set([...s.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]));
    const source = await read('index.html');
    const onlineOnly = idsOf(source.match(/<(\w+)[^<>]*\sdata-online-only[\s\S]*?<\/\1>/)?.[0] || '');
    const missing = [...idsOf(source)].filter((id) => !idsOf(html).has(id) && !onlineOnly.has(id));
    if (missing.length) {
        throw new Error(
            `Im Ergebnis fehlen Elemente aus index.html: ${missing.join(', ')}. ` +
                'Vermutlich hat eine Ersetzung zu viel entfernt.'
        );
    }

    // 7. Herkunftshinweis
    html = html.replace(
        '<head>',
        '<head>\n\t<!-- Automatisch erzeugt von build-offline.mjs - nicht direkt bearbeiten. -->'
    );

    await writeFile(OUT, html, 'utf8');
    const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
    console.log(`\nFertig: Planetenquiz-offline.html (${kb} KB)`);
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});

// crawl.js
import { chromium } from 'playwright';
import fs from 'fs';


function normalizeUrl(u) {
    // Entfernt Hash-Fragmente, normalisiert simple Varianten
    try {
        const url = new URL(u);
        url.hash = '';
        // optional: trailing slash vereinheitlichen
        return url.toString();
    } catch {
        return null;
    }
}

function isAllowed(url, originHost, prefixPath) {
    try {
        const u = new URL(url);
        // gleiche Domain (Host exakt). Wenn Subdomains erlaubt sein sollen: anpassen.
        if (u.host !== originHost) return false;
        // nur unter /doc (oder deinem Prefix)
        if (!u.pathname.startsWith(prefixPath)) return false;
        return true;
    } catch {
        return false;
    }
}

(async () => {
    const startUrl = process.argv[2];
    const prefix = process.argv[3] || '/docs';
    const outFile = process.argv[4] || 'links.txt';

    if (!startUrl) {
        console.error('Usage: node crawl.js <start_url> [prefix=/doc] [out=links.txt]');
        process.exit(1);
    }

    const start = new URL(startUrl);
    const originHost = start.host;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (compatible; link-audit/1.0)'
    });

    // Optional: Requests drosseln/Assets blocken (schneller + weniger Last)
    await context.route('**/*', (route) => {
        const req = route.request();
        const type = req.resourceType();
        // Blocke unnötige Assets, wenn du nur Links willst:
        if (['image', 'media', 'font'].includes(type)) return route.abort();
        return route.continue();
    });

    const page = await context.newPage();

    const queue = [];
    const seen = new Set();      // alle erlaubten URLs, die wir besuchen wollen
    const discovered = new Set();// alle erlaubten URLs, die wir gefunden haben (inkl. besuchte)
    const startNorm = normalizeUrl(startUrl);

    if (startNorm && isAllowed(startNorm, originHost, prefix)) {
        queue.push(startNorm);
        seen.add(startNorm);
        discovered.add(startNorm);
    } else {
        // Start-URL liegt evtl. nicht direkt unter prefix; trotzdem starten, aber nur prefix-links sammeln
        queue.push(startUrl);
    }

    while (queue.length) {

        const current = queue.shift();

        try {
            // Warten bis Netzwerk ruhig ist; für manche SPAs besser: 'domcontentloaded' + extra wait

            console.log(`Opening site: ${current}`);


            await page.goto(current, { waitUntil: 'domcontentloaded', timeout: 45000 });

            // Kleine Zusatzwartezeit für späte XHR-Renderings

            // feste 2 Sekunden warten
            await page.waitForTimeout(3000);


            // Nur Links innerhalb des ersten passenden DIVs sammeln:
            const hrefs = await page.$$eval('div[role="navigation"] a[href]', anchors =>
                [...new Set(anchors.map(a => a.href.split('#')[0]))]
            );

            console.log("Found links in navigation sidebar: " + hrefs.length);
            console.log(hrefs);


            for (const href of hrefs) {

                //console.log(href);

                const norm = normalizeUrl(href);
                if (!norm) continue;
                if (!isAllowed(norm, originHost, prefix)) continue;

                discovered.add(norm);
                if (!seen.has(norm)) {
                    seen.add(norm);
                    //queue.push(norm);
                }
            }

        } catch (e) {
            // Fehler beim Laden ignorieren, Crawl soll weiterlaufen
            console.error(`Failed: ${current}`, e.message);
        }
    }

    await browser.close();

    // In Datei schreiben
    const sorted = Array.from(discovered).sort();
    fs.writeFileSync(outFile, sorted.join('\n') + '\n', 'utf8');

    console.log(`Discovered ${sorted.length} links -> ${outFile}`);
})();

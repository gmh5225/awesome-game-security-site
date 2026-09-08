import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import { getResource, getResourceByUrl } from '../src/lib/catalog';
import { getDictionary } from '../src/lib/i18n';
import { LOCALES, type Locale } from '../src/lib/types';

const HOST = 'localhost';
const PORT = 3319;
const ORIGIN = `http://${HOST}:${PORT}`;
const pause = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function availablePort(): Promise<void> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(PORT, HOST, () => probe.close(error => error ? reject(error) : resolve()));
  });
}

function terminate(child: ChildProcess | undefined, signal: NodeJS.Signals) {
  if (!child?.pid) return;
  try {
    if (process.platform === 'win32') {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    }
    else process.kill(-child.pid, signal);
  } catch { /* The server may already have exited. */ }
}

async function boundedBody(response: Response, maximum = 16 * 1024 * 1024): Promise<Uint8Array> {
  assert(Number(response.headers.get('content-length')) <= maximum, 'Local response exceeds smoke-test size limit.');
  const reader = response.body?.getReader();
  assert(reader, 'Local response has no body.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maximum) { await reader.cancel(); throw new Error('Local response exceeds smoke-test size limit.'); }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;
type HtmlDocument = DefaultTreeAdapterTypes.Document;

function* elements(node: HtmlNode): Generator<HtmlElement> {
  if ('tagName' in node) yield node;
  if ('childNodes' in node) {
    for (const child of node.childNodes) yield* elements(child);
  }
}

function htmlAttribute(element: HtmlElement | undefined, name: string): string | undefined {
  return element?.attrs.find(attribute => attribute.name === name)?.value;
}

function assertLocale(document: HtmlDocument, locale: Locale, route: string) {
  const html = [...elements(document)].find(element => element.tagName === 'html');
  assert(htmlAttribute(html, 'lang') === locale, `${route}: expected html lang=${locale}.`);
}

function textContent(node: HtmlNode): string {
  if (node.nodeName === '#text' && 'value' in node) return node.value;
  if ('tagName' in node && ['script', 'style', 'template'].includes(node.tagName)) return '';
  return 'childNodes' in node ? node.childNodes.map(textContent).join('') : '';
}

function headingText(document: HtmlDocument): string {
  // Script text and template contents cannot masquerade as rendered h1 elements.
  const heading = [...elements(document)].find(element => element.tagName === 'h1');
  return heading ? textContent(heading).replace(/\s+/g, ' ').trim() : '';
}

async function main() {
  const controller = new AbortController();
  let child: ChildProcess | undefined;
  let logs = '';
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let rejectRun: (error: Error) => void = () => {};
  const deadline = new Promise<never>((_resolve, reject) => {
    rejectRun = reject;
    deadlineTimer = setTimeout(() => { controller.abort(); reject(new Error('Production smoke test exceeded 55 seconds.')); }, 55_000);
  });
  const interrupt = () => { controller.abort(); rejectRun(new Error('Production smoke test was interrupted.')); };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  // Reserve five seconds for finally cleanup, even if an I/O operation stalls.
  const watchdog = setTimeout(() => {
    terminate(child, 'SIGKILL');
    console.error('Production smoke test exceeded its 60-second hard limit.');
    process.exit(1);
  }, 60_000);
  let closed: Promise<void> | undefined;
  const request = (route: string) => {
    assert(route.startsWith('/') && !route.startsWith('//'), 'Smoke requests must remain local.');
    return fetch(`${ORIGIN}${route}`, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'text/html,application/rss+xml,image/png', 'User-Agent': 'AGS-Local-Production-Smoke/1.0' } });
  };
  const document = async (route: string, status: number) => {
    const response = await request(route);
    assert(response.status === status, `${route}: expected HTTP ${status}, received ${response.status}.`);
    assert(response.headers.get('content-type')?.includes('text/html'), `${route}: expected an HTML response.`);
    return parse(new TextDecoder().decode(await boundedBody(response)));
  };

  try {
    await Promise.race([(async () => {
      await access(path.resolve('.next/BUILD_ID'));
      await availablePort();
      // Bun runs this script; Node explicitly runs the already-built Next.js server.
      child = spawn('node', [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', HOST, '--port', String(PORT)], {
        cwd: process.cwd(), detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
      });
      closed = new Promise<void>(resolve => child!.once('close', () => resolve()));
      child.stdout?.on('data', chunk => { logs = (logs + String(chunk)).slice(-2000); });
      child.stderr?.on('data', chunk => { logs = (logs + String(chunk)).slice(-2000); });
      let serverError: Error | undefined;
      child.once('error', error => { serverError = error; });
      let ready = false;
      for (let attempts = 0; attempts < 100 && !controller.signal.aborted; attempts++) {
        if (serverError) throw serverError;
        assert(child.exitCode === null && child.signalCode === null, 'The production server exited before readiness.');
        try {
          const response = await request('/en');
          ready = response.status === 200;
          await response.body?.cancel();
          if (ready) break;
        } catch { /* Startup has not yet opened the local listener. */ }
        await pause(150);
      }
      assert(ready, 'The production server did not become ready.');
      const missingId = '0000000000000000';
      assert(!getResource(missingId), 'The smoke-test missing resource ID unexpectedly exists.');
      for (const locale of LOCALES) {
        const homepage = `/${locale}`;
        assertLocale(await document(homepage, 200), locale, homepage);
        for (const missing of [`/${locale}/resources/${missingId}`, `/${locale}/smoke-missing-page`]) {
          const markup = await document(missing, 404);
          assertLocale(markup, locale, missing);
          assert(headingText(markup) === getDictionary(locale).notFoundTitle, `${missing}: missing or incorrectly localized SSR h1.`);
          const noindex = [...elements(markup)].some(element => element.tagName === 'meta' && htmlAttribute(element, 'name')?.toLowerCase() === 'robots'
            && (htmlAttribute(element, 'content') || '').toLowerCase().split(/[\s,]+/).includes('noindex'));
          assert(noindex, `${missing}: missing robots noindex metadata.`);
        }
      }
      const known = getResourceByUrl('https://github.com/godotengine/godot');
      assert(known, 'The known Godot resource is missing from the snapshot.');
      const detail = `/en/resources/${known.id}`;
      const detailMarkup = await document(detail, 200);
      assertLocale(detailMarkup, 'en', detail);
      assert(headingText(detailMarkup) === known.title, `${detail}: expected the known resource SSR h1.`);
      const rss = await request('/en/feed.xml');
      assert(rss.status === 200 && /(?:rss|xml)/i.test(rss.headers.get('content-type') || ''), '/en/feed.xml: expected HTTP 200 XML.');
      assert(/<rss\b[^>]*version="2\.0"/i.test(new TextDecoder().decode(await boundedBody(rss))), '/en/feed.xml: invalid RSS root.');
      const og = await request('/opengraph-image');
      assert(og.status === 200 && og.headers.get('content-type')?.includes('image/png'), '/opengraph-image: expected HTTP 200 PNG.');
      const png = await boundedBody(og, 4 * 1024 * 1024);
      assert(png.length > 100 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => png[index] === byte), '/opengraph-image: invalid PNG signature.');
      console.log('Production smoke passed: 10 localized homepages, 20 localized HTTP 404 pages with SSR h1/noindex, known resource, RSS, and OG image.');
    })(), deadline]);
  } catch (error) {
    if (logs) console.error(`Next.js startup/output tail: ${logs.slice(-1200).replace(/\s+/g, ' ').trim()}`);
    throw error;
  } finally {
    controller.abort();
    if (deadlineTimer) clearTimeout(deadlineTimer);
    terminate(child, 'SIGTERM');
    if (closed) await Promise.race([closed, pause(2000)]);
    terminate(child, 'SIGKILL');
    if (closed) await Promise.race([closed, pause(1000)]);
    clearTimeout(watchdog);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}

main().catch(error => { console.error(`Production smoke failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });

import { Router } from "express";

const router = Router();

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"];

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function rewriteUrl(url: string, proxyBase: string, pageUrl: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("#") ||
    trimmed === ""
  ) return url;
  try {
    const abs = resolveUrl(pageUrl, trimmed);
    return proxyBase + encodeURIComponent(abs);
  } catch {
    return url;
  }
}

function rewriteHtml(html: string, proxyBase: string, pageUrl: string): string {
  const rw = (url: string) => rewriteUrl(url, proxyBase, pageUrl);

  /* Remove/replace existing base tags */
  html = html.replace(/<base[^>]*>/gi, "");

  /* href attributes (links, link[rel=stylesheet], etc.) */
  html = html.replace(/(\s(?:href|src|action|data-src)=)(["'])([^"']*)\2/gi, (_, attr, q, url) => {
    return `${attr}${q}${rw(url)}${q}`;
  });

  /* srcset */
  html = html.replace(/(\ssrcset=)(["'])([^"']*)\2/gi, (_, attr, q, srcset) => {
    const rewritten = srcset.replace(/([^\s,][^\s,]*)(\s+[\d.]+[wx])?/g, (_m: string, url: string, desc: string) => {
      return rw(url) + (desc || "");
    });
    return `${attr}${q}${rewritten}${q}`;
  });

  /* Inline style background-image / url() */
  html = html.replace(/(url\()(["']?)([^"')]+)\2(\))/gi, (_, open, q, url, close) => {
    return `${open}${q}${rw(url)}${q}${close}`;
  });

  /* @import in <style> blocks */
  html = html.replace(/@import\s+(["'])([^"']+)\1/gi, (_, q, url) => {
    return `@import ${q}${rw(url)}${q}`;
  });

  /* meta refresh */
  html = html.replace(/(content=["']?\d+;\s*url=)([^"'\s>]+)/gi, (_, prefix, url) => {
    return `${prefix}${rw(url)}`;
  });

  /* Inject intercept script right after <head> opening */
  const interceptScript = `
<script>
(function(){
  var _proxy = ${JSON.stringify(proxyBase)};
  var _page = ${JSON.stringify(pageUrl)};
  function _rw(url){
    if(!url||/^(javascript:|mailto:|tel:|data:|#)/.test(url))return url;
    try{return _proxy+encodeURIComponent(new URL(url,_page).href);}catch(e){return url;}
  }
  /* Override fetch */
  var _origFetch=window.fetch;
  window.fetch=function(input,init){
    if(typeof input==='string')input=_rw(input);
    return _origFetch.call(this,input,init);
  };
  /* Override XHR */
  var _origOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,url){
    if(typeof url==='string')url=_rw(url);
    return _origOpen.apply(this,[m,url].concat(Array.prototype.slice.call(arguments,2)));
  };
  /* Override window.location assignment */
  try{
    Object.defineProperty(window,'location',{
      get:function(){return window._realLocation||(window._realLocation=window.document.location);},
      set:function(v){window.location.href=_rw(String(v));},
      configurable:true
    });
  }catch(e){}
  /* Intercept clicks */
  document.addEventListener('click',function(e){
    var el=e.target;
    while(el&&el.tagName!=='A')el=el.parentElement;
    if(el&&el.href&&!/^(javascript:|mailto:|tel:)/.test(el.href)){
      e.preventDefault();
      window.location.href=_rw(el.href);
    }
  },true);
  /* Intercept form submit */
  document.addEventListener('submit',function(e){
    var form=e.target;
    if(form.action){form.action=_rw(form.action);}
  },true);
})();
</script>`;

  html = html.replace(/(<head[^>]*>)/i, `$1${interceptScript}`);
  if (!html.includes(interceptScript)) {
    html = interceptScript + html;
  }

  return html;
}

function rewriteCss(css: string, proxyBase: string, pageUrl: string): string {
  const rw = (url: string) => rewriteUrl(url, proxyBase, pageUrl);
  css = css.replace(/(url\()(["']?)([^"')]+)\2(\))/gi, (_, open, q, url, close) => {
    return `${open}${q}${rw(url)}${q}${close}`;
  });
  css = css.replace(/@import\s+(["'])([^"']+)\1/gi, (_, q, url) => {
    return `@import ${q}${rw(url)}${q}`;
  });
  return css;
}

router.get("/browser-proxy", async (req, res) => {
  const raw = req.query.url as string;
  if (!raw) { res.status(400).send("Missing url"); return; }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(raw);
    const parsed = new URL(targetUrl);
    if (BLOCKED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
      res.status(403).send("Blocked"); return;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) { res.status(400).send("Bad protocol"); return; }
  } catch {
    res.status(400).send("Invalid URL"); return;
  }

  const proxyBase = `/api/browser-proxy?url=`;

  try {
    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/avif,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    /* Strip framing-prevention headers */
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("Content-Security-Policy-Report-Only");

    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    const isHtml = ct.includes("text/html");
    const isCss = ct.includes("text/css");
    const isText = ct.includes("text/");

    /* Actual URL after redirects */
    const finalUrl = upstream.url || targetUrl;

    if (isHtml) {
      let html = await upstream.text();
      html = rewriteHtml(html, proxyBase, finalUrl);
      res.status(upstream.status)
        .set("Content-Type", "text/html; charset=utf-8")
        .set("X-Proxy-Final-Url", finalUrl)
        .send(html);
    } else if (isCss) {
      let css = await upstream.text();
      css = rewriteCss(css, proxyBase, finalUrl);
      res.status(upstream.status)
        .set("Content-Type", ct)
        .set("X-Proxy-Final-Url", finalUrl)
        .send(css);
    } else if (isText) {
      const text = await upstream.text();
      res.status(upstream.status)
        .set("Content-Type", ct)
        .set("X-Proxy-Final-Url", finalUrl)
        .send(text);
    } else {
      /* Binary: images, fonts, JS, etc. */
      const buf = await upstream.arrayBuffer();
      res.status(upstream.status)
        .set("Content-Type", ct)
        .set("X-Proxy-Final-Url", finalUrl)
        .send(Buffer.from(buf));
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    res.status(502).json({ error: "Proxy fetch failed", detail: msg });
  }
});

export default router;

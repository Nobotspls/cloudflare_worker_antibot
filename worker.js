export default {
  async fetch(request, env, ctx) {
    // --- Config from env (wrangler.toml or dashboard) ---
    const API_BASE = env.API_BASE || "https://nobotspls.com";
    const API_KEY  = env.AFK_API_KEY || "";
    const MODE     = (env.AFK_MODE || "monitor").toLowerCase(); // "monitor" | "enforce"

    // Paths to protect (edit as needed)
    const PROTECT = [
      /^\/api\/.*/i,
      /^\/wp-json\/.*/i,
      /^\/checkout/i, /^\/cart/i, /^\/order/i,
      /^\/login/i, /^\/signup/i,
    ];

    // Skip static stuff
    const isStatic = (p) => /\.(?:css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|map|txt)$/i.test(p);

    const url = new URL(request.url);
    const path = url.pathname;

    const shouldCheck = PROTECT.some((re) => re.test(path)) && !isStatic(path);
    if (!shouldCheck) {
      // Transparent pass-through
      return fetch(request);
    }

    try {
      const h = request.headers;
      const ip = (h.get("x-forwarded-for") || h.get("cf-connecting-ip") || "").split(",")[0].trim();

      // header order approximation from request
      const headerorder = [...h.keys()].map(k => k.toLowerCase()).join(", ");

      const params = new URLSearchParams({
        useragent:      h.get("user-agent")      || "",
        sec_ch_ua:      h.get("sec-ch-ua")       || "",
        acceptlanguage: h.get("accept-language") || "",
        acceptencoding: h.get("accept-encoding") || "",
        accept:         h.get("accept")          || "",
        headerorder,
        ip
      });

      const probe = await fetch(`${API_BASE}/probe?` + params.toString(), {
        method: "GET",
        headers: API_KEY ? { "X-API-Key": API_KEY } : {}
      });

      let decision = "allow";
      if (probe.ok) {
        try {
          const j = await probe.json();
        /*  Expected shape: { decision: "allow" | "review" | "block", ... } */
          decision = (j && j.decision) ? String(j.decision) : "allow";
        } catch { /* fail-open */ }
      }

      if (MODE === "enforce" && decision === "block") {
        return new Response("Blocked by NoBotsPls", { status: 403, headers: { "X-Bot-Decision": "block" } });
      }

      // Pass through to origin, add decision header
      const upstream = await fetch(request);
      const res = new Response(upstream.body, upstream);
      res.headers.set("X-Bot-Decision", decision);
      return res;

    } catch (e) {
      // Fail-open: let traffic through if the check errors
      const upstream = await fetch(request);
      const res = new Response(upstream.body, upstream);
      res.headers.set("X-Bot-Decision", "allow");
      res.headers.set("X-Bot-Error", "probe-failed");
      return res;
    }
  }
}


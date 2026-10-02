(() => {
  const script = document.currentScript;
  const trigger = document.getElementById("nv-seo-trigger");
  if (!script || !trigger || document.getElementById("nv-seo-modal")) return;

  const appOrigin = new URL(script.src).origin;
  let modal;
  let previousFocus;
  let scrollY = 0;
  let bodyStyle;
  let background;

  function close() {
    if (!modal) return;
    modal.remove();
    modal = null;
    document.body.style.position = bodyStyle.position;
    document.body.style.top = bodyStyle.top;
    document.body.style.width = bodyStyle.width;
    background.forEach(({ element, inert }) => { element.inert = inert; });
    window.scrollTo(0, scrollY);
    previousFocus?.focus();
    document.removeEventListener("keydown", onKeydown);
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function open() {
    if (modal) return;
    previousFocus = document.activeElement;
    scrollY = window.scrollY;
    bodyStyle = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    background = Array.from(document.body.children).map((element) => ({ element, inert: element.inert }));
    modal = document.createElement("div");
    modal.id = "nv-seo-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Kostenloser SEO-Check");
    modal.innerHTML = '<div class="nv-seo-backdrop"></div><div class="nv-seo-frame-wrap"><button type="button" class="nv-seo-close" aria-label="SEO-Check schließen">×</button><iframe title="Nurovelle SEO-Toolbox" loading="eager"></iframe></div>';
    modal.querySelector(".nv-seo-backdrop").addEventListener("click", close);
    modal.querySelector(".nv-seo-close").addEventListener("click", close);
    document.body.append(modal);
    background.forEach(({ element }) => { element.inert = true; });
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.addEventListener("keydown", onKeydown);
    modal.querySelector(".nv-seo-close").focus();
    const owner = new URLSearchParams(location.search).get("owner") === "1";
    modal.querySelector("iframe").src = `${appOrigin}/toolbox/embed${owner ? "?owner=1" : ""}`;
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== appOrigin || event.source !== modal?.querySelector("iframe").contentWindow || event.data !== "nv-seo-close") return;
    close();
  });
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    open();
  });
  if (new URLSearchParams(location.search).get("owner") === "1") open();
})();

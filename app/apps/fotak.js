"use strict";

/* Fotoaparat: nahled pres celou obrazovku, spoust, prepnuti predni/zadni kamery,
 * blesk (svitilna kamery, kde ji telefon umi), samospoust 3/10 s, posledni fotka */
function appFotak(c) {
  if (svitilna) prepniSvitilnu(); /* kamera a svitilna se o zarizeni nedeli */
  let smer = store.get("fotakSmer", "environment");   /* zadni / "user" = predni */
  let casovac = store.get("fotakCasovac", 0);
  let blesk = false, proud = null, odpocet = null;

  c.innerHTML = `
    <div class="cam">
      <video id="cam-video" autoplay playsinline muted></video>
      <div class="cam-zablesk" id="cam-zablesk"></div>
      <div class="cam-odpocet" id="cam-odpocet"></div>
      <div class="cam-chyba" id="cam-chyba" hidden>${Ikony.ikona("fotak")}<p>${esc(t("cam_ne"))}</p></div>
      <div class="cam-horni">
        <button class="cam-tl" id="cam-blesk" aria-label="${esc(t("cam_blesk"))}" hidden></button>
        <button class="cam-tl cam-casovac" id="cam-casovac" aria-label="${esc(t("cam_casovac"))}"></button>
      </div>
      <div class="cam-dolni">
        <button class="cam-posledni" id="cam-posledni" aria-label="${esc(t("cam_posledni"))}"></button>
        <button class="cam-spoust" id="cam-spoust" aria-label="${esc(t("cam_vyfot"))}"><span></span></button>
        <button class="cam-tl" id="cam-prepnout" aria-label="${esc(t("cam_prepnout"))}">${Ikony.ikona("prepnout")}</button>
      </div>
      <canvas id="cam-cv" hidden></canvas>
    </div>`;
  const video = $("#cam-video");

  const kresliCasovac = () => {
    $("#cam-casovac").innerHTML = Ikony.ikona("casovac") + (casovac ? `<b>${casovac}s</b>` : "");
    $("#cam-casovac").classList.toggle("on", !!casovac);
  };
  const kresliBlesk = () => {
    $("#cam-blesk").innerHTML = Ikony.ikona(blesk ? "blesk" : "bleskVyp");
    $("#cam-blesk").classList.toggle("on", blesk);
  };
  const kresliPosledni = () => Fotky.vse().then((f) => {
    const el = $("#cam-posledni");
    if (el) el.innerHTML = f.length ? `<img src="${esc(f[0].data)}" alt="">` : "";
  });

  function zastav() { if (proud) proud.getTracks().forEach((x) => x.stop()); proud = null; }
  function spust() {
    zastav();
    $("#cam-chyba").hidden = true;
    video.classList.toggle("zrcadlo", smer === "user");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $("#cam-chyba").hidden = false; return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: smer, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((s) => {
        if (!document.contains(video)) return s.getTracks().forEach((x) => x.stop());
        proud = s;
        video.srcObject = s;
        const p = video.play(); /* iOS nekdy autoplay ignoruje */
        if (p && p.catch) p.catch(() => {});
        /* blesk jen kdyz kamera umi svitilnu (vetsinou zadni na Androidu) */
        const tr = s.getVideoTracks()[0];
        const umi = tr && tr.getCapabilities ? tr.getCapabilities() : {};
        $("#cam-blesk").hidden = !umi.torch;
        blesk = false;
        kresliBlesk();
      })
      .catch(() => { $("#cam-chyba").hidden = false; });
  }
  /* po odchodu z aplikace kameru vypnout */
  const hlidac = setInterval(() => { if (!document.contains(video)) { zastav(); clearInterval(hlidac); } }, 500);

  function vyfot() {
    if (!video.videoWidth) return;
    const k = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
    const cv = $("#cam-cv");
    cv.width = Math.round(video.videoWidth * k);
    cv.height = Math.round(video.videoHeight * k);
    const g = cv.getContext("2d");
    /* predni kamera: fotka jako v zrcadle, stejne jako nahled */
    if (smer === "user") { g.translate(cv.width, 0); g.scale(-1, 1); }
    g.drawImage(video, 0, 0, cv.width, cv.height);
    const zablesk = $("#cam-zablesk");
    zablesk.classList.remove("on");
    void zablesk.offsetWidth;
    zablesk.classList.add("on");
    if (navigator.vibrate) navigator.vibrate(30);
    Fotky.pridej(cv.toDataURL("image/jpeg", .85)).then(kresliPosledni);
  }

  $("#cam-spoust").onclick = () => {
    if (odpocet) return;
    if (!casovac) return vyfot();
    let zbyva = casovac;
    const el = $("#cam-odpocet");
    el.textContent = zbyva;
    odpocet = setInterval(() => {
      zbyva--;
      if (!document.contains(el)) { clearInterval(odpocet); odpocet = null; return; }
      if (zbyva > 0) { el.textContent = zbyva; pipni(); return; }
      clearInterval(odpocet);
      odpocet = null;
      el.textContent = "";
      vyfot();
    }, 1000);
  };
  $("#cam-prepnout").onclick = () => {
    smer = smer === "user" ? "environment" : "user";
    store.set("fotakSmer", smer);
    spust();
  };
  $("#cam-casovac").onclick = () => {
    casovac = casovac === 0 ? 3 : casovac === 3 ? 10 : 0;
    store.set("fotakCasovac", casovac);
    kresliCasovac();
  };
  $("#cam-blesk").onclick = () => {
    const tr = proud && proud.getVideoTracks()[0];
    if (!tr) return;
    blesk = !blesk;
    tr.applyConstraints({ advanced: [{ torch: blesk }] }).catch(() => { blesk = false; }).then(kresliBlesk);
  };
  $("#cam-posledni").onclick = () => otevri("galerie");

  kresliCasovac();
  kresliBlesk();
  kresliPosledni();
  spust();
}

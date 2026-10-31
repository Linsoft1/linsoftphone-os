"use strict";

/* Fotoaparat (skutecna kamera pres getUserMedia) */
function appFotak(c) {
  if (svitilna) prepniSvitilnu(); /* kamera a svitilna se o zarizeni nedeli */
  c.innerHTML = `
    <video id="cam-video" autoplay playsinline muted></video>
    <button class="btn full" id="cam-snap">${esc(t("cam_vyfot"))}</button>
    <canvas id="cam-cv" hidden></canvas>
    <div id="cam-out"></div>`;
  const video = $("#cam-video");
  const chyba = () => c.insertAdjacentHTML("afterbegin", `<p class="muted">${esc(t("cam_ne"))}</p>`);
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) chyba();
  else navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then((s) => {
      video.srcObject = s;
      const p = video.play(); /* iOS nekdy autoplay ignoruje */
      if (p && p.catch) p.catch(() => {});
      const stop = setInterval(() => {
        if (!document.contains(video)) { s.getTracks().forEach((x) => x.stop()); clearInterval(stop); }
      }, 500);
    })
    .catch(chyba);
  $("#cam-snap").onclick = () => {
    if (!video.videoWidth) return;
    /* zmenseni na max 1280 px */
    const k = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const cv = $("#cam-cv");
    cv.width = Math.round(video.videoWidth * k);
    cv.height = Math.round(video.videoHeight * k);
    cv.getContext("2d").drawImage(video, 0, 0, cv.width, cv.height);
    const data = cv.toDataURL("image/jpeg", .8);
    Fotky.pridej(data).then(() => pridejNotif(t("app_fotak"), t("cam_ulozeno")));
    $("#cam-out").innerHTML = `<img id="cam-shot" src="${data}" alt="">`;
  };
}

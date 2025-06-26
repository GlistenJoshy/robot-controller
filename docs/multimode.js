let localStream = null;

// --- Page Navigation ---
function goToHome() {
  stopGestureMode();
  showPage("page1");
}

function goToModes() {
  stopGestureMode();
  showPage("page2");
}

function goToTouch() {
  showPage("touchMode");
}

function goToTilt() {
  showPage("tiltMode");
}

function goToGesture() {
  showPage("gestureMode");
  startGestureMode();
}

function showPage(id) {
  document.querySelectorAll("div[id]").forEach(el => {
    if (el.id.startsWith("page") || el.id.endsWith("Mode")) {
      el.classList.add("hidden");
    }
  });
  document.getElementById(id).classList.remove("hidden");
}

// --- Settings Save ---
function toggleSettings() {
  document.getElementById("settingsDropdown").classList.toggle("show");
}

function saveIps() {
  const esp32 = document.getElementById("esp32Ip").value.trim();
  const gesture = document.getElementById("gestureIp").value.trim();
  const ipError = document.getElementById("ipError");

  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const isValid = (ip) => ip.startsWith("localhost") || ipPattern.test(ip);

  if (esp32 && !isValid(esp32)) {
    ipError.textContent = "❌ Invalid ESP32 IP address";
    return;
  }

  if (gesture && !isValid(gesture)) {
    ipError.textContent = "❌ Invalid Gesture Server IP address";
    return;
  }

  if (esp32) localStorage.setItem("esp32ip", esp32);
  if (gesture) localStorage.setItem("gestureip", gesture);

  ipError.textContent = "✅ IPs saved!";
  toggleSettings();
}

// --- Touch Controls (unchanged) ---
let touchCooldown = false;

document.querySelectorAll('.arrow-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const esp32ip = localStorage.getItem("esp32ip");
    if (!esp32ip) return alert("Please set ESP32 IP!");

    if (touchCooldown) return;

    let cmd = "";
    if (btn.textContent.includes('⬆️')) cmd = "forward";
    else if (btn.textContent.includes('⬇️')) cmd = "backward";
    else if (btn.textContent.includes('⬅️')) cmd = "left";
    else if (btn.textContent.includes('➡️')) cmd = "right";

    fetch(`http://${esp32ip}/command?cmd=${cmd}`, {
      method: 'GET',
      mode: 'no-cors'
    });

    console.log(`🛰 Sent command: ${cmd}`);

    touchCooldown = true;
    setTimeout(() => {
      touchCooldown = false;
    }, 500);
  });
});

// --- Gesture Mode ---
let gestureCanvas = document.getElementById("gestureCanvas");
let gestureCtx = gestureCanvas.getContext("2d");
let gestureStatus = document.getElementById("gestureStatus");

function startGestureMode() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      localStream = stream;
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      video.onloadeddata = () => {
        gestureStatus.textContent = "Camera started!";
        drawLoop(video);
      };
    })
    .catch(err => {
      gestureStatus.textContent = "Error accessing webcam";
      console.error(err);
    });
}

function stopGestureMode() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  gestureCtx.clearRect(0, 0, gestureCanvas.width, gestureCanvas.height);
  gestureStatus.textContent = "Gesture mode stopped.";
}

let frameSendTimer = 0;

function drawLoop(video) {
  gestureCtx.drawImage(video, 0, 0, gestureCanvas.width, gestureCanvas.height);

  const now = Date.now();
  if (now - frameSendTimer > 500) {
    frameSendTimer = now;
    sendFrameToServer();
  }

  requestAnimationFrame(() => drawLoop(video));
}

let lastGesture = "";
let sameGestureCount = 0;
let lastSentCommand = "";
let stableThreshold = 3;

function sendFrameToServer() {
  const canvas = document.getElementById("gestureCanvas");
  const imageData = canvas.toDataURL("image/jpeg");
  const gestureIp = localStorage.getItem("gestureip");
  const esp32ip = localStorage.getItem("esp32ip");

  if (!gestureIp) {
    gestureStatus.textContent = "❌ Gesture server IP not set!";
    return;
  }

  fetch(`http://${gestureIp}/gesture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ image: imageData })
  })
    .then(res => res.json())
    .then(data => {
      const currentGesture = data.command;
      console.log("🧠 Detected gesture:", currentGesture);
      gestureStatus.textContent = `Gesture: ${currentGesture}`;

      // Optionally increase threshold for "stop" to prevent flicker
      stableThreshold = currentGesture === "stop" ? 5 : 3;

      if (currentGesture === lastGesture) {
        sameGestureCount++;
      } else {
        lastGesture = currentGesture;
        sameGestureCount = 1;
      }

      if (sameGestureCount >= stableThreshold && esp32ip) {
        if (currentGesture !== lastSentCommand) {
          lastSentCommand = currentGesture;
          sameGestureCount = 0;

          fetch(`http://${esp32ip}/command?cmd=${currentGesture}`, {
            method: 'GET',
            mode: 'no-cors'
          }).then(() => {
            console.log(`✅ Sent to ESP32: ${currentGesture}`);
          }).catch(() => {
            console.warn("⚠️ ESP32 not reachable.");
          });
        }
      }
    })
    .catch(err => {
      console.error("❌ Gesture server error:", err);
      gestureStatus.textContent = "❌ Failed to contact gesture server.";
    });
}

// --- On Load: Autofill saved IPs ---
window.onload = function () {
  const savedEsp32 = localStorage.getItem('esp32ip');
  const savedGesture = localStorage.getItem('gestureip');

  if (savedEsp32) document.getElementById("esp32Ip").value = savedEsp32;
  if (savedGesture) document.getElementById("gestureIp").value = savedGesture;

  const gestureBackBtn = document.getElementById('gestureBackBtn');
  const gestureHomeBtn = document.getElementById('gestureHomeBtn');

  if (gestureBackBtn) gestureBackBtn.onclick = goToModes;
  if (gestureHomeBtn) gestureHomeBtn.onclick = goToHome;
};

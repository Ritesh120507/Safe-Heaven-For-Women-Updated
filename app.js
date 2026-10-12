window.addEventListener("load", () => {

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDzSJPwBC1szW6yLs6wwWgj_RNPjW64ZI0",
  authDomain: "shesafe-d72a3.firebaseapp.com",
  projectId: "shesafe-d72a3",
  storageBucket: "shesafe-d72a3.firebasestorage.app",
  messagingSenderId: "11541245556",
  appId: "1:11541245556:web:bfff4cd49c7b15367fab21"
};

let fbApp, auth, db, fbReady = false;
try {
  fbApp = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  fbReady = true;
  document.getElementById("fb-dot").classList.add("on");
  document.getElementById("fb-status").textContent = "Firebase connected";
} catch (e) {
  console.error("Firebase init failed:", e);
}

const state = {
  user: null, 
  reports: [], 
  pendingLatLng: null, 
  pendingType: null,
  userLocation: null 
};

// UI Helpers
function toast(msg) {
  const wrap = document.getElementById("toast-wrap");
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

function countdownToast(getMsg) {
  const wrap = document.getElementById("toast-wrap");
  const el = document.createElement("div");
  el.className = "toast"; 
  el.style.borderLeft = "4px solid #ef4444";
  el.textContent = getMsg();
  wrap.appendChild(el);
  
  const timer = setInterval(() => {
    el.textContent = getMsg();
  }, 1000);

  setTimeout(() => {
    clearInterval(timer);
    el.remove();
  }, 30000);
}

function openModal(id) { 
  document.getElementById(id).classList.add("show"); 
}

function closeModal(id) { 
  document.getElementById(id).classList.remove("show"); 
  if (id === "zone-modal-overlay" && window.zoneTimer) {
     clearInterval(window.zoneTimer);
  }
}

document.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", () => closeModal(el.dataset.close)));

document.getElementById("nav-mobile-toggle").addEventListener("click", () => {
  document.getElementById("nav-links").classList.toggle("mobile-open");
});
document.querySelectorAll(".nav-link").forEach(l => l.addEventListener("click", () => document.getElementById("nav-links").classList.remove("mobile-open")));

// Determine Role & Badge based on Trust Score
function getRoleAndBadge(trustScore) {
  if (trustScore >= 86) {
    return { name: "Verified Trust Guardian", badge: "Verified Trust Guardian.png" };
  } else if (trustScore >= 76) {
    return { name: "Trust Guardian", badge: "Trust Guardian.png" };
  } else if (trustScore >= 61) {
    return { name: "Community Sentinel", badge: "Community Sentinels.png" };
  } else if (trustScore >= 51) {
    return { name: "Trust Gainer", badge: "Trust Gainers.png" };
  } else {
    return { name: "Beginner", badge: "Beginner.png" };
  }
}

function checkRolePromotion(user, newScore) {
  const roleInfo = getRoleAndBadge(newScore);
  const lastRoleKey = `user_role_${user.uid}`;
  const previousRole = localStorage.getItem(lastRoleKey);

  if (previousRole && previousRole !== roleInfo.name) {
    showPromotionModal(user.displayName || "User", roleInfo.name, roleInfo.badge);
  }
  localStorage.setItem(lastRoleKey, roleInfo.name);
}

function showPromotionModal(userName, roleName, badgeFileName) {
  let modal = document.getElementById("promotion-celeb-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "promotion-celeb-modal";
    modal.className = "modal-overlay show";
    modal.innerHTML = `
      <div class="modal" style="text-align:center; max-width:450px; border: 2px solid var(--theme-glow); background: linear-gradient(135deg, rgba(5,26,15,0.95), rgba(10,31,20,0.95));">
        <div style="margin-bottom:0.5rem;"><img src="${badgeFileName}" style="width:72px; height:72px; object-fit:contain; filter:drop-shadow(0 0 12px rgba(102,255,153,0.8);"></div>
        <h2 style="color:var(--theme-glow); margin-bottom:0.5rem;">Congratulations, ${userName}!</h2>
        <p style="font-size:1.1rem; color:var(--text-hi); font-weight:600; margin-bottom:1rem;">You are now a <b>${roleName}</b>!</p>
        <button class="btn btn-primary" style="width:100%;" onclick="document.getElementById('promotion-celeb-modal').remove()">Awesome!</button>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    modal.classList.add("show");
  }
  if (window.confetti) confetti({ particleCount: 130, spread: 80, origin: { y: 0.6 } });
}

// Update UI based on Auth State & Trust Score
function updateUserUI(user) {
  const authBtns = document.getElementById("auth-buttons");
  const profileCard = document.getElementById("auth-profile-card");
  const markSafeBtn = document.getElementById("mark-safe-btn");
  const reportDangerBtn = document.getElementById("report-danger-btn");
  const navSlot = document.getElementById("nav-user-slot");

  if (user) {
    authBtns.style.display = "none";
    profileCard.style.display = "block";
    
    const roleInfo = getRoleAndBadge(state.user.trust);
    let badgeHtml = `<img src="${roleInfo.badge}" class="trust-badge" title="${roleInfo.name}" alt="Badge">`;
    
    document.getElementById("user-display-name").innerHTML = `${user.displayName || "User"} ${badgeHtml}`;
    document.getElementById("user-email-phone").textContent = `${user.email || "Verified User"} · ${roleInfo.name}`;
    
    if (user.photoURL) {
      document.getElementById("user-avatar-container").innerHTML = `<img src="${user.photoURL}" class="user-avatar-img">`;
    }
    
    navSlot.innerHTML = `
      <div class="nav-user-pill" id="profile-pill" style="cursor:pointer;" title="Click to view Trust Score">
        <span style="font-weight:700; color:var(--theme-glow);">${(user.displayName||"U").charAt(0)}</span>
        <span style="color:var(--text-hi); display:flex; align-items:center;">${user.displayName||"User"} ${badgeHtml}</span>
      </div>`;
      
    document.getElementById("profile-pill").addEventListener("click", () => {
      toast(`Trust Score: ${state.user.trust}/100 (${roleInfo.name})`);
    });

    renderNotificationsSection();

    markSafeBtn.disabled = false;
    reportDangerBtn.disabled = false;
    document.getElementById("pin-hint").innerHTML = "<span>Tap the map to select a location, then choose an action</span>";
  } else {
    authBtns.style.display = "flex";
    profileCard.style.display = "none";
    navSlot.innerHTML = `<a href="#hero" class="btn btn-primary" style="padding:0.4rem 0.9rem; min-height:34px;">Sign in</a>`;
    markSafeBtn.disabled = true;
    reportDangerBtn.disabled = true;
    document.getElementById("pin-hint").innerHTML = "<span>Sign in, then tap the map</span>";
    
    const dedicatedList = document.getElementById("dedicated-notifications-list");
    if (dedicatedList) {
      dedicatedList.innerHTML = `<div style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:2rem 0;">Please sign in to view your notifications and system warnings.</div>`;
    }
  }
}

function renderNotificationsSection() {
  const container = document.getElementById("dedicated-notifications-list");
  if (!container || !state.user) return;
  
  const notifs = state.user.notifications || [];
  if (notifs.length === 0) {
    container.innerHTML = `<div style="color:var(--text-lo); font-size:0.95rem; text-align:center; padding:2rem 0;">No new notifications or warnings at this time. Keep contributing safely!</div>`;
    return;
  }
  
  container.innerHTML = "";
  notifs.slice().reverse().forEach(n => {
    const el = document.createElement("div");
    el.style.cssText = "padding:0.85rem 1rem; background:rgba(102,255,153,0.06); border:1px solid rgba(102,255,153,0.2); border-radius:10px; display:flex; flex-direction:column; gap:0.25rem;";
    
    const timeStr = new Date(n.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
    el.innerHTML = `
      <div style="font-size:0.75rem; color:var(--theme-glow); font-weight:700;">${timeStr}</div>
      <div style="font-size:0.95rem; color:var(--text-hi); font-weight:500;">${n.text}</div>
    `;
    container.appendChild(el);
  });
}

async function addUserNotification(userId, textMsg) {
  if (!userId) return;
  const userRef = db.collection("users").doc(userId);
  try {
    await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      let notifs = [];
      if (doc.exists && doc.data().notifications) {
        notifs = doc.data().notifications;
      }
      notifs.push({ text: textMsg, time: Date.now() });
      t.set(userRef, { notifications: notifs }, { merge: true });
      if (state.user && state.user.uid === userId) {
        state.user.notifications = notifs;
        renderNotificationsSection();
      }
    });
  } catch (err) { console.warn("Add notification error:", err); }
}

async function syncUser(firebaseUser) {
  if (!fbReady) return;
  const ref = db.collection("users").doc(firebaseUser.uid);
  let trustScore = 25; 
  let bannedUntilVal = 0;
  let notificationsVal = [];
  
  try {
    const doc = await ref.get();
    if (doc.exists) {
      trustScore = doc.data().trust ?? 25;
      bannedUntilVal = doc.data().bannedUntil ?? 0;
      notificationsVal = doc.data().notifications ?? [];
    } else {
      await ref.set({ trust: 25, displayName: firebaseUser.displayName, bannedUntil: 0, notifications: [] }, { merge: true });
    }
  } catch (error) {
    console.warn("User sync note:", error.message);
  }

  state.user = { 
    uid: firebaseUser.uid, 
    displayName: firebaseUser.displayName, 
    email: firebaseUser.email, 
    photoURL: firebaseUser.photoURL,
    trust: trustScore,
    bannedUntil: bannedUntilVal,
    notifications: notificationsVal
  };
  
  checkRolePromotion(state.user, trustScore);
  updateUserUI(state.user);
}

document.getElementById("google-signin-btn").addEventListener("click", async () => {
  if (!fbReady) return toast("Firebase not ready");
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const res = await auth.signInWithPopup(provider);
    await syncUser(res.user);
    toast(`Welcome, ${res.user.displayName}`);
  } catch (e) { toast("Sign in failed: " + e.message); }
});

document.getElementById("hero-logout-btn").addEventListener("click", () => {
  if (fbReady) auth.signOut().then(() => { state.user = null; updateUserUI(null); toast("Signed out"); });
});

if (fbReady) {
  auth.onAuthStateChanged(async (user) => {
    if (user) await syncUser(user);
  });
}

const map = L.map("map", { maxZoom: 22 }).setView([20.5937, 78.9629], 5);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { 
  maxZoom: 22,
  maxNativeZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
window.safeHeavenMap = map;

window.addEventListener("resize", () => { if(window.safeHeavenMap) window.safeHeavenMap.invalidateSize(); });
setTimeout(() => { if(window.safeHeavenMap) window.safeHeavenMap.invalidateSize(); }, 500);

map.on("click", (e) => {
  state.pendingLatLng = e.latlng;
  if(state.user) document.getElementById("pin-hint").innerHTML = `<span>✓ Location selected successfully</span>`;
});

let userMarker = null;
let userRadiusCircle = null;
let hasCenteredUser = false;
const PROXIMITY_RADIUS_METERS = 400; 

function setupGPS() {
  const badge = document.getElementById("gps-status-badge");
  if (!("geolocation" in navigator)) {
    if (badge) badge.textContent = "GPS not supported";
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      state.userLocation = { lat, lng };

      if (badge) badge.textContent = `GPS Active (±${Math.round(pos.coords.accuracy)}m)`;

      const userLatLng = [lat, lng];
      if (!userMarker) {
        const userIcon = L.divIcon({
          className: "",
          html: '<div class="gps-user-marker"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        userMarker = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
        userMarker.bindTooltip("You are here", { direction: "top", offset: [0, -10] });
        
        userRadiusCircle = L.circle(userLatLng, {
          radius: pos.coords.accuracy || 30,
          color: "#38bdf8",
          fillColor: "#38bdf8",
          fillOpacity: 0.12,
          weight: 1
        }).addTo(map);
      } else {
        userMarker.setLatLng(userLatLng);
        userRadiusCircle.setLatLng(userLatLng);
        userRadiusCircle.setRadius(pos.coords.accuracy || 30);
      }

      if (!hasCenteredUser) {
        map.flyTo(userLatLng, 15, { duration: 1.5 });
        hasCenteredUser = true;
      }

      checkProximityAlerts();
    },
    (err) => {
      console.warn("GPS error:", err.message);
      if (badge) badge.textContent = "GPS Permission Required";
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );
}

document.getElementById("recenter-gps-btn").addEventListener("click", () => {
  if (state.userLocation) {
    map.flyTo([state.userLocation.lat, state.userLocation.lng], 16, { duration: 1.2 });
    toast("Centered on your GPS location");
  } else {
    toast("Acquiring GPS location, please wait...");
  }
});

function checkProximityAlerts() {
  if (!state.userLocation || !state.reports || state.reports.length === 0) {
    setProximityBanner(null);
    return;
  }

  const now = Date.now();
  const userLL = L.latLng(state.userLocation.lat, state.userLocation.lng);

  const activeReports = state.reports.filter(r => {
    let exp = r.expiresAt;
    if (exp && typeof exp.toMillis === "function") exp = exp.toMillis();
    else if (exp && exp.toDate) exp = exp.toDate().getTime();
    if (exp && exp < now) return false;
    return true;
  });

  let inDanger = false;
  let inSafe = false;

  for (const r of activeReports) {
    const reportLL = L.latLng(r.lat, r.lng);
    const distanceMeters = userLL.distanceTo(reportLL);

    if (distanceMeters <= PROXIMITY_RADIUS_METERS) {
      if (r.type === "danger") {
        inDanger = true;
        break; 
      } else if (r.type === "safe") {
        const totalWeight = (r.confirmations || []).length;
        if (totalWeight >= 3) inSafe = true;
      }
    }
  }

  if (inDanger) setProximityBanner("danger");
  else if (inSafe) setProximityBanner("safe");
  else setProximityBanner(null);
}

function setProximityBanner(status) {
  const banner = document.getElementById("proximity-banner");
  const icon = document.getElementById("proximity-icon");
  const text = document.getElementById("proximity-text");
  if (!banner) return;

  if (status === "danger" && banner.className.indexOf("hidden") !== -1) {
    banner.className = "proximity-banner state-danger";
    icon.textContent = "";
    text.textContent = "Red Alert: Danger Zone Nearby!"; 
  } else if (status === "safe" && banner.className.indexOf("hidden") !== -1) {
    banner.className = "proximity-banner state-safe";
    icon.textContent = "";
    text.textContent = "You are in a verified safe zone."; 
  } else if (!status) {
    banner.className = "proximity-banner hidden";
  }
}

setupGPS();

async function updateUserTrustScore(userId, pointChange) {
  if (!userId) return;
  const userRef = db.collection('users').doc(userId);
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      if (doc.exists) {
        let currentScore = doc.data().trust || 25;
        let newScore = Math.max(0, Math.min(currentScore + pointChange, 100));
        transaction.update(userRef, { trust: newScore });
        if (state.user && state.user.uid === userId) {
          state.user.trust = newScore;
          checkRolePromotion(state.user, newScore);
          updateUserUI(state.user);
        }
      }
    });
  } catch (error) { console.error("Trust update failed:", error); }
}

document.getElementById("mark-safe-btn").addEventListener("click", () => promptReport("safe"));
document.getElementById("report-danger-btn").addEventListener("click", () => promptReport("danger"));

function promptReport(type) {
  if (!state.pendingLatLng) return toast("Tap on the map first to pick a location");
  
  const now = Date.now();
  if (state.user && state.user.bannedUntil && state.user.bannedUntil > now) {
    countdownToast(() => {
      const diff = state.user.bannedUntil - Date.now();
      if (diff <= 0) return "Ban expired. You can now mark zones.";
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      return `Spam Ban Active! Time remaining: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    });
    return;
  }

  state.pendingType = type;
  document.getElementById("report-modal-title").textContent = type === "danger" ? "Report Danger Zone" : "Mark Safe Zone (3 Confirmations Needed)";
  openModal("report-modal-overlay");
}

document.getElementById("report-confirm-btn").addEventListener("click", async () => {
  if (!fbReady || !state.user) return toast("Sign in first");
  const type = state.pendingType;
  const now = Date.now();

  if (type === "safe") {
    const thirtyMinsAgo = now - (30 * 60000);
    const recentSafeReports = state.reports.filter(r => 
      r.reportedBy === state.user.uid && 
      r.type === "safe" && 
      r.timestamp && 
      (r.timestamp.toMillis ? r.timestamp.toMillis() : (r.timestamp.seconds * 1000)) > thirtyMinsAgo
    );

    if (recentSafeReports.length >= 3) {
      const banUntil = now + (30 * 60000);
      const userRef = db.collection("users").doc(state.user.uid);
      
      try {
        await db.runTransaction(async (t) => {
          const uDoc = await t.get(userRef);
          let currentTrust = uDoc.exists ? (uDoc.data().trust || 25) : 25;
          let penalizedTrust = Math.max(0, currentTrust - 10);
          t.update(userRef, { trust: penalizedTrust, bannedUntil: banUntil });
          state.user.trust = penalizedTrust;
          state.user.bannedUntil = banUntil;
        });
        await addUserNotification(state.user.uid, "⚠️ Warning: Account temporarily banned for 30 mins due to report spam (-10 trust penalty).");
      } catch (err) { console.error("Spam penalty error:", err); }

      closeModal("report-modal-overlay");
      
      countdownToast(() => {
        const diff = state.user.bannedUntil - Date.now();
        if (diff <= 0) return "Ban expired.";
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        return `Spam Triggered (-10 Trust)! Banned for: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      });
      return;
    }
  }

  const isGuardian = state.user.trust >= 76;
  const userLoc = state.userLocation || { lat: state.pendingLatLng.lat, lng: state.pendingLatLng.lng };
  const initialConfs = type === "safe" ? [{ uid: state.user.uid, lat: userLoc.lat, lng: userLoc.lng }] : [];
  
  if (type === "safe" && isGuardian) {
    initialConfs.push({ uid: "GUARDIAN_WEIGHT_BOOST", lat: userLoc.lat, lng: userLoc.lng }); 
  }

  const report = {
    type,
    lat: state.pendingLatLng.lat,
    lng: state.pendingLatLng.lng,
    reportedBy: state.user.uid,
    reportedByName: state.user.displayName || "Anonymous",
    reporterTrust: state.user.trust, 
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    confirmations: initialConfs, 
    expiresAt: now + 30 * 60000,
    thankCount: 0,
    thankedBy: []
  };

  try {
    await db.collection("reports").add(report);
    toast(type === "danger" ? "Danger reported immediately" : (isGuardian ? "Safe zone submitted by Guardian (2 of 3 confirmed)!" : "Safe zone submitted (1 of 3 confirmed)"));
    state.pendingLatLng = null;
    document.getElementById("pin-hint").innerHTML = "<span>Tap anywhere on the map to select a location</span>";
    closeModal("report-modal-overlay");
  } catch (error) { 
    toast("Error: " + error.message); 
  }
});

async function confirmSafeZone(reportId) {
  if (!state.user) return toast("Sign in to confirm");
  if (!state.userLocation) return toast("GPS location required to confirm safe zones from distinct places.");

  const ref = db.collection("reports").doc(reportId);
  try {
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw "Report missing";
      const data = snap.data();
      const confs = data.confirmations || [];
      
      if (confs.some(c => c.uid === state.user.uid)) throw "You already confirmed this zone";

      const currentUserLL = L.latLng(state.userLocation.lat, state.userLocation.lng);
      for (const existingConf of confs) {
        if (existingConf.lat && existingConf.lng && existingConf.uid !== state.user.uid && existingConf.uid !== "GUARDIAN_WEIGHT_BOOST") {
          const existingLL = L.latLng(existingConf.lat, existingConf.lng);
          if (currentUserLL.distanceTo(existingLL) < 50) {
            throw "Confirmation rejected: Your GPS location is too close to another confirmer (>50m separation required).";
          }
        }
      }
      
      const newConfs = [...confs, { uid: state.user.uid, lat: state.userLocation.lat, lng: state.userLocation.lng }];
      if (state.user.trust >= 76) {
        newConfs.push({ uid: "GUARDIAN_WEIGHT_BOOST", lat: state.userLocation.lat, lng: state.userLocation.lng });
      }

      const totalWeight = newConfs.length;
      const updatePayload = { confirmations: newConfs };
      
      if (totalWeight >= 3) {
         updatePayload.expiresAt = Date.now() + 30 * 60000;
         updateUserTrustScore(data.reportedBy, 5); 
      }
      
      transaction.update(ref, updatePayload);
    });
    toast("Zone confirmed from your location!");
    closeModal("zone-modal-overlay");
  } catch (error) { 
    toast(error.toString()); 
  }
}

function makeIcon(type, totalWeight) {
  let fill, ring, shadow;
  if (type === "danger") { 
    fill = "rgba(255, 77, 77, 0.9)"; ring = "#ff3333"; shadow = "0 0 15px rgba(255, 77, 77, 0.8)";
  } else if (totalWeight >= 3) { 
    fill = "rgba(77, 255, 136, 0.9)"; ring = "#33ff77"; shadow = "0 0 15px rgba(77, 255, 136, 0.8)";
  } else { 
    fill = "rgba(255, 214, 51, 0.9)"; ring = "#ffcc00"; shadow = "0 0 15px rgba(255, 204, 0, 0.8)"; 
  }
  
  return L.divIcon({
    className: "", html: `<div class="sh-marker" style="width:26px;height:26px;background:${fill};border-color:${ring};box-shadow:${shadow};"></div>`,
    iconSize: [26,26], iconAnchor: [13,13]
  });
}

function renderReports() {
  markerLayer.clearLayers();
  const list = document.getElementById("reports-list");
  list.innerHTML = "";
  const now = Date.now();

  const activeReports = state.reports.filter(r => {
    let exp = r.expiresAt;
    if (exp && typeof exp.toMillis === 'function') exp = exp.toMillis();
    else if (exp && exp.toDate) exp = exp.toDate().getTime();
    if (exp && exp < now) return false;
    return true;
  });

  document.getElementById("reports-count").textContent = `${activeReports.length} Active`;

  activeReports.forEach(r => {
    const confs = r.confirmations || [];
    const totalWeight = confs.length;
    let status = r.type === "danger" ? "Danger" : (totalWeight >= 3 ? "Verified Safe" : `${totalWeight} of 3 Confirmed`);
    let cls = r.type === "danger" ? "danger" : (totalWeight >= 3 ? "safe" : "pending");

    const marker = L.marker([r.lat, r.lng], { icon: makeIcon(r.type, totalWeight) }).addTo(markerLayer);
    marker.on("click", () => openZoneModal(r.id));

    const item = document.createElement("div");
    item.className = "report-item";
    item.onclick = () => { map.flyTo([r.lat, r.lng], 14); openZoneModal(r.id); };
    item.innerHTML = `<div class="report-top"><span style="font-weight:700; color:var(--text-hi);">${r.reportedByName}</span><span class="tag ${cls}">${status}</span></div>`;
    list.appendChild(item);
  });

  checkProximityAlerts();
}

function openZoneModal(id) {
  const r = state.reports.find(x => x.id === id);
  if(!r) return;
  const confs = r.confirmations || [];
  const totalWeight = confs.length;
  
  document.getElementById("zone-modal-title").textContent = r.type === "danger" ? "Danger Zone" : "Safe Zone";
  const confirmBtn = document.getElementById("zone-confirm-btn");
  const thanksBtn = document.getElementById("say-thanks-btn");
  const profileBtn = document.getElementById("view-profile-btn");
  const prog = document.getElementById("zone-modal-progress");
  
  let timerEl = document.getElementById("zone-modal-timer");
  if (!timerEl) {
    timerEl = document.createElement("div");
    timerEl.id = "zone-modal-timer";
    timerEl.style.cssText = "font-family: monospace; font-size: 2.8rem; color: var(--theme-glow); text-align: center; margin-bottom: 1rem; font-weight: 700; display: none;";
    prog.parentNode.insertBefore(timerEl, prog);
  }

  if (window.zoneTimer) clearInterval(window.zoneTimer);
  timerEl.style.display = "block";
  
  const updateTimerDisplay = () => {
    const now = Date.now();
    let exp = r.expiresAt;
    if (exp && typeof exp.toMillis === 'function') exp = exp.toMillis();
    else if (exp && exp.toDate) exp = exp.toDate().getTime();

    if (!exp) return;
    const diff = exp - now;
    if (diff <= 0) {
      timerEl.textContent = "00:00";
      clearInterval(window.zoneTimer);
      closeModal("zone-modal-overlay");
      renderReports();
    } else {
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  };
  updateTimerDisplay();
  window.zoneTimer = setInterval(updateTimerDisplay, 1000);

  if (r.type === "danger") {
    prog.textContent = `Reported by ${r.reportedByName || "Anonymous"}. Active danger broadcast.`;
    confirmBtn.style.display = "none";
  } else {
    if (totalWeight >= 3) {
      prog.textContent = `Fully Verified Safe Zone by ${r.reportedByName || "Anonymous"}.`;
      confirmBtn.style.display = "none";
    } else {
      prog.textContent = `3 confirmations required (${totalWeight}/3). Reported by ${r.reportedByName || "Anonymous"}.`;
      confirmBtn.style.display = "block";
      const hasConfirmed = confs.some(c => c.uid === state.user?.uid);
      if (!state.user) { 
        confirmBtn.disabled = true; confirmBtn.textContent = "Sign in to confirm"; 
      } else if (hasConfirmed) { 
        confirmBtn.disabled = true; confirmBtn.textContent = "You already confirmed this"; 
      } else { 
        confirmBtn.disabled = false; confirmBtn.textContent = "Confirm from your GPS location"; 
      }
      confirmBtn.onclick = () => confirmSafeZone(id);
    }
  }

  const firstName = (r.reportedByName || "User").split(" ")[0];
  thanksBtn.style.display = "block";
  thanksBtn.textContent = `Say Thank You To ${firstName}`;
  thanksBtn.onclick = async () => {
    if (!state.user) return toast("Sign in first");
    if (r.reportedBy === state.user.uid) return toast("You cannot thank your own report!");
    
    const thankedByList = r.thankedBy || [];
    if (thankedByList.includes(state.user.uid)) return toast("You already thanked this user for this zone!");

    thankedByList.push(state.user.uid);
    try {
      await db.collection("reports").doc(id).update({ thankedBy: thankedByList });
      await addUserNotification(r.reportedBy, `${state.user.displayName || "Someone"} sent you a thank-you message for marking this zone!`);
      toast(`Thank you message sent to ${firstName}!`);
    } catch (err) { toast("Error sending thanks: " + err.message); }
  };

  profileBtn.style.display = "block";
  profileBtn.textContent = `Tap to See ${firstName}'s Profile`;
  profileBtn.onclick = async () => {
    closeModal("zone-modal-overlay");
    await openCreatorProfileModal(r.reportedBy, firstName);
  };

  openModal("zone-modal-overlay");
}

async function openCreatorProfileModal(userId, firstName) {
  if (!userId) return toast("User profile unavailable");
  
  let userTrust = 25;
  try {
    const doc = await db.collection("users").doc(userId).get();
    if (doc.exists) userTrust = doc.data().trust || 25;
  } catch(e) { console.warn(e); }

  let safeCount = 0;
  let dangerCount = 0;
  let totalHelped = 0;

  try {
    const snap = await db.collection("reports").where("reportedBy", "==", userId).get();
    snap.forEach(d => {
      const dat = d.data();
      if (dat.type === "safe") safeCount++;
      else if (dat.type === "danger") dangerCount++;
      if (dat.thankedBy && Array.isArray(dat.thankedBy)) {
        totalHelped += dat.thankedBy.length;
      }
    });
  } catch(e) { console.warn(e); }

  const roleInfo = getRoleAndBadge(userTrust);
  
  document.getElementById("creator-profile-title").textContent = `${firstName}'s Profile`;
  document.getElementById("creator-profile-badge-slot").innerHTML = `<img src="${roleInfo.badge}" style="width:64px; height:64px; object-fit:contain; filter:drop-shadow(0 0 8px rgba(102,255,153,0.5));">`;
  document.getElementById("creator-profile-trust").textContent = `Rank: ${roleInfo.name} (Trust Score: ${userTrust}/100)`;
  
  document.getElementById("stat-safe-count").textContent = safeCount;
  document.getElementById("stat-danger-count").textContent = dangerCount;
  document.getElementById("stat-total-count").textContent = safeCount + dangerCount;
  document.getElementById("stat-helped-count").textContent = totalHelped;

  openModal("creator-profile-modal-overlay");
}

async function cleanupExpiredZones() {
  const now = Date.now();
  const expiredQuery = db.collection('reports').where('expiresAt', '<', now);
  try {
    const snapshot = await expiredQuery.get();
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch (error) { console.error("Cleanup failed:", error); }
}

setInterval(() => {
  if (state.reports && state.reports.length > 0) renderReports();
  if (fbReady) cleanupExpiredZones();
}, 15000);

if (fbReady) {
  db.collection("reports").orderBy("timestamp", "desc").limit(100).onSnapshot(
    snap => {
      state.reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderReports();
    },
    error => { console.warn("Firestore Rules note:", error.message); }
  );
}

});
/* DDT 90 — LOGICIEL INTERACTIF D'AIDE À LA DÉCISION — app.js
 * Logique applicative : carte Leaflet, couches IGN/GeoJSON, analyse enjeux,
 * contacts, checklist, simulation, rapport PDF.
 * Dépend de : enjeux-db.js  (GEOJSON_TB, TYPES, TAILLES, ENJEUX)
 * Démarrage  : python3 -m http.server 8080  →  http://localhost:8080    */

/* ── COUCHES THÉMATIQUES — Atlas DDT 90 (11 thèmes, C1–C91)
   Styles visuels + tooltips. Couche agriculture branchée sur la
   Géoplateforme IGN (WMTS). Les autres utilisent COUCHES_DATA (GeoJSON local).
   Production : remplacer par des flux WFS IGN temps réel.           */

/* ── COUCHES IGN GÉOPLATEFORME — WMTS sans clé API
   Identifiants vérifiés : GetCapabilities mars 2026 (data.geopf.fr/wmts)
   URL patron GPF_WMTS + &LAYER=XXX + &FORMAT=image/png|jpeg          */


/* URL patron WMTS Géoplateforme (sans clé, accès libre) */
var GPF_WMTS = 'https://data.geopf.fr/wmts?' +
  'SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
  '&STYLE=normal&TILEMATRIXSET=PM' +
  '&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';


/* ── SOUS-TYPES DE PROJETS
   { id, ico, label, desc, cat } — affinent la sélection et la checklist */


/* ── CHECKLISTS ADMINISTRATIVES
   Étapes réglementaires par sous-type. { id, ico, label, desc, delai, oblig } */


/* ── COUCHES_DATA — GeoJSON embarqué (11 couches Atlas DDT 90)
   Fallback si IGN indisponible. agriculture/cadastre : IGN-only (pas de fallback). */


/* ── État global de l'application ───────────────────────────────── */
/* ── DONNÉES EXTERNALISÉES — chargées depuis data.json ── */
var COUCHES_IGN, GPF_WMTS, COUCHE_STYLES, SOUS_TYPES, CHECKLISTS;
var AXES_META, ENJEUX_MINDMAP, CONTACTS_DB, SIM_BASE, ZONES_RISQUE;
var OSM_TAGS, RPG_GROUPES_SENSIBLES, SG_CAS, SG_QUESTIONS, SUGG_ICONS;
var COUCHES_DATA, ENJEUX_CONTEXTUELS, ENJEUX_ZONES;
var TYPES, TAILLES, THEMES;
var GEOJSON_TB, ENJEUX;

var A = {
  /* Projet */
  typeProjet:    null,    // id du type sélectionné
  taille:        1,       // 1-4
  themesActifs:  null,    // Set des thèmes filtrés
  superficieHa:  null,    // superficie en hectares
  /* Carte — placement */
  modePlacement: false,   // mode clic-pour-placer actif
  modeDeplace:   false,   // mode double-clic-pour-déplacer actif
  carte:         null,    // instance L.map
  layerCommunes: null,    // GeoJSON communes
  layerProjet:   null,    // CircleMarker projet
  layerCercle:   null,    // Circle superficie
  position:      null,    // { lat, lng }
  /* Couches thématiques */
  couches:       {},      // { themeId: L.GeoJSON }
  couchesActives: new Set(), // thèmes actuellement affichés
};

/* ── Point d'entrée ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  console.log('%c DDT90 v2026-03-20 ','background:#1d4ed8;color:#fff;padding:2px 6px;border-radius:3px;');

  /* Chargement des données depuis data.json */
  fetch('data.json')
    .then(function(r) {
      if (!r.ok) throw new Error('data.json introuvable (HTTP ' + r.status + ')');
      return r.json();
    })
    .then(function(d) {
      COUCHES_IGN         = d.COUCHES_IGN;
      COUCHE_STYLES       = d.COUCHE_STYLES;
      SOUS_TYPES          = d.SOUS_TYPES;
      CHECKLISTS          = d.CHECKLISTS;
      AXES_META           = d.AXES_META;
      ENJEUX_MINDMAP      = d.ENJEUX_MINDMAP;
      CONTACTS_DB         = d.CONTACTS_DB;
      SIM_BASE            = d.SIM_BASE;
      ZONES_RISQUE        = d.ZONES_RISQUE;
      OSM_TAGS            = d.OSM_TAGS;
      RPG_GROUPES_SENSIBLES = d.RPG_GROUPES_SENSIBLES;
      SG_CAS              = d.SG_CAS;
      SG_QUESTIONS        = d.SG_QUESTIONS;
      SUGG_ICONS          = d.SUGG_ICONS;
      COUCHES_DATA        = d.COUCHES_DATA;
      ENJEUX_CONTEXTUELS  = d.ENJEUX_CONTEXTUELS;
      ENJEUX_ZONES        = d.ENJEUX_ZONES;
      TYPES               = d.TYPES;
      TAILLES             = d.TAILLES;
      THEMES              = d.THEMES;
      GEOJSON_TB          = d.GEOJSON_TB;
      ENJEUX              = d.ENJEUX;

      /* Initialisation après chargement des données */
      A.themesActifs = new Set(THEMES.map(function(t){ return t.id; }));
      initCarte();
      genBoutons();
      genBadgesThemes();
      genControleCouches();
      majTaille(1);
      initTheme();

      /* Tutoriel : affiché à chaque démarrage */
      setTimeout(afficherTutoriel, 80);
    })
    .catch(function(err) {
      console.error('[DDT90] Erreur chargement data.json :', err);
      document.body.innerHTML = '<div style="padding:40px;font-family:Arial;color:#dc2626;"><h2>&#x26A0; Erreur de chargement</h2><p>Impossible de charger <strong>data.json</strong>.</p><p>Vérifiez que l\'application est lancée via HTTP (python3 -m http.server 8080) et non via file://</p><p>Détail : '+err.message+'</p></div>';
    });
});

/* ── CARTE LEAFLET — initialisation, communes, marqueurs, listeners ────────── */

function initCarte() {
  A.carte = L.map('map', {
    center: [47.637, 6.863],
    zoom: 11,
    doubleClickZoom: false,   // désactivé pour ne pas interférer avec le déplacement
  });

  /* Pane dédié aux communes : z-index sous la légende, pointer-events none
     pour que les clics traversent jusqu'aux contrôles HTML (légende, boutons) */
  A.carte.createPane('communesPane');
  A.carte.getPane('communesPane').style.zIndex = 200;
  A.carte.getPane('communesPane').style.pointerEvents = 'none';

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(A.carte);

  ajouterCommunesGeoJSON();
  ajouterMarqueursPrincipaux();
  ajouterListenersGlobaux();
}

/**
 * Retourne true si au moins une couche Géoplateforme IGN est active
 * ET visible au zoom actuel (zoom >= minZoom de la couche).
 * Désactive tooltip et highlight communes pour toutes les couches IGN.
 */
/**
 * Retourne true si au moins une couche Géoplateforme IGN est active
 * ET visible au zoom courant (zoom >= minZoom). Utilisé pour désactiver
 * le tooltip et le highlight des communes quand des tuiles IGN les recouvrent.
 * @returns {boolean}
 */
function anyIgnActive() {
  var zoom = A.carte ? A.carte.getZoom() : 0;
  return Object.keys(COUCHES_IGN).some(function(id) {
    if (!A.couchesActives.has(id)) return false;
    var def = COUCHES_IGN[id];
    return zoom >= (def.minZoom || 6);
  });
}


/* Charge le GeoJSON des communes avec tooltips et highlight */
function ajouterCommunesGeoJSON() {
  A.layerCommunes = L.geoJSON(GEOJSON_TB, {
    pane:  'communesPane',
    style: styleCommuneDefaut,
    onEachFeature: function(feature, layer) {
      /* Tooltip hover */
      var p   = feature.properties;
      var sup = p.superficie_ha || 0;
      var supAff = sup >= 100
        ? (sup / 100).toFixed(1) + ' km² (' + sup.toFixed(0) + ' ha)'
        : sup.toFixed(1) + ' ha';
      var pop = p.population
        ? p.population.toLocaleString('fr-FR') + ' hab.'
        : 'N/A';

      /* Tooltip en mode manuel (pas sticky) pour pouvoir le bloquer
         quand la couche Agriculture IGN est active au zoom 13+ */
      layer.bindTooltip(
        '<div class="tt-nom">' + p.nom + '</div>' +
        '<div class="tt-row"><span class="tt-ico">&#x1F465;</span><span>Population&nbsp;: </span><span class="tt-val">' + pop + '</span></div>' +
        '<div class="tt-row"><span class="tt-ico">&#x1F4CF;</span><span>Superficie&nbsp;: </span><span class="tt-val">' + supAff + '</span></div>' +
        '<div class="tt-row"><span class="tt-ico">&#x1F4EE;</span><span>Code postal&nbsp;: </span><span class="tt-val">' + (p.codesPostaux ? p.codesPostaux[0] : '') + '</span></div>',
        { className: 'commune-tooltip', sticky: false, permanent: false,
          direction: 'top', offset: [0, -4], interactive: false }
      );

      layer.on('mouseover', function(e) {
        if (anyIgnActive()) return;   /* parcelles IGN visibles : rien */
        if (!A.modePlacement && !A.modeDeplace) {
          layer.setStyle({ fillOpacity: 0.20, weight: 2, color: '#002395' });
        }
        layer.openTooltip(e.latlng);
      });
      layer.on('mousemove', function(e) {
        if (anyIgnActive()) { layer.closeTooltip(); return; }
        layer.getTooltip() && layer.openTooltip(e.latlng);
      });
      layer.on('mouseout', function() {
        layer.closeTooltip();
        if (!anyIgnActive()) {
          A.layerCommunes.resetStyle(layer);
        }
      });

      /* Clic simple → placement si mode actif */
      layer.on('click', function(e) {
        gererClicCarte(e.latlng.lat, e.latlng.lng);
      });

      /* Double-clic → déplacement du projet existant */
      layer.on('dblclick', function(e) {
        L.DomEvent.stopPropagation(e);
        gererDblClicCarte(e.latlng.lat, e.latlng.lng);
      });
    }
  }).addTo(A.carte);

  /* Réactiver pointer-events sur les paths SVG des communes uniquement,
     pas sur le pane entier — ainsi les éléments HTML au-dessus (légende)
     reçoivent les clics normalement. */
  var paneEl = A.carte.getPane('communesPane');
  if (paneEl) {
    var svg = paneEl.querySelector('svg');
    if (svg) svg.style.pointerEvents = 'auto';
  }
  /* Fallback : observer l'ajout du SVG si pas encore rendu */
  setTimeout(function() {
    var pEl = A.carte.getPane('communesPane');
    if (pEl) {
      var s = pEl.querySelector('svg');
      if (s) s.style.pointerEvents = 'auto';
    }
  }, 200);
}

function styleCommuneDefaut() {
  return { color: '#002395', weight: 1, opacity: 0.45, fillColor: '#002395', fillOpacity: 0.04 };
}

function ajouterMarqueursPrincipaux() {
  /* Marqueur discret pour le chef-lieu uniquement — sans markers de villes */
  ajouterMarqueur(47.637, 6.863, '#002395', 7, '<b>Belfort</b><br/>Chef-lieu &mdash; DDT 90');
}

function ajouterMarqueur(lat, lng, fill, r, popup) {
  L.circleMarker([lat, lng], {
    radius: r, fillColor: fill, color: '#fff', weight: 2, fillOpacity: .95,
  }).addTo(A.carte).bindPopup(popup);
}

/* Listeners globaux sur la carte (zones vides entre communes) */
function ajouterListenersGlobaux() {
  A.carte.on('click', function(e) {
    gererClicCarte(e.latlng.lat, e.latlng.lng);
  });
  A.carte.on('dblclick', function(e) {
    gererDblClicCarte(e.latlng.lat, e.latlng.lng);
  });
  /* Masquer le GeoJSON communes quand la couche agriculture IGN est visible */
  A.carte.on('zoomend', function() {
    majOpaciteCommunesSelonCouches();
    majLegende();
  });
}

/* ── CLICS CARTE — placement projet (clic simple) + déplacement (double-clic) */

/* Clic simple : place le projet si mode placement actif */
function gererClicCarte(lat, lng) {
  if (A.modePlacement) {
    placerProjet(lat, lng);
    desactiverPlacement();
  }
}

/* Double-clic : sélectionne & active le mode déplacement si le projet existe,
   ou sinon déplace directement si modeDeplace déjà actif */
function gererDblClicCarte(lat, lng) {
  if (!A.position) return;   // aucun projet placé

  if (A.modeDeplace) {
    /* Deuxième double-clic : déplacer à ce point */
    placerProjet(lat, lng);
    desactiverDeplace();
  } else {
    /* Premier double-clic : activer le mode déplacement */
    activerDeplace();
  }
}

/* ── PLACEMENT / DÉPLACEMENT DU PROJET ──────────────────────────────────────── */

function placerProjet(lat, lng) {
  /* Supprimer les couches précédentes */
  if (A.layerProjet) { A.carte.removeLayer(A.layerProjet); A.layerProjet = null; }
  if (A.layerCercle) { A.carte.removeLayer(A.layerCercle); A.layerCercle = null; }

  A.position = { lat: lat, lng: lng };

  var typeInfo = TYPES.find(function(t){ return t.id === A.typeProjet; });
  var libelle  = typeInfo ? typeInfo.label : 'Projet';

  /* Marqueur : cercle rouge avec popup informatif */
  A.layerProjet = L.circleMarker([lat, lng], {
    radius: 11, fillColor: '#dc2626', color: '#fff', weight: 2.5, fillOpacity: .93,
  }).addTo(A.carte)
  .bindPopup(
    '<b>' + libelle + '</b>' +
    (A.superficieHa ? '<br/>Superficie : ' + A.superficieHa.toFixed(2) + ' ha' : '') +
    '<br/><small style="color:#666">Lat ' + lat.toFixed(5) + ' — Lng ' + lng.toFixed(5) + '</small>' +
    '<br/><small style="color:#888">Double-clic sur la carte pour déplacer</small>'
  );

  /* Cercle de superficie proportionnel (rayon = √(S/π)) */
  if (A.superficieHa && A.superficieHa > 0) {
    var rayon = Math.sqrt(A.superficieHa * 10000 / Math.PI);
    A.layerCercle = L.circle([lat, lng], {
      radius: rayon, color: '#dc2626', weight: 1.5, opacity: .7,
      fillColor: '#dc2626', fillOpacity: .10, dashArray: '5,4',
    }).addTo(A.carte);
  }

  /* Mise à jour de l'interface panneau */
  document.getElementById('pos-txt').textContent =
    'Lat ' + lat.toFixed(4) + ', Lng ' + lng.toFixed(4);
  document.getElementById('pos-info').classList.add('on');
  document.getElementById('btn-suppr').classList.add('on');
  document.getElementById('leg-projet').style.display = 'flex';

  /* Masquer l'avertissement de placement si visible */
  var msgReq = document.getElementById('placement-requis');
  if (msgReq) msgReq.classList.remove('on');
  var btnPl = document.getElementById('btn-placer');
  if (btnPl) btnPl.style.boxShadow = '';
}

function supprimerProjet() {
  if (A.layerProjet) { A.carte.removeLayer(A.layerProjet); A.layerProjet = null; }
  if (A.layerCercle) { A.carte.removeLayer(A.layerCercle); A.layerCercle = null; }
  A.position = null;
  document.getElementById('pos-info').classList.remove('on');
  document.getElementById('btn-suppr').classList.remove('on');
  document.getElementById('leg-projet').style.display = 'none';
  desactiverDeplace();
  /* Masquer les sections de résultats */
  ['section-contacts','section-checklist','section-alentours'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  /* Nettoyer la couche alentours OSM */
  if (typeof alentours !== 'undefined' && alentours.layer) {
    A.carte.removeLayer(alentours.layer);
    alentours.layer = null;
    alentours.resultats = [];
  }
  /* Désactiver le bouton rapport */
  A._lastFiltres = null; A._lastZonesResultats = null;
  var btnRap = document.getElementById('btn-rapport');
  if (btnRap) { btnRap.disabled = true; btnRap.style.opacity = '.4'; }
}

/* ── Mode placement (simple clic) ──────────────────────────────── */
function togglePlacement() {
  if (A.modePlacement) { desactiverPlacement(); } else { activerPlacement(); }
}

function activerPlacement() {
  A.modePlacement = true;
  A.carte.getContainer().style.cursor = 'crosshair';
  var btn = document.getElementById('btn-placer');
  btn.classList.add('en-cours');
  btn.querySelector('#btn-placer-ico').textContent = '\u274C';
  btn.querySelector('#btn-placer-txt').textContent = 'Annuler le placement';
  document.getElementById('notif-placement').textContent = '\uD83D\uDCCD  Cliquez sur la carte pour placer votre projet';
  document.getElementById('notif-placement').classList.add('on');
}

function desactiverPlacement() {
  A.modePlacement = false;
  A.carte.getContainer().style.cursor = '';
  var btn = document.getElementById('btn-placer');
  btn.classList.remove('en-cours');
  btn.querySelector('#btn-placer-ico').innerHTML = '&#x1F4CD;';
  btn.querySelector('#btn-placer-txt').textContent = 'Placer le projet sur la carte';
  document.getElementById('notif-placement').classList.remove('on');
}

/* ── Mode déplacement (double-clic) ────────────────────────────── */
function activerDeplace() {
  A.modeDeplace = true;
  A.carte.getContainer().style.cursor = 'move';
  /* Passer le marqueur en mode "sélectionné" : contour jaune */
  if (A.layerProjet) {
    A.layerProjet.setStyle({ color: '#fbbf24', weight: 3.5 });
  }
  document.getElementById('notif-placement').textContent = '\u2725  Double-cliquez sur la carte pour déplacer le projet';
  document.getElementById('notif-placement').classList.add('on');
}

function desactiverDeplace() {
  A.modeDeplace = false;
  A.carte.getContainer().style.cursor = '';
  if (A.layerProjet) {
    A.layerProjet.setStyle({ color: '#fff', weight: 2.5 });
  }
  document.getElementById('notif-placement').classList.remove('on');
}

/* ── COUCHES THÉMATIQUES — contrôles UI, chargement, légende ───────────────── */

/* Génère les boutons de contrôle des couches dans le panneau gauche */
function genControleCouches() {
  var conteneur = document.getElementById('layer-grid');
  conteneur.innerHTML = '';

  Object.keys(COUCHE_STYLES).forEach(function(themeId) {
    var style = COUCHE_STYLES[themeId];
    var btn = document.createElement('div');
    btn.className  = 'layer-toggle';
    btn.dataset.id = themeId;
    btn.innerHTML =
      '<span class="layer-swatch" style="background:' + style.swatch + ';"></span>' +
      '<span class="layer-label">' + style.label + '</span>' +
      (style.tooltip
        ? '<span class="layer-info" data-tooltip="' + style.tooltip.replace(/"/g, '&quot;') + '" aria-label="En savoir plus">?</span>'
        : '') +
      '<span class="layer-check">\u2713</span>';

    /* Clic : activer/désactiver la couche sauf si clic sur le ? */
    btn.addEventListener('click',function(e){if(e.target.closest('.layer-info'))return;var st=COUCHE_STYLES[themeId];if(st&&st.groupe)toggleCoucheGroupe(themeId,st.groupe,btn);else toggleCouche(themeId,btn);});

    conteneur.appendChild(btn);
  });

  /* ── Tooltip fixe : échappe l'overflow:hidden du panneau gauche ── */
  var tipEl = document.getElementById('layer-tooltip-global');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'layer-tooltip-global';
    tipEl.className = 'layer-tooltip-bubble';
    document.body.appendChild(tipEl);
  }

  conteneur.addEventListener('mouseover', function(e) {
    var info = e.target.closest('.layer-info');
    if (!info) return;
    tipEl.textContent = info.dataset.tooltip || '';
    var rect = info.getBoundingClientRect();
    var top  = rect.top + rect.height / 2;
    var left = rect.right + 10;
    /* Si la bulle déborde à droite, la placer à gauche du ? */
    if (left + 248 > window.innerWidth) {
      left = rect.left - 248 - 10;
      tipEl.classList.add('tip-left');
    } else {
      tipEl.classList.remove('tip-left');
    }
    tipEl.style.top  = top + 'px';
    tipEl.style.left = left + 'px';
    tipEl.classList.add('visible');
  });

  conteneur.addEventListener('mouseout', function(e) {
    if (!e.relatedTarget || !e.relatedTarget.closest('.layer-info')) {
      tipEl.classList.remove('visible');
    }
  });
}

function toggleCoucheGroupe(gId,membres,btn){var on=A.couchesActives.has(gId);if(on){membres.forEach(function(id){if(A.couches[id]){A.carte.removeLayer(A.couches[id]);delete A.couches[id];}A.couchesActives.delete(id);});A.couchesActives.delete(gId);btn.classList.remove('actif');btn.title='';}else{membres.forEach(function(id){chargerCouche(id);A.couchesActives.add(id);});A.couchesActives.add(gId);btn.classList.add('actif');var d0=COUCHES_IGN[membres[0]];if(d0&&d0.minZoom&&A.carte.getZoom()<d0.minZoom)afficherToastZoom('?? '+(COUCHE_STYLES[gId]?COUCHE_STYLES[gId].label:gId)+' — zoom '+d0.minZoom+'+',d0.minZoom);}majOpaciteCommunesSelonCouches();majLegende();}

function toggleCouche(themeId, btn) {
  if (A.couchesActives.has(themeId)) {
    /* Désactiver : retirer de la carte */
    if (A.couches[themeId]) {
      A.carte.removeLayer(A.couches[themeId]);
      delete A.couches[themeId];
    }
    A.couchesActives.delete(themeId);
    btn.classList.remove('actif');
    btn.title = '';
    majOpaciteCommunesSelonCouches();
    majLegende();
  } else {
    /* Activer : charger et afficher */
    chargerCouche(themeId);
    A.couchesActives.add(themeId);
    btn.classList.add('actif');
    /* Avertir si zoom insuffisant */
    var igndef = COUCHES_IGN[themeId];
    if (igndef && igndef.minZoom && A.carte.getZoom() < igndef.minZoom) {
      btn.title = 'Zoomez jusqu\'au niveau ' + igndef.minZoom + '+ pour voir cette couche';
      var zMin = igndef.minZoom;
      var lbl  = COUCHE_STYLES[themeId] ? COUCHE_STYLES[themeId].label : themeId;
      afficherToastZoom('\uD83D\uDD0D ' + lbl + ' — cliquez ici pour zoomer au niveau ' + zMin, zMin);
    }
    /* Atténuer les limites communes GeoJSON si la couche IGN en affiche déjà */
    majOpaciteCommunesSelonCouches();
    majLegende();
  }
}

/**
 * Charge une couche thématique sur la carte.
 * 1. Flux WMTS Géoplateforme (COUCHES_IGN) si l'entrée existe.
 * 2. Fallback GeoJSON local (COUCHES_DATA) sinon.
 * ⚠ agriculture et cadastre : IGN-only, pas de fallback GeoJSON.
 * @param {string} themeId — clé de COUCHE_STYLES
 */
function chargerCouche(themeId){
  var style=COUCHE_STYLES[themeId];
  if(!style){var p={monuments_historiques:'patrimoine',archeologie_preventive:'patrimoine',transport_routier:'mobilite',transport_ferroviaire:'mobilite'};style=COUCHE_STYLES[p[themeId]]||null;if(!style)return;}

  /* ── 1. Flux WMTS Géoplateforme ────────────────────────────────────── */
  var igndef = COUCHES_IGN[themeId];
  if (igndef && igndef.layer) {
    var url = GPF_WMTS +
      '&LAYER=' + igndef.layer +
      '&FORMAT=' + (igndef.format || 'image/png');

    var layer;if(igndef.wms){layer=L.tileLayer.wms('https://data.geopf.fr/wms-r',{layers:igndef.layer,format:'image/png',transparent:true,opacity:igndef.opacity||0.75,minZoom:igndef.minZoom||6,maxZoom:19,attribution:'<a href="https://geoservices.ign.fr/" target="_blank">IGN-F</a>'});}else{layer=L.tileLayer(url,{minZoom:igndef.minZoom||6,maxZoom:19,opacity:igndef.opacity||0.75,attribution:'<a href="https://geoservices.ign.fr/" target="_blank">IGN-F / G&eacute;oplateforme</a>',crossOrigin:true});}

    A.couches[themeId] = layer;
    layer.addTo(A.carte);

    /* Erreur de chargement → basculer sur GeoJSON local
       SAUF pour cadastre et agriculture : ces couches n'ont pas de GeoJSON atlas
       (le GeoJSON 'agriculture' est l'atlas DDT, pas le RPG) */
    var noFallback = (themeId === 'cadastre' || themeId === 'agriculture');
    layer.on('tileerror', function() {
      if (noFallback) {
        console.warn('[DDT90] Couche IGN indisponible pour "' + themeId + '" (pas de fallback GeoJSON).');
        return;
      }
      if (!A._ignerr) { A._ignerr = {}; }
      if (!A._ignerr[themeId]) {
        A._ignerr[themeId] = true;
        console.warn('[DDT90] Couche IGN indisponible pour "' + themeId + '", bascule sur GeoJSON local.');
        A.carte.removeLayer(layer);
        delete A.couches[themeId];
        chargerCoucheGeoJSON(themeId, style);
      }
    });

    layer.on('click', function(e) { gererClicCarte(e.latlng.lat, e.latlng.lng); });
    return;
  }

  /* ── 2. Fallback GeoJSON local ─────────────────────────────────────── */
  chargerCoucheGeoJSON(themeId, style);
}

/**
 * Charge la couche GeoJSON locale (COUCHES_DATA) — fallback si IGN indisponible.
 */
function chargerCoucheGeoJSON(themeId, style) {
  var data = COUCHES_DATA[themeId];
  if (!data) return;

  A.couches[themeId] = L.geoJSON(data, {
    style: function(feature) {
      var geomType = feature.geometry.type;
      if (geomType === 'LineString' || geomType === 'MultiLineString') {
        return { color: style.color, weight: 2.5, opacity: .75 };
      }
      return {
        color: style.color, weight: 1.5, opacity: .7,
        fillColor: style.fill, fillOpacity: .18,
      };
    },
    pointToLayer: function(feature, latlng) {
      return L.circleMarker(latlng, {
        radius: 7, fillColor: style.fill, color: style.color,
        weight: 2, opacity: 1, fillOpacity: .85,
      });
    },
    onEachFeature: function(feature, layer) {
      if (feature.properties && feature.properties.nom) {
        layer.bindTooltip(
          '<b style="font-family:serif">' + feature.properties.nom + '</b>' +
          (feature.properties.type ? '<br/><small>' + feature.properties.type + '</small>' : ''),
          { className: 'commune-tooltip', sticky: true }
        );
      }
      layer.on('click',    function(e) { gererClicCarte(e.latlng.lat, e.latlng.lng); });
      layer.on('dblclick', function(e) { L.DomEvent.stopPropagation(e); gererDblClicCarte(e.latlng.lat, e.latlng.lng); });
    }
  }).addTo(A.carte);
}

/* Mise à jour de la légende en fonction des couches actives */
/**
 * Atténue ou masque les limites communes GeoJSON locales
 * quand une couche Géoplateforme IGN affiche déjà ses propres limites,
 */
/**
 * Masque le GeoJSON communes quand la couche Parcellaire Express (agriculture)
 * est active ET que le zoom est >= 13 (les tuiles IGN sont alors visibles).
 * Restaure le style par défaut dans tous les autres cas.
 */
function majOpaciteCommunesSelonCouches() {
  if (!A.layerCommunes) return;

  var zoom      = A.carte ? A.carte.getZoom() : 0;
  var rpgDef    = COUCHES_IGN['agriculture'];
  var rpgMin    = rpgDef ? (rpgDef.minZoom || 10) : 10;
  var cadastreDef = COUCHES_IGN['cadastre'];
  var cadastreMin = cadastreDef ? (cadastreDef.minZoom || 13) : 13;

  /* Couche cadastre visible (zoom >= 13) : masquer communes complètement
     (les tuiles PCI affichent déjà les limites parcellaires) */
  var cadastreVisible = A.couchesActives.has('cadastre') && zoom >= cadastreMin;

  /* Couche RPG agriculture active (à n'importe quel zoom) :
     garder l'outline communes mais masquer le fond pour éviter l'overlap
     avec les couleurs de cultures */
  var rpgActif = A.couchesActives.has('agriculture');

  if (cadastreVisible) {
    /* Cadastre visible : masquer complètement */
    A.layerCommunes.setStyle({
      color: '#002395', weight: 0, opacity: 0,
      fillColor: '#002395', fillOpacity: 0,
    });
  } else if (rpgActif) {
    /* RPG actif (peu importe le zoom) : conserver l'outline, pas de fond
       pour que les couleurs de cultures soient lisibles */
    A.layerCommunes.setStyle({
      color: '#002395', weight: 1, opacity: 0.45,
      fillColor: '#002395', fillOpacity: 0,
    });
  } else {
    /* Aucune couche IGN qui nécessite un ajustement */
    A.layerCommunes.setStyle(styleCommuneDefaut());
  }
}

/**
 * Met à jour la légende carte en fonction des couches actives.
 * Distingue couches WMTS Géoplateforme (symbole tuile) et GeoJSON locaux (symbole géom).
 * Indique le niveau de zoom minimum si la couche n'est pas encore visible.
 * Affiche la légende RPG détaillée si la couche agriculture est active.
 */
function majLegende() {
  var conteneur = document.getElementById('legende-couches');
  conteneur.innerHTML = '';

  if (A.couchesActives.size === 0) return;

  /* Séparateur entre les items fixes et les couches thématiques */
  var sep = document.createElement('div');
  sep.className = 'leg-sep';
  conteneur.appendChild(sep);

  /* Légende RPG détaillée si couche agriculture active */
  if (A.couchesActives.has('agriculture')) {
    var zoom = A.carte ? A.carte.getZoom() : 0;
    var rpgDef = COUCHES_IGN['agriculture'];
    var rpgMin = rpgDef ? (rpgDef.minZoom || 10) : 10;

    var rpgEl = document.createElement('div');
    rpgEl.className = 'leg-rpg-block';

    if (zoom < rpgMin) {
      /* Pas encore visible : afficher badge zoom cliquable */
      rpgEl.innerHTML =
        '<div class="leg-section">RPG 2024 — Cultures PAC' +
          ' <span class="leg-ign-badge">IGN</span>' +
          ' <span class="leg-zoom-warn" style="cursor:pointer;" title="Cliquer pour zoomer">&#x1F50D; Zoom ' + rpgMin + '+</span>' +
        '</div>';
      var warnBadge = rpgEl.querySelector('.leg-zoom-warn');
      if (warnBadge) {
        warnBadge.addEventListener('click', function(e) {
          e.stopPropagation();
          A.carte.setZoom(rpgMin);
        });
      }
    } else {
      /* Visible : afficher la légende couleurs cultures */
      var cultures = [
        { c: '#ffffb2', l: 'Blé tendre' },
        { c: '#31a354', l: 'Maïs grain et ensilage' },
        { c: '#addd8e', l: 'Orge' },
        { c: '#f7fcb9', l: 'Autres céréales' },
        { c: '#ffeda0', l: 'Colza' },
        { c: '#feb24c', l: 'Tournesol' },
        { c: '#fd8d3c', l: 'Autre oléagineux' },
        { c: '#fc4e2a', l: 'Protéagineux' },
        { c: '#8c510a', l: 'Plantes à fibres' },
        { c: '#bf812d', l: 'Semences' },
        { c: '#c6dbef', l: 'Gel (surface gelée)' },
        { c: '#9ecae1', l: 'Gel industriel' },
        { c: '#deebf7', l: 'Autres gels' },
        { c: '#e0ecf4', l: 'Riz' },
        { c: '#f768a1', l: 'Légumineuses à grains' },
        { c: '#74c476', l: 'Fourrage' },
        { c: '#a1d99b', l: 'Estives et landes' },
        { c: '#c7e9c0', l: 'Prairies permanentes' },
        { c: '#e5f5e0', l: 'Prairies temporaires' },
        { c: '#d73027', l: 'Vergers' },
        { c: '#e377c2', l: 'Vignes' },
        { c: '#2ca02c', l: 'Fruit à coque' },
        { c: '#bcbd22', l: 'Oliviers' },
        { c: '#17becf', l: 'Autres cultures industrielles' },
        { c: '#ff9896', l: 'Légumes ou fleurs' },
        { c: '#1f77b4', l: 'Canne à sucre' },
        { c: '#98df8a', l: 'Arboriculture' },
        { c: '#aec7e8', l: 'Divers' },
        { c: '#d9d9d9', l: 'Non disponible' },
      ];
      var rows = cultures.map(function(cu) {
        return '<div class="leg-rpg-row">' +
          '<div class="leg-rpg-color" style="background:' + cu.c + ';"></div>' +
          '<span class="leg-label">' + cu.l + '</span>' +
          '</div>';
      }).join('');

      rpgEl.innerHTML =
        '<div class="leg-section">RPG 2024 — Cultures PAC' +
          ' <span class="leg-ign-badge">IGN</span>' +
        '</div>' +
        '<div class="leg-rpg-list">' + rows + '</div>';
    }

    /* Clic sur le bloc (hors badge zoom) → désactiver la couche */
    rpgEl.title = 'Cliquer pour désactiver';
    rpgEl.style.cursor = 'pointer';
    rpgEl.addEventListener('click', function() {
      var btn = document.querySelector('.layer-toggle[data-id="agriculture"]');
      if (btn) toggleCouche('agriculture', btn);
    });

    conteneur.appendChild(rpgEl);
  }

  var zoomActuel = A.carte ? A.carte.getZoom() : 12;

  A.couchesActives.forEach(function(themeId) {
    var style  = COUCHE_STYLES[themeId];
    if (!style) return;
    var igndef = COUCHES_IGN[themeId];

    var item = document.createElement('div');
    item.className = 'leg-item';

    /* Symbole selon le type de source */
    var symbole;
    if (igndef && igndef.layer) {
      /* Couche Géoplateforme IGN — icône tuile */
      symbole = '<div class="leg-ign-tile" style="border-color:' + style.swatch + ';">'
              + '<div class="leg-ign-inner" style="background:' + style.swatch + ';opacity:.35;"></div>'
              + '</div>';
    } else {
      /* GeoJSON local — barre de couleur */
      symbole = '<div class="leg-color" style="background:' + style.swatch + ';"></div>';
    }

    /* Avertissement zoom si couche non visible au zoom actuel */
    var hasZoomWarn = igndef && igndef.minZoom && zoomActuel < igndef.minZoom;
    var zMin = hasZoomWarn ? igndef.minZoom : 0;
    var zoomWarn = hasZoomWarn
      ? ' <span class="leg-zoom-warn" data-minzoom="' + zMin + '" title="Cliquer pour zoomer au niveau ' + zMin + '" style="cursor:pointer;">'
        + '&#x1F50D; Zoom ' + zMin + '+</span>'
      : '';

    /* Badge IGN */
    var badge = igndef
      ? ' <span class="leg-ign-badge">IGN</span>'
      : '';

    item.innerHTML = symbole
      + '<span class="leg-label">' + style.label + badge + zoomWarn + '</span>';

    /* Clic sur le badge zoom → zoomer (stoppe la propagation vers l'item parent) */
    if (hasZoomWarn) {
      var warnEl = item.querySelector('.leg-zoom-warn');
      if (warnEl) {
        warnEl.addEventListener('click', function(e) {
          e.stopPropagation();
          A.carte.setZoom(zMin);
        });
      }
    }

    /* Clic sur l'item (hors badge zoom) → désactiver la couche */
    item.title = 'Cliquer pour désactiver';
    item.style.cursor = 'pointer';
    item.addEventListener('click', function() {
      var btn = document.querySelector('.layer-toggle[data-id="' + themeId + '"]');
      if (btn) toggleCouche(themeId, btn);
    });

    conteneur.appendChild(item);
  });
}

/* ── SUPERFICIE — calcul ha + cercle proportionnel sur la carte ────────────── */

function majSuperficie() {
  var val   = parseFloat(document.getElementById('inp-sup').value);
  var unite = document.getElementById('sel-unite').value;
  var chip  = document.getElementById('sup-chip');

  if (isNaN(val) || val <= 0) {
    A.superficieHa = null;
    chip.classList.remove('on');
    return;
  }

  /* Conversion en hectares */
  A.superficieHa = unite === 'ha' ? val : (unite === 'm2' ? val / 10000 : val * 100);

  document.getElementById('sup-chip-txt').textContent = A.superficieHa < 1
    ? (A.superficieHa * 10000).toFixed(0) + '\u00a0m\u00B2 (' + A.superficieHa.toFixed(4) + '\u00a0ha)'
    : A.superficieHa.toFixed(2) + '\u00a0ha';
  chip.classList.add('on');

  /* Suggestion automatique de la taille réglementaire */
  majTaille(A.superficieHa >= 20 ? 4 : A.superficieHa >= 5 ? 3 : A.superficieHa >= 0.5 ? 2 : 1);

  /* Actualiser le cercle si le projet est déjà placé */
  if (A.position) placerProjet(A.position.lat, A.position.lng);
}

/* ── PANNEAU GAUCHE — boutons types, taille, badges thèmes ─────────────────── */

function genBoutons() {
  var grille = document.getElementById('grille-types');
  grille.innerHTML = '';
  TYPES.forEach(function(type) {
    var btn = document.createElement('button');
    btn.className    = 'btn-type';
    btn.dataset.type = type.id;
    btn.innerHTML    = '<span class="ico">' + type.ico + '</span>' + type.label;
    btn.addEventListener('click', function(){ selType(btn); });
    grille.appendChild(btn);
  });
}

function selType(btn) {
  document.querySelectorAll('.btn-type').forEach(function(b){ b.classList.remove('actif'); });
  btn.classList.add('actif');
  A.typeProjet = btn.dataset.type;
  var t = TYPES.find(function(x){ return x.id === A.typeProjet; });
  if (t) {
    document.getElementById('hdr-badge-txt').innerHTML = t.ico + '&nbsp;' + t.label;
    document.getElementById('hdr-badge').style.display = 'flex';
  }
  /* Réinitialiser le sous-type */
  A.sousType = null;
  document.getElementById('stype-desc').classList.remove('on');
  afficherSousTypes(A.typeProjet);
}

function majTaille(val) {
  A.taille = parseInt(val);
  var t = TAILLES[A.taille];
  document.getElementById('taille-nom').textContent  = t.nom;
  document.getElementById('taille-desc').textContent = t.desc;
  document.getElementById('slider-taille').value = A.taille;
}

function genBadgesThemes() {
  var grille = document.getElementById('grille-themes');
  grille.innerHTML = '';
  THEMES.forEach(function(theme) {
    var b = document.createElement('div');
    b.className  = 'badge-theme ' + theme.classe + ' actif';
    b.dataset.id = theme.id;
    b.innerHTML  = theme.icone + ' ' + theme.label;
    b.addEventListener('click', function() {
      if (A.themesActifs.has(theme.id)) {
        A.themesActifs.delete(theme.id);
        b.classList.replace('actif', 'inactif');
      } else {
        A.themesActifs.add(theme.id);
        b.classList.replace('inactif', 'actif');
      }
    });
    grille.appendChild(b);
  });
}

/* ── ENJEUX — rendu des 4 accordéons thématiques + AXES_META ───────────────── */

/* Méta constante des 4 axes (couleurs, icônes, labels) */
/* ══════════════════════════════════════════════════════════════════════════════
   NOUVEAU SYSTÈME D'ENJEUX — 5 catégories de la mindmap DDT 90
   Remplace les 4 axes environnement/économique/politique/social
   ══════════════════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════════════════════
   BASE DE DONNÉES ENJEUX — structurée par catégorie mindmap
   Chaque enjeu possède : id, nom, ico, niv (eleve/moyen/faible),
   tmin (1-4), types (null=tous), zones_requises (null=toujours),
   et les sous-éléments de la mindmap par catégorie
   ══════════════════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════════════════════
   RENDU DES ACCORDÉONS — 5 catégories mindmap
   Remplace rendreAccordeons (4 axes) par rendreAccordeonsMindmap
   ══════════════════════════════════════════════════════════════════════════════ */

function rendreAccordeons(filtres, conteneur) {
  /* Les enjeux ENJEUX_MINDMAP du type de projet */
  var enjeuxMindmap = (ENJEUX_MINDMAP[A.typeProjet] || []).filter(function(e) {
    return e.tmin <= A.taille;
  });

  /* Fusionner avec les enjeux contextuels (filtres sans contexte_zone) qui ont
     des axes mindmap — on les intègre dans les catégories correspondantes */

  var axeIds = ['economique', 'cartographie', 'social', 'environnemental', 'politique', 'prevention'];
  var niveaux = { eleve: 'Élevé', moyen: 'Moyen', faible: 'Faible' };

  axeIds.forEach(function(axeId) {
    if (A.themesActifs && A.themesActifs.size > 0) {
      /* Mapping ancien → nouveau pour la compatibilité avec le filtre thèmes */
      var mappingThemes = {
        economique:      'economique',
        cartographie:    'environnement',
        social:          'social',
        environnemental: 'environnement',
        politique:       'politique',
        prevention:      'social',
      };
      var ancienAxe = mappingThemes[axeId];
      if (ancienAxe && !A.themesActifs.has(ancienAxe)) return;
    }

    var meta = AXES_META[axeId];

    /* Collecter les items ayant des données pour cet axe */
    var items = [];

    /* 1. Enjeux mindmap du type de projet */
    enjeuxMindmap.forEach(function(enjeu) {
      var axe = enjeu.axes && enjeu.axes[axeId];
      if (!axe) return;
      items.push({ enjeu: enjeu, axe: axe, source: 'mindmap' });
    });

    /* 2. Enjeux du filtre standard (ENJEUX[typeProjet]) qui ont cet axe */
    filtres.forEach(function(enjeu) {
      if (enjeu.contexte_zone || enjeu._agri_ctx || enjeu._transport_ctx) return;
      /* Mappage des anciens axes vers les nouvelles catégories */
      var ancienAxeId = axeId === 'environnemental' ? 'environnement' : axeId;
      var axe = enjeu.axes && enjeu.axes[ancienAxeId];
      if (!axe) return;
      /* Éviter les doublons avec les enjeux mindmap */
      var dejaDans = items.some(function(it){ return it.enjeu.id === enjeu.id; });
      if (dejaDans) return;
      items.push({ enjeu: enjeu, axe: axe, source: 'standard' });
    });

    if (items.length === 0) return;

    /* Tri élevé → moyen → faible */
    var ordNiv = { eleve: 0, moyen: 1, faible: 2 };
    items.sort(function(a, b) {
      var oa = ordNiv[a.enjeu.niv] !== undefined ? ordNiv[a.enjeu.niv] : 2;
      var ob = ordNiv[b.enjeu.niv] !== undefined ? ordNiv[b.enjeu.niv] : 2;
      return oa - ob;
    });

    /* Wrapper accordéon */
    var accord = document.createElement('div');
    accord.className = 'accord-wrap';
    accord.dataset.axe = axeId;

    /* Bouton header */
    var btn = document.createElement('button');
    btn.className = 'accord-btn';
    btn.style.setProperty('--axe-color', meta.color);
    btn.style.setProperty('--axe-border', meta.border);
    btn.innerHTML =
      '<span class="accord-ico">' + meta.ico + '</span>' +
      '<span class="accord-label">' + meta.label + '</span>' +
      '<span class="accord-count">' + items.length + ' sujet' + (items.length > 1 ? 's' : '') + '</span>' +
      '<span class="accord-chev">&#x25BC;</span>';

    /* Corps */
    var body = document.createElement('div');
    body.className = 'accord-body';

    items.forEach(function(item) {
      var enjeu = item.enjeu;
      var axe   = item.axe;

      var fiche = document.createElement('div');
      fiche.className = 'axe-fiche';

      var ficheHead = document.createElement('div');
      ficheHead.className = 'axe-fiche-head';
      ficheHead.innerHTML =
        '<span class="axe-fiche-ico">' + (enjeu.ico || '⚠') + '</span>' +
        '<span class="axe-fiche-nom">' + enjeu.nom + '</span>' +
        '<span class="niv-badge n-' + enjeu.niv + '">' + (niveaux[enjeu.niv] || enjeu.niv) + '</span>' +
        '<span class="axe-fiche-chev">&#x25BA;</span>';

      var ficheBody = document.createElement('div');
      ficheBody.className = 'axe-fiche-body';

      /* Éléments de la mindmap */
      if (axe.elements && axe.elements.length) {
        var elHtml = axe.elements.map(function(el) {
          return '<li><span class="axe-bullet">◆</span>' + el + '</li>';
        }).join('');
        ficheBody.innerHTML +=
          '<div class="fiche-section mindmap-elements">' +
            '<div class="fiche-section-titre">Éléments clés</div>' +
            '<ul class="axe-list">' + elHtml + '</ul>' +
          '</div>';
      }

      /* Facteurs */
      if (axe.facteurs && axe.facteurs.length) {
        var fHtml = axe.facteurs.map(function(f) {
          return '<li><span class="axe-bullet">•</span>' + f + '</li>';
        }).join('');
        ficheBody.innerHTML +=
          '<div class="fiche-section">' +
            '<div class="fiche-section-titre">Facteurs</div>' +
            '<ul class="axe-list">' + fHtml + '</ul>' +
          '</div>';
      }

      /* Conséquences */
      if (axe.consequences && axe.consequences.length) {
        var cHtml = axe.consequences.map(function(c) {
          return '<li><span class="axe-bullet axe-bullet-arrow">→</span>' + c + '</li>';
        }).join('');
        ficheBody.innerHTML +=
          '<div class="fiche-section">' +
            '<div class="fiche-section-titre cons">Conséquences</div>' +
            '<ul class="axe-list">' + cHtml + '</ul>' +
          '</div>';
      }

      /* Actions */
      if (axe.actions && axe.actions.length) {
        var aHtml = axe.actions.map(function(a) {
          return '<li><span class="axe-bullet action-bullet">✓</span>' + a + '</li>';
        }).join('');
        ficheBody.innerHTML +=
          '<div class="fiche-section actions">' +
            '<div class="fiche-section-titre action">Actions recommandées</div>' +
            '<ul class="axe-list">' + aHtml + '</ul>' +
          '</div>';
      }

      /* Refs Atlas */
      if (enjeu.refs && enjeu.refs.length) {
        var refsHtml = enjeu.refs.map(function(r) {
          return '<span class="enjeu-lien" data-id="' + enjeu.id + '">🗺 ' + r.n + ' — ' + r.t + '</span>';
        }).join('');
        ficheBody.innerHTML += '<div class="enjeu-liens" style="margin-top:8px;">' + refsHtml + '</div>';
      }

      ficheHead.addEventListener('click', function() {
        fiche.classList.toggle('ouvert');
      });

      /* Clic sur lien Atlas */
      ficheBody.querySelectorAll && setTimeout(function() {
        ficheBody.querySelectorAll('.enjeu-lien').forEach(function(lien) {
          lien.addEventListener('click', function() {
            var atlasId = lien.dataset.id;
            ouvrirModale && ouvrirModale(atlasId);
          });
        });
      }, 0);

      fiche.appendChild(ficheHead);
      fiche.appendChild(ficheBody);
      body.appendChild(fiche);
    });

    btn.addEventListener('click', function() {
      accord.classList.toggle('ouvert');
    });

    accord.appendChild(btn);
    accord.appendChild(body);
    conteneur.appendChild(accord);
  });
}

/* ── MODALE — fiche détaillée d'un enjeu (axes, actions, références) ──────── */

function ouvrirModale(id) {
  var enjeu = null;
  var listes = Object.values(ENJEUX);
  for (var i = 0; i < listes.length; i++) {
    var f = listes[i].find(function(x){ return x.id === id; });
    if (f) { enjeu = f; break; }
  }
  if (!enjeu) return;

  document.getElementById('modale-titre').textContent = enjeu.nom;
  var refsStr = (enjeu.refs || []).map(function(r){ return r.n + ' — ' + r.t; }).join(', ');
  document.getElementById('modale-ref').textContent = refsStr;

  /* Build detailed modal from 4-axes structure */
  var AXES_META = {
    environnement: { label:'Environnement', ico:'&#x1F333;', color:'#15803d' },
    economique:    { label:'Economique',    ico:'&#x1F4B0;', color:'#7c3aed' },
    politique:     { label:'Politique',     ico:'&#x1F3DB;', color:'#92400e' },
    social:        { label:'Social',        ico:'&#x1F465;', color:'#be123c' },
  };

  var html = '';
  Object.keys(AXES_META).forEach(function(axeId) {
    var meta = AXES_META[axeId];
    var axe  = enjeu.axes && enjeu.axes[axeId];
    if (!axe) return;
    html += '<h3>' + meta.ico + ' ' + meta.label + '</h3>';
    html += '<strong style="font-size:.78rem;color:#555;">Facteurs :</strong><ul>';
    (axe.facteurs||[]).forEach(function(f){ html += '<li>' + f + '</li>'; });
    html += '</ul><strong style="font-size:.78rem;color:#555;">Conséquences :</strong><ul>';
    (axe.consequences||[]).forEach(function(c){ html += '<li>' + c + '</li>'; });
    html += '</ul>';
  });

  if (enjeu.actions && enjeu.actions.length) {
    html += '<h3>&#x1F4CB; Actions recommandées</h3><ul>';
    enjeu.actions.forEach(function(a){ html += '<li>' + a + '</li>'; });
    html += '</ul>';
  }

  document.getElementById('modale-corps').innerHTML = html;
  document.getElementById('modale-bg').classList.add('on');
}

function fermerModale(evt, force) {
  if (force || (evt && evt.target.id === 'modale-bg')) {
    document.getElementById('modale-bg').classList.remove('on');
  }
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') fermerModale(null, true);
});

/* ── CONTACTS_DB — 8 groupes, ~24 contacts DDT 90 et partenaires
   { id, nom, role, tel, email, url, types[], zones[], priorite }     */


/* ── CONTACTS — logique d'affichage, filtrage par type/zone/EPCI ───────────── */

/* Etat du panneau contacts */
var contactsOuverts = false;

/* Affiche la section contacts apres une analyse */
function afficherContacts() {
  var section = document.getElementById('section-contacts');
  section.style.display = 'block';
  /* Re-generer le contenu a chaque analyse */
  genererContacts();
}

/* Ouvre / ferme le panneau depliable */
function toggleContacts() {
  contactsOuverts = !contactsOuverts;
  var panel   = document.getElementById('contacts-panel');
  var trigger = document.getElementById('contacts-trigger');
  var chev    = document.getElementById('contacts-chev');

  if (contactsOuverts) {
    panel.classList.remove('contacts-hidden');
    panel.classList.add('contacts-visible');
    trigger.classList.add('ouvert');
  } else {
    /* Fixer la hauteur courante avant animation de fermeture */
    panel.style.maxHeight = panel.scrollHeight + 'px';
    panel.style.transition = 'max-height .32s ease, opacity .25s ease';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        panel.style.maxHeight = '0';
        panel.style.opacity   = '0';
      });
    });
    panel.addEventListener('transitionend', function onEnd() {
      panel.removeEventListener('transitionend', onEnd);
      panel.classList.remove('contacts-visible');
      panel.classList.add('contacts-hidden');
      panel.style.maxHeight  = '';
      panel.style.opacity    = '';
      panel.style.transition = '';
    });
    trigger.classList.remove('ouvert');
  }
}

/* Genere la liste des contacts filtres selon le projet courant */
function detecterCommuneProjet() {
  /* Retourne { nom, code, codeEpci, population, codesPostaux }
     pour la commune contenant le marqueur du projet, ou null. */
  if (!A.position) return null;
  var lat = A.position.lat, lng = A.position.lng;
  var features = GEOJSON_TB && GEOJSON_TB.features;
  if (!features) return null;
  for (var i = 0; i < features.length; i++) {
    var feat = features[i];
    if (!feat.geometry || feat.geometry.type !== 'Polygon') continue;
    if (pointDansPolygone(lat, lng, feat.geometry.coordinates)) {
      return feat.properties;
    }
  }
  return null;
}

function getEpciInfo(codeEpci) {
  var epciMap = {
    '200069052': {
      id: 'gbca',
      nom: 'Grand Belfort Communaute d\'Agglomeration (GBCA)',
      tel: '03 84 90 72 00',
      email: 'contact@grandbelfort.fr',
      adresse: '1 rue Georges Pompidou, BP 10 649, 90020 Belfort Cedex',
      web: 'https://www.grandbelfort.fr',
      note: 'Votre projet est situe dans l\'une des 50 communes de GBCA. Interlocuteur pour l\'urbanisme (PLU), l\'economie et l\'habitat.'
    },
    '200069060': {
      id: 'ccvs',
      nom: 'Communaute de Communes des Vosges du Sud (CCVS)',
      tel: '03 84 29 14 00',
      email: '[À compléter]@vosges-du-sud.fr',
      adresse: '4 rue de l\'Hotel de Ville, 90200 Giromagny',
      web: 'https://www.ccvosgesdu-sud.fr',
      note: 'Votre projet est dans le perimetre de la CCVS (22 communes). PLUi en cours d\'elaboration — contacter pour verifier les implications sur le zonage futur.'
    },
    '249000241': {
      id: 'ccst',
      nom: 'Communaute de Communes du Sud Territoire (CCST)',
      tel: '03 84 36 21 35',
      email: '[À compléter]@sudterritoire.fr',
      adresse: '1 place de la Republique, 90100 Delle',
      web: '[À compléter]',
      note: 'Votre projet est dans le perimetre de la CCST. Zone transfrontaliere (proximite Suisse). Programme agroecologique "L\'Eau d\'Ici".'
    }
  };
  return epciMap[codeEpci] || null;
}

function genererContacts() {
  var type   = A.typeProjet;
  var taille = A.taille;

  /* ── 1. Détecter commune + EPCI depuis la position ── */
  var commune  = detecterCommuneProjet();
  var epciInfo = commune ? getEpciInfo(commune.codeEpci) : null;

  /* ── 2. Récupérer les zones actives (issues de l'analyse) ── */
  var zonesActives = new Set();
  if (A.position) {
    var zonesRes = detecterZones(A.position.lat, A.position.lng, type);
    zonesRes.forEach(function(res) {
      res.zones.forEach(function(z) { zonesActives.add(z.type); });
    });
  }

  /* ── 3. Contexte du projet ── */
  var ctxEl   = document.getElementById('contacts-ctx');
  var typeInfo = TYPES.find(function(t){ return t.id === type; });
  var chips   = [];
  if (typeInfo) chips.push(typeInfo.ico + ' ' + typeInfo.label);
  chips.push(TAILLES[taille].nom);
  if (commune) chips.push('📍 ' + commune.nom + (commune.codesPostaux && commune.codesPostaux.length ? ' (' + commune.codesPostaux[0] + ')' : ''));
  else if (A.position) chips.push('📍 Lat ' + A.position.lat.toFixed(3) + ', Lng ' + A.position.lng.toFixed(3));

  ctxEl.innerHTML = '<span style="color:var(--rf-mid);font-weight:600;font-size:.72rem;margin-right:4px;">Projet :</span>' +
    chips.map(function(c){
      return '<span class="ctx-chip">' + c + '</span>';
    }).join('');

  /* ── 4. Construire la liste de contacts dynamiques ── */
  var liste = document.getElementById('contacts-liste');
  liste.innerHTML = '';
  var totalAffiche = 0;

  /* ── Groupe 0 : ACTEURS LOCAUX (mairie + EPCI) ── */
  var contactsLocaux = [];

  /* Mairie de la commune détectée */
  if (commune) {
    var cp = (commune.codesPostaux && commune.codesPostaux.length) ? commune.codesPostaux[0] : '90000';
    contactsLocaux.push({
      id:       'mairie-' + commune.code,
      nom:      'Mairie de ' + commune.nom,
      role:     'Premier interlocuteur pour tout projet de construction. Instruction des permis de construire (PC), déclarations préalables (DP) et certificats d\'urbanisme (CU). Consultation du PLU applicable.',
      priorite: 'obligatoire',
      types:    [type],
      tmin:     1,
      tel:      '[Consulter pagesjaunes.fr]',
      email:    '[Consulter le site de la commune]',
      adresse:  'Mairie de ' + commune.nom + ', ' + cp + ' ' + commune.nom,
      web:      '[Consulter annuaire.service-public.fr]',
      horaires: '[Variable selon la commune — vérifier en mairie]',
      note:     'Commune de ' + commune.nom + ' (' + (commune.population || '?') + ' hab.) — ' +
                'Consultez d\'abord la mairie pour vérifier le zonage PLU et les règles locales d\'urbanisme avant tout dépôt.'
    });
  }

  /* EPCI compétent */
  if (epciInfo) {
    contactsLocaux.push({
      id:       epciInfo.id + '-local',
      nom:      epciInfo.nom,
      role:     'Intercommunalité compétente pour votre secteur : urbanisme (PLU/PLUi), développement économique, habitat, transports, environnement.',
      priorite: 'obligatoire',
      types:    [type],
      tmin:     1,
      tel:      epciInfo.tel,
      email:    epciInfo.email,
      adresse:  epciInfo.adresse,
      web:      epciInfo.web,
      horaires: 'Lun-Ven 8h30-12h00 / 13h30-17h00',
      note:     epciInfo.note
    });
  }

  if (contactsLocaux.length > 0) {
    var groupeLocal = document.createElement('div');
    groupeLocal.className = 'contact-groupe';
    groupeLocal.innerHTML =
      '<div class="contact-groupe-titre">' +
        '<span class="groupe-ico">📍</span>' +
        'Acteurs locaux — ' + (commune ? commune.nom : 'Commune détectée') +
      '</div>';
    contactsLocaux.forEach(function(c) { groupeLocal.appendChild(creerCarteContact(c)); });
    liste.appendChild(groupeLocal);
    totalAffiche += contactsLocaux.length;
  }

  /* ── Groupes CONTACTS_DB avec filtrage zone-aware ── */
  /* Règles de pertinence par contact ID en fonction des zones actives */
  var CONTACT_ZONES_REQUISES = {
    'udap90':       ['MH_classe','MH_inscrit','perimetre_MH','zppa','site_archeo'],
    'ars':          ['captage_aep','radon','moustique','bruit_1','trafic_fort'],
    'onf':          ['foret','feux_foret','reservoir','natura2000'],
    'agence-eau':   ['zone_humide','cours_eau','sage','captage_aep','nitrates'],
    'atmo':         ['bruit_1','trafic_fort'],
    'chambre-agri': ['nitrates','zone_humide','captage_aep','region_agri','bio','agroecologie','siqo_aop','circuit_court'],
    'safer':        null, /* toujours si type agriculture */
  };

  /* IDs déjà injectés en local (ne pas dupliquer) */
  var dejaAffiche = new Set(epciInfo ? [epciInfo.id] : []);

  Object.keys(CONTACTS_DB).forEach(function(groupeId) {
    var groupe = CONTACTS_DB[groupeId];

    var contactsFiltres = groupe.contacts.filter(function(c) {
      /* Déduplication : pas de doublon avec acteurs locaux */
      if (dejaAffiche.has(c.id)) return false;

      /* Filtre type + envergure */
      if (c.types.indexOf(type) === -1) return false;
      if (c.tmin > taille) return false;

      /* Filtre zones-aware : certains contacts ne sont pertinents
         que si une zone spécifique est détectée */
      var zonesReq = CONTACT_ZONES_REQUISES[c.id];
      if (zonesReq === undefined) return true; /* pas de contrainte zone */
      if (zonesReq === null) return true;       /* toujours si type ok */
      /* Afficher seulement si au moins une zone requise est active */
      return zonesReq.some(function(z) { return zonesActives.has(z); });
    });

    if (contactsFiltres.length === 0) return;
    totalAffiche += contactsFiltres.length;

    /* Trier : obligatoire > recommande > optionnel */
    var prioOrd = { obligatoire: 0, recommande: 1, optionnel: 2 };
    contactsFiltres.sort(function(a, b){ return prioOrd[a.priorite] - prioOrd[b.priorite]; });

    var groupeEl = document.createElement('div');
    groupeEl.className = 'contact-groupe';
    groupeEl.innerHTML =
      '<div class="contact-groupe-titre">' +
        '<span class="groupe-ico">' + groupe.ico + '</span>' +
        groupe.label +
      '</div>';

    contactsFiltres.forEach(function(c) { groupeEl.appendChild(creerCarteContact(c)); });
    liste.appendChild(groupeEl);
  });

  /* Message si aucun contact */
  if (totalAffiche === 0) {
    liste.innerHTML =
      '<div class="contacts-vide">' +
        '&#x1F50D; Aucun contact specifique identifie pour ce type de projet.<br/>' +
        'Contactez directement la DDT 90 au 03 84 58 86 00.' +
      '</div>';
  }
}

/* Cree une carte contact individuelle */
function creerCarteContact(c) {
  var prioBadge = {
    obligatoire: '<span class="contact-priorite prio-obligatoire">Obligatoire</span>',
    recommande:  '<span class="contact-priorite prio-recommande">Recommande</span>',
    optionnel:   '<span class="contact-priorite prio-optionnel">Optionnel</span>',
  };

  /* Coordonnees */
  var coords = [];
  if (c.tel) {
    var telHref = c.tel.startsWith('[') ? '#' : 'tel:' + c.tel.replace(/\s/g,'');
    var telClass = c.tel.startsWith('[') ? 'contact-placeholder' : 'contact-lien';
    coords.push(
      '<div class="contact-ligne">' +
        '<span class="c-ico">&#x1F4DE;</span>' +
        '<a class="' + telClass + '" href="' + telHref + '">' + c.tel + '</a>' +
      '</div>'
    );
  }
  if (c.email) {
    var emailHref  = c.email.startsWith('[') ? '#' : 'mailto:' + c.email;
    var emailClass = c.email.startsWith('[') ? 'contact-placeholder' : 'contact-lien';
    coords.push(
      '<div class="contact-ligne">' +
        '<span class="c-ico">&#x2709;</span>' +
        '<a class="' + emailClass + '" href="' + emailHref + '">' + c.email + '</a>' +
      '</div>'
    );
  }
  if (c.adresse) {
    var adresseClass = c.adresse.startsWith('[') ? 'contact-placeholder' : '';
    coords.push(
      '<div class="contact-ligne">' +
        '<span class="c-ico">&#x1F4CD;</span>' +
        '<span class="' + adresseClass + '">' + c.adresse + '</span>' +
      '</div>'
    );
  }
  if (c.horaires) {
    var horClass = c.horaires.startsWith('[') ? 'contact-placeholder' : '';
    coords.push(
      '<div class="contact-ligne">' +
        '<span class="c-ico">&#x1F552;</span>' +
        '<span class="' + horClass + '">' + c.horaires + '</span>' +
      '</div>'
    );
  }

  /* Boutons d\'action */
  var actions = [];
  if (c.tel && !c.tel.startsWith('[')) {
    actions.push(
      '<a class="btn-contact-action btn-appel" href="tel:' + c.tel.replace(/\s/g,'') + '">' +
        '&#x1F4DE; Appeler' +
      '</a>'
    );
  }
  if (c.email && !c.email.startsWith('[')) {
    actions.push(
      '<a class="btn-contact-action btn-email" href="mailto:' + c.email + '">' +
        '&#x2709; Email' +
      '</a>'
    );
  }
  if (c.web && !c.web.startsWith('[')) {
    actions.push(
      '<a class="btn-contact-action btn-web" href="' + c.web + '" target="_blank" rel="noopener">' +
        '&#x1F517; Site web' +
      '</a>'
    );
  }

  /* Note contextuelle */
  var noteHtml = c.note
    ? '<div style="margin-top:8px;font-size:.72rem;color:var(--ink-3);background:var(--bg);border-radius:var(--r-sm);padding:6px 9px;line-height:1.5;border-left:2px solid var(--border-2);">' +
        '&#x2139; ' + c.note +
      '</div>'
    : '';

  var div = document.createElement('div');
  div.className = 'contact-card';
  div.innerHTML =
    prioBadge[c.priorite] +
    '<div class="contact-nom">' + c.nom + '</div>' +
    '<div class="contact-role">' + c.role + '</div>' +
    '<div class="contact-coords">' + coords.join('') + '</div>' +
    (actions.length ? '<div class="contact-actions">' + actions.join('') + '</div>' : '') +
    noteHtml;

  return div;
}

/* ── SOUS-TYPES UI — affichage boutons + sélection ──────────────────────────── */

/* Etat */
A.sousType = null;

/* Affiche le menu secondaire après sélection d'un type */
function afficherSousTypes(typeId) {
  var wrap   = document.getElementById('sous-types-wrap');
  var grille = document.getElementById('grille-sous-types');
  var desc   = document.getElementById('stype-desc');
  var sousTypesListe = SOUS_TYPES[typeId];

  if (!sousTypesListe || sousTypesListe.length === 0) {
    wrap.classList.remove('visible');
    A.sousType = null;
    return;
  }

  grille.innerHTML = '';
  desc.classList.remove('on');
  A.sousType = null;

  sousTypesListe.forEach(function(st) {
    var btn = document.createElement('button');
    btn.className    = 'btn-stype';
    btn.dataset.id   = st.id;
    btn.innerHTML    =
      '<span class="sico">' + st.ico + '</span>' +
      '<span class="stxt">' + st.label +
      '</span>';
    btn.addEventListener('click', function() { selSousType(btn, st); });
    grille.appendChild(btn);
  });

  wrap.classList.add('visible');
}

/* Sélectionne un type */
function selSousType(btn, st) {
  document.querySelectorAll('.btn-stype').forEach(function(b){ b.classList.remove('actif'); });
  btn.classList.add('actif');
  A.sousType = st.id;

  var desc = document.getElementById('stype-desc');
  desc.textContent = st.desc;
  desc.classList.add('on');

  /* Mise à jour du badge header */
  var badge = document.getElementById('hdr-badge-txt');
  var typeInfo = TYPES.find(function(t){ return t.id === A.typeProjet; });
  if (typeInfo) {
    badge.innerHTML = typeInfo.ico + '&nbsp;' + typeInfo.label + '&nbsp;<span style="opacity:.7;font-weight:400">›</span>&nbsp;' + st.label;
  }
}

/* Patch selType pour afficher les sous-types */

/* ── CHECKLIST UI — génération, progression, items, reset ──────────────────── */

var checklistOuverte = false;
var checklistEtats   = {};  /* { itemId: 'done' | 'expanded' | '' } */

/* Affiche la section checklist après analyse */
function afficherChecklist() {
  var section = document.getElementById('section-checklist');
  section.style.display = 'block';
  genererChecklist();
}

/* Toggle ouverture */
function toggleChecklist() {
  checklistOuverte = !checklistOuverte;
  var panel   = document.getElementById('checklist-panel');
  var trigger = document.getElementById('checklist-trigger');

  if (checklistOuverte) {
    panel.classList.remove('cl-hidden');
    panel.classList.add('cl-visible');
    trigger.classList.add('ouvert');
  } else {
    panel.classList.remove('cl-visible');
    panel.classList.add('cl-hidden');
    trigger.classList.remove('ouvert');
  }
}

/* Génère la checklist selon le sous-type courant (ou _default) */
function genererChecklist() {
  var clKey   = A.sousType || '_default';
  var etapes  = (CHECKLISTS[clKey] || CHECKLISTS['_default']).slice();

  /* ── Items agricoles contextuels ── */
  if (A.typeProjet === 'agriculture' && A._zonesAgri && A._zonesAgri.length > 0) {
    var agriItems = checklistAgricoleContextuelle(A._zonesAgri);
    agriItems.forEach(function(item) {
      if (!etapes.some(function(e){ return e.id === item.id; })) {
        etapes.unshift(item);
      }
    });
  }
  var ctxEl   = document.getElementById('checklist-ctx');
  var bodyEl  = document.getElementById('checklist-body');

  /* ── Contexte projet ── */
  var typeInfo = TYPES.find(function(t){ return t.id === A.typeProjet; });
  var stList   = SOUS_TYPES[A.typeProjet] || [];
  var stInfo   = stList.find(function(s){ return s.id === A.sousType; });

  /* ── Localisation depuis la carte ── */
  var commune  = detecterCommuneProjet();
  var epciInfo = commune ? getEpciInfo(commune.codeEpci) : null;

  /* Construire le HTML du bandeau contextuel */
  var lignes = [];

  /* Ligne 1 : type de projet */
  var typeTxt = typeInfo ? (typeInfo.ico + ' <strong>' + typeInfo.label + '</strong>') : '';
  if (stInfo) typeTxt += ' › ' + stInfo.label;
  typeTxt += ' <span class="cl-ctx-sep">—</span> ' + etapes.length + ' étape(s)';
  lignes.push('<div class="cl-ctx-ligne cl-ctx-projet">' + typeTxt + '</div>');

  /* Ligne 2 : commune + EPCI si position connue */
  if (commune) {
    var cp     = (commune.codesPostaux && commune.codesPostaux.length) ? commune.codesPostaux[0] : '';
    var pop    = commune.population ? ' · ' + commune.population.toLocaleString('fr-FR') + ' hab.' : '';
    var epciNom = epciInfo ? epciInfo.nom.replace(/\(.*\)/, '').trim() : '';
    var locTxt  = '📍 <strong>' + commune.nom + '</strong>' +
                  (cp ? ' <span class="cl-ctx-cp">' + cp + '</span>' : '') +
                  pop;
    if (epciNom) locTxt += ' <span class="cl-ctx-sep">·</span> ' + epciNom;
    lignes.push('<div class="cl-ctx-ligne cl-ctx-loc">' + locTxt + '</div>');

    /* Ligne 3 : mairie comme premier interlocuteur */
    lignes.push(
      '<div class="cl-ctx-ligne cl-ctx-mairie">' +
        '🏛 Déposer le dossier à la <strong>Mairie de ' + commune.nom + '</strong> — ' +
        'vérifier le PLU avant tout dépôt' +
      '</div>'
    );
  } else if (A.position) {
    lignes.push(
      '<div class="cl-ctx-ligne cl-ctx-loc">' +
        '📍 Lat ' + A.position.lat.toFixed(4) + ', Lng ' + A.position.lng.toFixed(4) +
        ' <span class="cl-ctx-warn">(commune non identifiée — vérifier la position)</span>' +
      '</div>'
    );
  } else {
    lignes.push(
      '<div class="cl-ctx-ligne cl-ctx-warn">' +
        '⚠️ Aucune position sur la carte — placez le projet pour identifier la commune' +
      '</div>'
    );
  }

  ctxEl.innerHTML = lignes.join('');

  /* Regrouper par phase */
  var phases = ['avant','instruction','travaux','reception','post'];
  var phaseLabels = {
    avant:       'En amont du projet',
    instruction: 'Instruction administrative',
    travaux:     'Phase travaux',
    reception:   'Reception & conformite',
    post:        'Post-chantier',
  };

  bodyEl.innerHTML = '';

  /* Barre de progression globale */
  var total  = etapes.length;
  var done   = etapes.filter(function(e){ return checklistEtats[e.id] === 'done'; }).length;
  var pct    = total > 0 ? Math.round(done / total * 100) : 0;

  var prog = document.createElement('div');
  prog.className = 'cl-progress-wrap';
  prog.innerHTML =
    '<div class="cl-progress-info">' +
      '<span>Avancement</span>' +
      '<span id="cl-pct-txt">' + done + '/' + total + ' etapes (' + pct + '%)</span>' +
    '</div>' +
    '<div class="cl-progress-bar"><div class="cl-progress-fill" id="cl-fill" style="width:' + pct + '%"></div></div>';
  bodyEl.appendChild(prog);

  /* Bouton reset */
  var reset = document.createElement('button');
  reset.className = 'btn-cl-reset';
  reset.innerHTML = '&#x21BA; Reinitialiser la checklist';
  reset.addEventListener('click', function(){ resetChecklist(etapes); });
  bodyEl.appendChild(reset);

  /* Une phase à la fois */
  phases.forEach(function(phase) {
    var etapesPhase = etapes.filter(function(e){ return e.phase === phase; });
    if (etapesPhase.length === 0) return;

    var phaseDiv = document.createElement('div');
    phaseDiv.className = 'cl-phase phase-' + phase;
    phaseDiv.innerHTML =
      '<div class="cl-phase-titre">' +
        '<div class="cl-phase-dot"></div>' +
        phaseLabels[phase] +
      '</div>';

    etapesPhase.forEach(function(etape) {
      phaseDiv.appendChild(creerItemChecklist(etape));
    });

    bodyEl.appendChild(phaseDiv);
  });
}

/* Crée un item de checklist */
function creerItemChecklist(etape) {
  var etat  = checklistEtats[etape.id] || '';
  var isDone    = etat === 'done';
  var isExpanded = etat === 'expanded' || etat === 'done';

  var item = document.createElement('div');
  item.className  = 'cl-item' + (isDone ? ' done' : '') + (isExpanded ? ' expanded' : '');
  item.dataset.id = etape.id;
  item.innerHTML  =
    '<div class="cl-checkbox">' + (isDone ? '&#x2713;' : '') + '</div>' +
    '<div class="cl-content">' +
      '<div class="cl-nom">' +
        '<span class="cl-ico">' + etape.ico + '</span>' +
        etape.label +
        (etape.oblig ? '<span class="cl-oblig">Obligatoire</span>' : '') +
      '</div>' +
      '<div class="cl-delai">&#x23F1; ' + etape.delai + '</div>' +
      '<div class="cl-desc">' + etape.desc + '</div>' +
    '</div>';

  /* Clic sur la case à cocher → marquer done */
  item.querySelector('.cl-checkbox').addEventListener('click', function(e) {
    e.stopPropagation();
    toggleItemDone(etape.id, item);
  });

  /* Clic sur le contenu → déplier/replier la description */
  item.querySelector('.cl-content').addEventListener('click', function() {
    toggleItemExpand(etape.id, item);
  });

  return item;
}

/* Marque/démarque une étape comme faite */
function toggleItemDone(id, item) {
  var isDone = checklistEtats[id] === 'done';
  checklistEtats[id] = isDone ? '' : 'done';

  item.classList.toggle('done', !isDone);
  item.querySelector('.cl-checkbox').innerHTML = !isDone ? '&#x2713;' : '';

  majProgressChecklist();
}

/* Déplie/replie la description d'une étape */
function toggleItemExpand(id, item) {
  var isExpanded = item.classList.contains('expanded');
  item.classList.toggle('expanded', !isExpanded);
  if (checklistEtats[id] !== 'done') {
    checklistEtats[id] = isExpanded ? '' : 'expanded';
  }
}

/* Met à jour la barre de progression */
function majProgressChecklist() {
  var clKey  = A.sousType || '_default';
  var etapes = CHECKLISTS[clKey] || CHECKLISTS['_default'];
  var total  = etapes.length;
  var done   = etapes.filter(function(e){ return checklistEtats[e.id] === 'done'; }).length;
  var pct    = total > 0 ? Math.round(done / total * 100) : 0;

  var fill = document.getElementById('cl-fill');
  var txt  = document.getElementById('cl-pct-txt');
  if (fill) fill.style.width = pct + '%';
  if (txt)  txt.textContent  = done + '/' + total + ' etapes (' + pct + '%)';
}

/* Réinitialise toutes les cases */
function resetChecklist(etapes) {
  etapes.forEach(function(e){ delete checklistEtats[e.id]; });
  genererChecklist();
}

/* ── RECHERCHE D'ADRESSE — Nominatim OSM (autocomplete + géocodage) ──────────── */

/* ── Etat de la recherche ──────────────────────────────────────── */
var recherche = {
  timer:          null,   /* debounce setTimeout */
  suggestions:    [],     /* resultats Nominatim courants */
  idxActif:       -1,     /* index de la suggestion selectionnee au clavier */
  marqueur:       null,   /* Leaflet marker du resultat */
  toastTimer:     null,   /* setTimeout pour masquer le toast */
};


/* Retourne l'icone en fonction du type Nominatim */
function getIconeSuggestion(type, classe) {
  return SUGG_ICONS[type] || SUGG_ICONS[classe] || SUGG_ICONS['_default'];
}

/* ── Debounce : declenche la recherche 350 ms apres la derniere frappe ── */
function onSearchInput() {
  var val  = document.getElementById('search-input').value.trim();
  var wrap = document.getElementById('search-wrap');

  /* Afficher/masquer le bouton clear */
  if (val.length > 0) {
    wrap.classList.add('has-value');
  } else {
    wrap.classList.remove('has-value');
    masquerSuggestions();
    return;
  }

  /* Debounce : on attend 350 ms avant d'envoyer la requete */
  clearTimeout(recherche.timer);
  recherche.timer = setTimeout(function() {
    if (val.length >= 2) fetchSuggestions(val);
  }, 350);
}

/* ── Navigation clavier dans les suggestions ──────────────────── */
function onSearchKey(event) {
  var liste = document.getElementById('search-suggestions');
  var items = liste.querySelectorAll('.sugg-item');

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    recherche.idxActif = Math.min(recherche.idxActif + 1, items.length - 1);
    majActiveSuggestion(items);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    recherche.idxActif = Math.max(recherche.idxActif - 1, -1);
    majActiveSuggestion(items);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (recherche.idxActif >= 0 && items[recherche.idxActif]) {
      /* Selectionner la suggestion active */
      var idx = parseInt(items[recherche.idxActif].dataset.idx);
      selectionnerSuggestion(recherche.suggestions[idx]);
    } else {
      /* Lancer la recherche directe */
      lancerRecherche();
    }
  } else if (event.key === 'Escape') {
    masquerSuggestions();
    document.getElementById('search-input').blur();
  }
}

/* Met en evidence la suggestion selectionnee au clavier */
function majActiveSuggestion(items) {
  items.forEach(function(item, i) {
    item.classList.toggle('actif', i === recherche.idxActif);
    if (i === recherche.idxActif) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

/* ── Requete Nominatim pour les suggestions ───────────────────── */
function fetchSuggestions(query) {
  var liste = document.getElementById('search-suggestions');

  /* Afficher le spinner de chargement */
  liste.innerHTML =
    '<li class="sugg-loading">' +
      '<div class="sugg-spinner"></div>' +
      'Recherche en cours...' +
    '</li>';
  liste.classList.remove('search-sugg-hidden');
  recherche.idxActif = -1;

  /* Construction de l'URL Nominatim
     - q         : la requete de l'utilisateur
     - countrycodes : restreint aux resultats en France
     - viewbox   : favorise les resultats dans le Territoire de Belfort
     - bounded   : 0 = utilise viewbox comme preference (pas stricte)
     - limit     : max 6 suggestions
     - format    : json
     - addressdetails : 1 pour avoir les details de l'adresse
  */
  var url =
    'https://nominatim.openstreetmap.org/search' +
    '?q=' + encodeURIComponent(query) +
    '&countrycodes=fr' +
    '&viewbox=6.5,47.9,7.2,47.4' +
    '&bounded=0' +
    '&limit=6' +
    '&format=json' +
    '&addressdetails=1';

  /* Nominatim requiert un User-Agent descriptif dans les headers */
  fetch(url, {
    headers: { 'Accept-Language': 'fr' }
  })
  .then(function(resp) {
    if (!resp.ok) throw new Error('Nominatim HTTP ' + resp.status);
    return resp.json();
  })
  .then(function(data) {
    recherche.suggestions = data;
    afficherSuggestions(data);
  })
  .catch(function(err) {
    console.warn('Nominatim error:', err);
    liste.innerHTML = '<li class="sugg-empty">&#x26A0; Impossible de joindre le service de recherche. Verifiez votre connexion.</li>';
  });
}

/* ── Affichage des suggestions dans la liste ──────────────────── */
function afficherSuggestions(data) {
  var liste = document.getElementById('search-suggestions');
  liste.innerHTML = '';

  if (data.length === 0) {
    liste.innerHTML = '<li class="sugg-empty">&#x1F50D; Aucun resultat pour cette adresse.</li>';
    liste.classList.remove('search-sugg-hidden');
    return;
  }

  data.forEach(function(item, idx) {
    var li = document.createElement('li');
    li.className    = 'sugg-item';
    li.dataset.idx  = idx;

    /* Nom principal : premiere partie de l'affichage */
    var nom    = item.name || (item.address && item.address.road) || item.display_name.split(',')[0];
    /* Detail : reste de l'adresse */
    var detail = item.display_name.replace(nom + ', ', '').replace(nom, '');

    var ico = getIconeSuggestion(item.type, item.class);

    li.innerHTML =
      '<span class="sugg-ico">' + ico + '</span>' +
      '<div class="sugg-content">' +
        '<div class="sugg-nom">' + nom + '</div>' +
        '<div class="sugg-detail">' + detail + '</div>' +
      '</div>';

    /* Clic sur une suggestion */
    li.addEventListener('mousedown', function(e) {
      e.preventDefault(); /* Eviter la perte de focus avant le clic */
      selectionnerSuggestion(item);
    });

    /* Survol : mise en evidence */
    li.addEventListener('mouseover', function() {
      recherche.idxActif = idx;
    });

    liste.appendChild(li);
  });

  liste.classList.remove('search-sugg-hidden');
}

/* ── Masquer la liste de suggestions ──────────────────────────── */
function masquerSuggestions() {
  var liste = document.getElementById('search-suggestions');
  liste.classList.add('search-sugg-hidden');
  liste.innerHTML = '';
  recherche.idxActif = -1;
}

/* ── Effacer le champ de recherche ────────────────────────────── */
function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-wrap').classList.remove('has-value');
  masquerSuggestions();
  /* Supprimer le marqueur de resultat si present */
  if (recherche.marqueur) {
    A.carte.removeLayer(recherche.marqueur);
    recherche.marqueur = null;
  }
  document.getElementById('search-input').focus();
}

/* ── Lancer une recherche (bouton ou Entree sans selection) ───── */
function lancerRecherche() {
  var query = document.getElementById('search-input').value.trim();
  if (!query) return;

  /* Si des suggestions sont disponibles, prendre la premiere */
  if (recherche.suggestions.length > 0) {
    selectionnerSuggestion(recherche.suggestions[0]);
  } else {
    /* Sinon, faire une requete directe sans suggestions */
    fetchEtNaviguer(query);
  }
}

/* Requete directe sans suggestions (Enter sans liste) */
function fetchEtNaviguer(query) {
  var url =
    'https://nominatim.openstreetmap.org/search' +
    '?q=' + encodeURIComponent(query) +
    '&countrycodes=fr' +
    '&limit=1' +
    '&format=json' +
    '&addressdetails=1';

  fetch(url, { headers: { 'Accept-Language': 'fr' } })
  .then(function(r){ return r.json(); })
  .then(function(data) {
    if (data.length > 0) selectionnerSuggestion(data[0]);
    else afficherToast('&#x26A0; Adresse introuvable. Essayez une formulation plus precise.');
  })
  .catch(function() {
    afficherToast('&#x26A0; Erreur de connexion au service de recherche.');
  });
}

/* ── Selectionner un resultat : zoom + marqueur ───────────────── */
function selectionnerSuggestion(item) {
  masquerSuggestions();

  var lat = parseFloat(item.lat);
  var lng = parseFloat(item.lon);

  if (isNaN(lat) || isNaN(lng)) return;

  /* Mettre le nom dans le champ de saisie */
  var nom = item.name || item.display_name.split(',')[0];
  document.getElementById('search-input').value = nom;
  document.getElementById('search-wrap').classList.add('has-value');

  /* ── Centrer et zoomer la carte ── */
  /* Si Nominatim fournit une bounding box, on l'utilise pour fitBounds
     afin d'avoir un zoom adapte a la taille de l'objet
     (une rue vs une commune vs un departement). */
  if (item.boundingbox) {
    var bb = item.boundingbox;
    /* bb = [lat_min, lat_max, lng_min, lng_max] */
    A.carte.fitBounds([
      [parseFloat(bb[0]), parseFloat(bb[2])],
      [parseFloat(bb[1]), parseFloat(bb[3])],
    ], { maxZoom: 17, padding: [40, 40], animate: true, duration: 0.8 });
  } else {
    /* Fallback : zoom fixe */
    A.carte.setView([lat, lng], 16, { animate: true, duration: 0.8 });
  }

  /* ── Marqueur temporaire ── */
  /* Supprimer le marqueur precedent si il existe */
  if (recherche.marqueur) {
    A.carte.removeLayer(recherche.marqueur);
    recherche.marqueur = null;
  }

  /* Creer un marqueur HTML avec un design distinct (rouge avec pulsation) */
  var markerIcon = L.divIcon({
    className: '',
    html:
      '<div style="' +
        'position:relative;' +
        'width:22px; height:22px;' +
      '">' +
        /* Cercle pulsant */
        '<div style="' +
          'position:absolute; inset:0;' +
          'background: rgba(220,38,38,.25);' +
          'border-radius: 50%;' +
          'animation: pulse-search 1.8s ease-out infinite;' +
        '"></div>' +
        /* Point central */
        '<div style="' +
          'position:absolute; inset:4px;' +
          'background: #dc2626;' +
          'border-radius: 50%;' +
          'border: 2px solid #fff;' +
          'box-shadow: 0 1px 4px rgba(0,0,0,.3);' +
        '"></div>' +
      '</div>',
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
  });

  /* Ajouter l'animation pulse dans le head si pas encore faite */
  if (!document.getElementById('search-pulse-style')) {
    var style = document.createElement('style');
    style.id  = 'search-pulse-style';
    style.textContent =
      '@keyframes pulse-search {' +
        '0%   { transform: scale(1);   opacity: .8; }' +
        '70%  { transform: scale(2.5); opacity: 0; }' +
        '100% { transform: scale(2.5); opacity: 0; }' +
      '}';
    document.head.appendChild(style);
  }

  recherche.marqueur = L.marker([lat, lng], { icon: markerIcon })
    .addTo(A.carte)
    .bindPopup(
      '<div style="font-family:\'Source Serif 4\',serif;min-width:180px;">' +
        '<div style="font-weight:600;font-size:.9rem;margin-bottom:4px;">' + nom + '</div>' +
        '<div style="font-size:.74rem;color:#6b7280;line-height:1.5;">' +
          item.display_name +
        '</div>' +
        '<div style="margin-top:8px;font-size:.72rem;color:#1540a8;">' +
          'Lat\u00a0' + lat.toFixed(5) + ' \u2014 Lng\u00a0' + lng.toFixed(5) +
        '</div>' +
        '<button onclick="placerProjetIci(' + lat + ',' + lng + ')" ' +
          'style="margin-top:8px;width:100%;padding:5px 8px;background:#002395;color:#fff;' +
          'border:none;border-radius:6px;font-size:.76rem;font-weight:600;cursor:pointer;">' +
          '&#x1F4CD; Placer le projet ici' +
        '</button>' +
      '</div>'
    )
    .openPopup();

  /* ── Toast de confirmation ── */
  afficherToast('&#x1F4CD;\u00a0 ' + nom);
}

/* ── Placer le projet directement depuis la popup du marqueur ─── */
function placerProjetIci(lat, lng) {
  if (!A.typeProjet) {
    afficherToast('&#x26A0; Selectionnez d\'abord un type de projet dans le panneau gauche.');
    return;
  }
  A.carte.closePopup();
  placerProjet(lat, lng);
  afficherToast('&#x2705;\u00a0 Projet place sur ' + document.getElementById('search-input').value);
}

/* ── Toast de confirmation (message flottant ephemere) ───────── */
/** Bascule l'état ouvert/fermé de la légende (corps #leg-body). */
function toggleLegende() {
  var body = document.getElementById('leg-body');
  var ico  = document.getElementById('leg-toggle-ico');
  if (!body) return;
  var collapsed = body.classList.toggle('leg-collapsed');
  if (ico) ico.textContent = collapsed ? '▼' : '▲';
}

function afficherToast(msg) {
  var toast = document.getElementById('search-toast');
  toast.innerHTML = msg;
  toast.style.cursor = '';
  toast.onclick = null;
  toast.classList.add('on');

  /* Masquer apres 3 secondes */
  clearTimeout(recherche.toastTimer);
  recherche.toastTimer = setTimeout(function() {
    toast.classList.remove('on');
  }, 3000);
}

/** Toast cliquable qui zoome la carte au niveau indiqué. */
function afficherToastZoom(msg, zoomLevel) {
  var toast = document.getElementById('search-toast');
  toast.innerHTML = msg;
  toast.style.cursor = 'pointer';
  toast.onclick = function() {
    A.carte.setZoom(zoomLevel);
    toast.classList.remove('on');
    toast.onclick = null;
    toast.style.cursor = '';
  };
  toast.classList.add('on');

  clearTimeout(recherche.toastTimer);
  recherche.toastTimer = setTimeout(function() {
    toast.classList.remove('on');
    toast.onclick = null;
    toast.style.cursor = '';
  }, 5000);
}

/* ── Fermer les suggestions si on clique ailleurs ─────────────── */
document.addEventListener('click', function(e) {
  if (!document.getElementById('search-wrap').contains(e.target)) {
    masquerSuggestions();
  }
});

/* ── TUTORIEL D'ONBOARDING — slides statiques + serious game interactif
   Affiché à chaque démarrage. localStorage 'ddt90_tuto_v3' inutilisé.  */

/* ── Données des slides ─────────────────────────────────────────── */
var TUTO_SLIDES = [

  /* ══ 0. Bienvenue ══ */
  {
    type: 'welcome',
    html: function() { return (
      '<div class="tuto-slide" style="text-align:center;">' +
        '<div class="tuto-badge">&#x1F3DB;&nbsp; DDT 90 &mdash; Territoire de Belfort</div>' +
        '<div class="tuto-hero">&#x1F5FA;&#xFE0F;</div>' +
        '<div class="tuto-title">Bienvenue sur le Logiciel Interactif d\'Aide a la Decision</div>' +
        '<div class="tuto-sub">Cet outil vous aide a prendre des decisions eclairees sur vos projets d\'amenagement en vous fournissant les enjeux territoriaux, les contacts utiles et les demarches administratives issus de l\'Atlas DDT 90 2025-2026.</div>' +
        '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:8px;">' +
          '<div style="background:var(--rf-pale);border:1px solid rgba(0,35,149,.12);border-radius:var(--r-lg);padding:10px 16px;font-size:.78rem;color:var(--rf);font-weight:500;text-align:center;">' +
            '&#x1F4CB; 49 fiches enjeux' +
          '</div>' +
          '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r-lg);padding:10px 16px;font-size:.78rem;color:#15803d;font-weight:500;text-align:center;">' +
            '&#x1F5FA; 11 couches Atlas' +
          '</div>' +
          '<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:var(--r-lg);padding:10px 16px;font-size:.78rem;color:#92400e;font-weight:500;text-align:center;">' +
            '&#x2705; Checklist administrative' +
          '</div>' +
        '</div>' +
      '</div>'
    );},
  },

  /* ══ 1. La carte interactive ══ */
  {
    type: 'feature',
    html: function() { return (
      '<div class="tuto-slide">' +
        '<div class="tuto-hero">&#x1F30D;</div>' +
        '<div class="tuto-title">La carte interactive</div>' +
        '<div class="tuto-sub">Le fond de carte du Territoire de Belfort est enrichi des 101 communes et de 11 couches thematiques issues de l\'Atlas DDT 90.</div>' +
        '<div class="tuto-features">' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F50D;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Barre de recherche</div>' +
              '<div class="tuto-feat-desc">Tapez une adresse ou une commune dans la barre en haut. La carte zoome automatiquement sur le lieu recherche.</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F4CD;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Placement du projet</div>' +
              '<div class="tuto-feat-desc">Cliquez sur "Placer le projet sur la carte" puis cliquez sur la carte pour positionner votre projet. Double-cliquez sur le marqueur pour le deplacer.</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F3D9;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Survol des communes</div>' +
              '<div class="tuto-feat-desc">Passez la souris sur une commune pour afficher son nom, sa population, sa superficie et son code postal.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );},
  },

  /* ══ 2. Configurer votre projet ══ */
  {
    type: 'feature',
    html: function() { return (
      '<div class="tuto-slide">' +
        '<div class="tuto-hero">&#x1F4CB;</div>' +
        '<div class="tuto-title">Configurer votre projet</div>' +
        '<div class="tuto-sub">Le panneau gauche vous permet de definir precisement votre projet avant l\'analyse.</div>' +
        '<div class="tuto-features">' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">1&#xFE0F;&#x20E3;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Type de projet + sous-type</div>' +
              '<div class="tuto-feat-desc">Choisissez parmi 8 types (logement, ZAE, energie...) puis precisez via le menu secondaire qui apparait (ex : maison individuelle, centrale PV, elevage...).</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">2&#xFE0F;&#x20E3;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Superficie et localisation</div>' +
              '<div class="tuto-feat-desc">Renseignez la superficie (m&#178;, ha, km&#178;). L\'envergure reglementaire est suggeree automatiquement. Placez le projet sur la carte pour le contextualiser.</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">3&#xFE0F;&#x20E3;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Couches thematiques Atlas</div>' +
              '<div class="tuto-feat-desc">Activez les 11 couches de l\'Atlas (risques, eau, biodiversite, urbanisme...) pour visualiser les enjeux directement sur la carte.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );},
  },

  /* ══ 3. Fiches enjeux ══ */
  {
    type: 'feature',
    html: function() { return (
      '<div class="tuto-slide">' +
        '<div class="tuto-hero">&#x26A0;&#xFE0F;</div>' +
        '<div class="tuto-title">Les fiches enjeux</div>' +
        '<div class="tuto-sub">Apres avoir clique sur "Analyser les enjeux", le panneau droit affiche les enjeux pertinents pour votre projet, classes par niveau de priorite.</div>' +
        '<div class="tuto-features">' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico" style="background:#fee2e2;padding:4px;border-radius:6px;">&#x26A0;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Niveaux de priorite</div>' +
              '<div class="tuto-feat-desc">Chaque enjeu est classe <strong style="color:#991b1b">Eleve</strong>, <strong style="color:#92400e">Moyen</strong> ou <strong style="color:#065f46">Faible</strong> selon l\'urgence reglementaire.</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F5FA;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Liens vers l\'Atlas</div>' +
              '<div class="tuto-feat-desc">Chaque fiche affiche la reference a la carte de l\'Atlas DDT 90. Cliquez sur le lien pour ouvrir la fiche detaillee avec le contexte reglementaire complet.</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F4DE;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Contacts + Checklist</div>' +
              '<div class="tuto-feat-desc">En bas du panneau : les contacts des acteurs du territoire filtes selon votre projet, et la checklist administrative avec toutes les etapes a suivre.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );},
  },

  /* ══ 4. Illiwap + concertation ══ */
  {
    type: 'feature',
    html: function() { return (
      '<div class="tuto-slide">' +
        '<div class="tuto-hero">&#x1F4AC;</div>' +
        '<div class="tuto-title">Concertation avec Illiwap</div>' +
        '<div class="tuto-sub">Pour tout projet, la concertation publique est une etape cle. L\'outil Illiwap facilite la creation de sondages en ligne adaptes aux projets d\'amenagement.</div>' +
        '<div class="tuto-features">' +
          '<div class="tuto-feat" style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:#fde68a;">' +
            '<span class="tuto-feat-ico">&#x1F4CA;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Illiwap — Sondages geolocalises</div>' +
              '<div class="tuto-feat-desc">Creez des questionnaires en ligne, diffusez-les par lien ou QR code. Les repondants n\'ont pas besoin de compte. Resultats exportables.<br/><a href="https://www.illiwap.com" target="_blank" rel="noopener" style="color:#b45309;font-weight:600;">&#x1F517; www.illiwap.com</a>&nbsp;&nbsp;<a href="https://www.illiwap.com/tutoriels" target="_blank" rel="noopener" style="color:#b45309;font-weight:600;">&#x1F393; Tutoriels</a></div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F6E1;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Retrouvez Illiwap dans les enjeux</div>' +
              '<div class="tuto-feat-desc">Chaque fiche "Prevention/Sensibilisation" contient un lien vers Illiwap et le tutoriel. Filtrez les enjeux avec le theme Prevention pour les afficher.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );},
  },

  /* ══ 5. Invitation serious game ══ */
  {
    type: 'sg-intro',
    html: function() { return (
      '<div class="tuto-slide" style="text-align:center;">' +
        '<div class="sg-intro-badge">&#x1F3AE;&nbsp; Mode optionnel &mdash; Serious Game</div>' +
        '<div class="tuto-hero">&#x1F9E0;</div>' +
        '<div class="tuto-title">Testez vos connaissances !</div>' +
        '<div class="tuto-sub">Un cas pratique en 5 questions pour valider votre comprehension des enjeux reglementaires du Territoire de Belfort. Optionnel &mdash; vous pouvez commencer a utiliser l\'outil maintenant.</div>' +
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap;">' +
          '<button onclick="demarrerSeriousGame()" style="height:42px;padding:0 24px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:20px;font-family:var(--f-ui);font-size:.85rem;font-weight:600;cursor:pointer;box-shadow:0 3px 12px rgba(217,119,6,.35);">&#x1F3AE; Jouer au Serious Game</button>' +
          '<button onclick="fermerTutoriel()" style="height:42px;padding:0 24px;background:var(--rf);color:#fff;border:none;border-radius:20px;font-family:var(--f-ui);font-size:.85rem;font-weight:600;cursor:pointer;box-shadow:0 3px 12px rgba(0,35,149,.3);">&#x1F680; Commencer a utiliser l\'outil</button>' +
        '</div>' +
      '</div>'
    );},
  },
];



/* ── Etat du tutoriel et du serious game ───────────────────────── */
var tuto = {
  slide:       0,
  total:       TUTO_SLIDES.length,
  sgActif:     false,
  sgQuestion:  0,
  sgScore:     0,
  sgReponses:  [],  /* { correct: bool, idx: int } par question */
};

/* Tutorial init is handled inside the main DOMContentLoaded above */

/* ── Afficher le tutoriel ──────────────────────────────────────── */
function afficherTutoriel() {
  tuto.slide   = 0;
  tuto.sgActif = false;
  var overlay = document.getElementById('tuto-overlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('visible');
  renderSlide();  /* Render slide 0 immediately */
}

/* ── Fermer le tutoriel ────────────────────────────────────────── */
function fermerTutoriel() {
  var overlay = document.getElementById('tuto-overlay');
  overlay.classList.remove('visible');
  overlay.classList.add('hidden');
  try { localStorage.setItem('ddt90_tuto_v3', '1'); } catch(e) {}
}

/* ── Navigation dans le tutoriel ──────────────────────────────── */
function tutoNav(dir) {
  if (tuto.sgActif) return;  /* Le SG gere sa propre navigation */

  tuto.slide = Math.max(0, Math.min(tuto.total - 1, tuto.slide + dir));

  /* Sur la derniere slide du tuto (SG intro) et avancer = fermer */
  if (dir === 1 && tuto.slide === tuto.total - 1) {
    /* Deja sur la slide SG intro — rien, l'utilisateur choisit */
  }
  renderSlide();
}

/* ── Rend la slide courante ────────────────────────────────────── */
function renderSlide() {
  var slide = TUTO_SLIDES[tuto.slide];
  if (!slide) { tuto.slide = 0; slide = TUTO_SLIDES[0]; }  /* guard */
  var content = document.getElementById('tuto-content');
  var dots    = document.getElementById('tuto-dots');
  var prev    = document.getElementById('tuto-prev');
  var next    = document.getElementById('tuto-next');
  var fill    = document.getElementById('tuto-progress-fill');

  /* Contenu */
  content.innerHTML = slide.html();

  /* Barre de progression */
  var pct = Math.round((tuto.slide + 1) / tuto.total * 100);
  fill.style.width = pct + '%';

  /* Dots */
  dots.innerHTML = '';
  TUTO_SLIDES.forEach(function(_, i) {
    var d = document.createElement('div');
    d.className = 'tuto-dot' + (i === tuto.slide ? ' actif' : '');
    d.addEventListener('click', function() { tuto.slide = i; renderSlide(); });
    dots.appendChild(d);
  });

  /* Boutons nav */
  prev.classList.toggle('hidden-nav', tuto.slide === 0);
  if (tuto.slide === tuto.total - 1) {
    next.style.display = 'none';   /* Sur la slide SG intro, les boutons sont dans le contenu */
  } else {
    next.style.display = '';
    next.textContent = tuto.slide === tuto.total - 2
      ? 'Suivant \u2192'
      : 'Suivant \u2192';
  }
}

/* ── SERIOUS GAME — quiz intégré au tutoriel, scoring SG_CAS + SG_QUESTIONS ── */

function demarrerSeriousGame() {
  tuto.sgActif    = true;
  tuto.sgQuestion = 0;
  tuto.sgScore    = 0;
  tuto.sgReponses = [];

  /* Masquer les boutons de navigation standard */
  document.getElementById('tuto-prev').classList.add('hidden-nav');
  document.getElementById('tuto-next').style.display = 'none';
  document.getElementById('tuto-skip').textContent = 'Quitter le jeu \u2715';
  document.getElementById('tuto-progress-fill').style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';

  renderQuestionSG();
}

/* Rend la question courante */
function renderQuestionSG() {
  var content = document.getElementById('tuto-content');
  var fill    = document.getElementById('tuto-progress-fill');
  var dots    = document.getElementById('tuto-dots');

  var q   = SG_QUESTIONS[tuto.sgQuestion];
  var num = tuto.sgQuestion + 1;
  var tot = SG_QUESTIONS.length;

  /* Progression */
  fill.style.width = Math.round((num / tot) * 100) + '%';

  /* Dots pour les questions */
  dots.innerHTML = '';
  SG_QUESTIONS.forEach(function(_, i) {
    var d = document.createElement('div');
    d.className = 'tuto-dot' + (i === tuto.sgQuestion ? ' actif' : '');
    dots.appendChild(d);
  });

  /* Lettres des options */
  var lettres = ['A', 'B', 'C', 'D'];

  var optsHtml = q.opts.map(function(opt, i) {
    return (
      '<button class="sg-option" onclick="repondreSG(' + i + ', this)">' +
        '<div class="sg-option-lettre">' + lettres[i] + '</div>' +
        opt.txt +
      '</button>'
    );
  }).join('');

  content.innerHTML =
    '<div class="tuto-slide">' +
      '<div style="font-size:.72rem;font-weight:600;color:var(--ink-4);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">&#x1F3AE; Question ' + num + '/' + tot + '</div>' +
      '<div class="sg-scenario-card">' +
        '<div class="sg-scenario-titre">' + SG_CAS.scenario_ico + '&nbsp; ' + SG_CAS.titre + '</div>' +
        '<div class="sg-scenario-desc">' + SG_CAS.description + '</div>' +
        '<div class="sg-scenario-meta">' +
          SG_CAS.meta.map(function(m){ return '<span class="sg-meta-chip">' + m + '</span>'; }).join('') +
        '</div>' +
      '</div>' +
      '<div class="sg-question">' + q.q + '</div>' +
      '<div class="sg-options">' + optsHtml + '</div>' +
      '<div class="sg-feedback" id="sg-feedback"></div>' +
    '</div>';
}

/* Gere une reponse */
function repondreSG(idx, btn) {
  var q       = SG_QUESTIONS[tuto.sgQuestion];
  var correct = q.opts[idx].correct;
  var lettres = ['A', 'B', 'C', 'D'];

  /* Bloquer toutes les options */
  var options = document.querySelectorAll('.sg-option');
  options.forEach(function(opt, i) {
    opt.classList.add('desactivee');
    if (q.opts[i].correct) opt.classList.add('correcte');
  });
  if (!correct) btn.classList.add('incorrecte');

  /* Mettre a jour le score */
  if (correct) tuto.sgScore++;
  tuto.sgReponses.push({ correct: correct, idx: idx });

  /* Afficher le feedback */
  var fb = document.getElementById('sg-feedback');
  fb.classList.add('on', correct ? 'ok' : 'ko');
  fb.innerHTML =
    '<div class="sg-feedback-titre">' + (correct ? '&#x2705; Bonne reponse !' : '&#x274C; Pas tout a fait...') + '</div>' +
    (correct ? q.feedback_ok : q.feedback_ko);

  /* Bouton suivant */
  var nav = document.createElement('div');
  nav.style.cssText = 'display:flex;justify-content:flex-end;margin-top:12px;';

  var btnSuivant = document.createElement('button');
  var estDerniere = tuto.sgQuestion === SG_QUESTIONS.length - 1;
  btnSuivant.textContent  = estDerniere ? '&#x1F3C6; Voir les resultats' : 'Question suivante \u2192';
  btnSuivant.style.cssText =
    'height:38px;padding:0 20px;background:' + (estDerniere ? 'var(--rf)' : '#065f46') + ';' +
    'color:#fff;border:none;border-radius:20px;font-family:var(--f-ui);font-size:.82rem;' +
    'font-weight:600;cursor:pointer;';
  btnSuivant.innerHTML = estDerniere
    ? '&#x1F3C6; Voir les resultats'
    : 'Question suivante &nbsp;&#x2192;';
  btnSuivant.addEventListener('click', function() {
    if (estDerniere) {
      afficherScoreSG();
    } else {
      tuto.sgQuestion++;
      renderQuestionSG();
    }
  });

  nav.appendChild(btnSuivant);
  fb.appendChild(nav);
}

/* Affiche le score final */
function afficherScoreSG() {
  var content = document.getElementById('tuto-content');
  var fill    = document.getElementById('tuto-progress-fill');
  var dots    = document.getElementById('tuto-dots');
  fill.style.width = '100%';
  dots.innerHTML   = '';

  var score = tuto.sgScore;
  var total = SG_QUESTIONS.length;
  var pct   = Math.round(score / total * 100);

  var cls, msg, desc;
  if (pct >= 80) {
    cls  = 'excellent';
    msg  = '&#x1F3C6; Excellent ! Vous maîtrisez les enjeux reglementaires du 90.';
    desc = 'Vous etes pret(e) a utiliser le logiciel d\'aide a la decision. Toutes les informations sont egalement disponibles dans les fiches enjeux et la checklist.';
  } else if (pct >= 50) {
    cls  = 'bien';
    msg  = '&#x1F44D; Bien ! Quelques points a revoir.';
    desc = 'Consultez les fiches enjeux des themes que vous maitrisez moins (risques naturels, urbanisme) apres avoir configure votre projet.';
  } else {
    cls  = 'peut-mieux';
    msg  = '&#x1F4DA; A retravailler ! Les fiches enjeux sont la pour vous aider.';
    desc = 'Pas d\'inquietude : les fiches enjeux, les contacts et la checklist du logiciel vous guideront pas a pas dans vos projets.';
  }

  /* Bilan des reponses */
  var bilanHtml = SG_QUESTIONS.map(function(q, i) {
    var rep = tuto.sgReponses[i];
    var ico = rep && rep.correct ? '&#x2705;' : '&#x274C;';
    return '<div style="display:flex;align-items:center;gap:8px;font-size:.76rem;color:var(--ink-3);padding:4px 0;border-bottom:1px solid var(--border);">' +
      '<span>' + ico + '</span>' +
      '<span>' + (i + 1) + '. ' + q.q.substring(0, 60) + '...</span>' +
    '</div>';
  }).join('');

  content.innerHTML =
    '<div class="tuto-slide" style="text-align:center;">' +
      '<div class="sg-score-ring ' + cls + '">' +
        '<div class="sg-score-num">' + score + '</div>' +
        '<div class="sg-score-denom">/' + total + '</div>' +
      '</div>' +
      '<div class="sg-score-msg">' + msg + '</div>' +
      '<div class="sg-score-detail" style="margin-bottom:16px;">' + desc + '</div>' +
      '<div style="text-align:left;width:100%;background:var(--bg);border-radius:var(--r-lg);padding:12px 14px;margin-bottom:16px;">' +
        '<div style="font-size:.72rem;font-weight:700;color:var(--ink-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Votre bilan</div>' +
        bilanHtml +
      '</div>' +
      '<button onclick="fermerTutoriel()" style="height:42px;padding:0 28px;background:var(--rf);color:#fff;border:none;border-radius:20px;font-family:var(--f-ui);font-size:.88rem;font-weight:600;cursor:pointer;box-shadow:0 3px 12px rgba(0,35,149,.3);">&#x1F680; Commencer a utiliser l\'outil</button>' +
      '<br/><button onclick="afficherTutoriel()" style="margin-top:8px;background:none;border:none;color:var(--ink-4);font-size:.75rem;cursor:pointer;text-decoration:underline;">Rejouer le serious game</button>' +
    '</div>';
}  /* ── fin afficherScoreSG ── */

/* ── THÈME SOMBRE — toggleDarkMode / initTheme (localStorage 'ddt90_dark') ── */

function toggleDarkMode() {
  var isDark = document.body.classList.toggle('dark-mode');
  var icon   = document.getElementById('dark-mode-icon');
  icon.textContent = isDark ? '☀️' : '🌙';
  try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch(e) {}
}

function initTheme() {
  var saved = '';
  try { saved = localStorage.getItem('theme') || ''; } catch(e) {}
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
    var icon = document.getElementById('dark-mode-icon');
    if (icon) icon.textContent = '☀️';
  }
}

/* ── ONGLETS DU PANNEAU DROIT — enjeux / simulation / contacts / checklist ── */

function switchTab(id) {
  /* Activer le bouton */
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('actif', b.id === 'tab-btn-' + id);
  });
  /* Afficher le bon panneau */
  document.getElementById('tab-enjeux').style.display     = id === 'enjeux'     ? 'block' : 'none';
  document.getElementById('tab-simulation').style.display = id === 'simulation' ? 'block' : 'none';
}

/* ── SIMULATION — SIM_BASE + ZONES_RISQUE + modificateurs zones agricoles
   Résultat stocké dans A._sim pour le rapport PDF.                    */



/* ── Lance la simulation ── */
function lancerSimulation() {
  if (!A.typeProjet) {
    alert("Selectionnez d'abord un type de projet dans le panneau gauche.");
    switchTab('enjeux');
    return;
  }

  var base   = SIM_BASE[A.typeProjet];
  var taille = A.taille;  /* 1-4 */
  var tidx   = taille - 1;

  /* Valeurs de base */
  var duree    = base.dureeBase[tidx];
  var complex  = base.complexBase[tidx];
  var impact   = base.impactBase[tidx];

  /* Superficie (si plus grande que la taille standard, +10% par ha supplementaire jusqu'à +30%) */
  var bonusSuperficie = 1;
  if (A.superficieHa) {
    var seuilsHa = [0.5, 5, 20, 100];
    var seuil = seuilsHa[tidx];
    if (A.superficieHa > seuil) {
      var ratio = Math.min((A.superficieHa / seuil), 3);
      bonusSuperficie = 1 + (ratio - 1) * 0.15;
      duree   = Math.round(duree   * bonusSuperficie);
      complex = Math.min(99, Math.round(complex * (1 + (ratio - 1) * 0.08)));
    }
  }

  /* Facteurs localisation */
  var alertesLoc = [];
  if (A.position) {
    ZONES_RISQUE.forEach(function(zone) {
      var inLat = A.position.lat >= zone.lat[0] && A.position.lat <= zone.lat[1];
      var inLng = A.position.lng >= zone.lng[0] && A.position.lng <= zone.lng[1];
      if (inLat && inLng) {
        duree   += zone.duree;
        complex = Math.min(99, complex + zone.complexite);
        impact  += zone.impact;
        alertesLoc.push(zone.label);
      }
    });
  }

  var alertesAgri=[];var alertesAxes=[];
  /* ── Modificateurs zones agricoles (si projet agriculture) ── */
  if (A.typeProjet === 'agriculture' && A._zonesAgri && A._zonesAgri.length > 0) {
    var modAgri = modificateursSimulationAgricole(A._zonesAgri);
    duree   += modAgri.dureeDelta;
    complex  = Math.min(99, complex + modAgri.complexDelta);
    impact  += modAgri.impactDelta;
    alertesAgri=modAgri.alertes;
  }
  if(A._axesMajeurs&&A._axesMajeurs.aProximite){var mA=modificateursSimulationAxesMajeurs(A._axesMajeurs);duree+=mA.dureeDelta;complex=Math.min(99,complex+mA.complexDelta);impact+=mA.impactDelta;alertesAxes=mA.alertes;}
  /* Clamp */
  duree   = Math.max(1, duree);
  complex = Math.max(1, Math.min(99, complex));
  var impactAbs = Math.abs(impact);
  var impactPos = impact < 0;  /* Valeur négative = impact positif sur l'environnement */
  impactAbs = Math.min(99, Math.max(1, impactAbs));

  /* Formatage de la durée */
  var dureeStr;
  if (duree < 3)       dureeStr = duree + ' mois';
  else if (duree < 12) dureeStr = duree + ' mois';
  else if (duree < 24) dureeStr = '~1 an';
  else if (duree < 36) dureeStr = '~2 ans (' + duree + ' mois)';
  else if (duree < 60) dureeStr = '~3 ans (' + duree + ' mois)';
  else                 dureeStr = '~' + Math.round(duree / 12) + ' ans';

  /* Niveaux textuels */
  var complexLabel = complex < 30 ? 'Simple' : complex < 50 ? 'Modérée' : complex < 70 ? 'Elevée' : complex < 85 ? 'Complexe' : 'Très complexe';
  var impactLabel  = impactPos
    ? (impactAbs < 30 ? 'Léger bénéfice' : impactAbs < 55 ? 'Bénéfice notable' : impactAbs < 75 ? 'Fort bénéfice' : 'Très bénéfique')
    : (impactAbs < 30 ? 'Impact faible'  : impactAbs < 55 ? 'Impact modéré'    : impactAbs < 75 ? 'Impact fort'   : 'Impact majeur');

  /* Alertes générales selon type+taille + alertes zones agri */
  var alertesGen = calculerAlertesGenerales(A.typeProjet, taille, A.superficieHa).concat(alertesAgri).concat(alertesAxes);

  /* Recommandations */
  var recos = calculerRecommandations(A.typeProjet, taille, alertesLoc, impactPos);

  /* Rendu */
  afficherResultatSimulation({
    typeId:       A.typeProjet,
    ico:          base.ico,
    duree:        duree,
    dureeStr:     dureeStr,
    complex:      complex,
    complexLabel: complexLabel,
    impact:       impactAbs,
    impactPos:    impactPos,
    impactLabel:  impactLabel,
    alertesLoc:   alertesLoc,
    alertesGen:   alertesGen,
    recos:        recos,
  });

  /* Stocker pour le rapport PDF */
  A._sim = {
    dureeStr:     dureeStr,
    duree:        duree,
    complex:      complex,
    complexLabel: complexLabel,
    impact:       impactAbs,
    impactPos:    impactPos,
    impactLabel:  impactLabel,
  };

  /* Passer sur l'onglet simulation */
  switchTab('simulation');
}

/* ── Calcule les alertes générales ── */
function calculerAlertesGenerales(typeId, taille, superficieHa) {
  var alertes = [];
  var sup = superficieHa || 0;

  if (typeId === 'energie' && taille >= 3)
    alertes.push({ cls:'orange', ico:'⚡', txt: 'Etude d\'impact obligatoire pour les projets ENR >1 MW. Consultation DREAL et enquête publique probable.' });
  if (typeId === 'friche')
    alertes.push({ cls:'rouge',  ico:'☣', txt: 'Diagnostic BASIAS/BASOL et étude ESE Phase 1 indispensables avant tout dépôt de permis.' });
  if (typeId === 'agriculture' && sup > 5)
    alertes.push({ cls:'orange', ico:'🌾', txt: 'Consultation CDPENAF obligatoire pour tout projet réduisant la SAU. Avis de la Chambre d\'Agriculture.' });
  if (sup > 1)
    alertes.push({ cls:'bleu',   ico:'💧', txt: 'Déclaration loi sur l\'eau (IOTA) nécessaire si imperméabilisation >1 ha ou impact sur cours d\'eau.' });
  if (taille >= 3)
    alertes.push({ cls:'orange', ico:'📋', txt: 'Projet de grande envergure : prévoir une phase d\'études de 6 à 12 mois avant le dépôt du dossier.' });
  if (taille >= 4)
    alertes.push({ cls:'rouge',  ico:'📢', txt: 'Projet majeur : enquête publique et concertation préalable très probables. Délais allongés.' });

  return alertes;
}

/* ── Calcule les recommandations ── */
function calculerRecommandations(typeId, taille, alertesLoc, impactPositif) {
  var recos = [
    { ico:'🗺', txt: 'Activez les couches thématiques de l\'Atlas DDT 90 pour visualiser les contraintes de votre zone.' },
    { ico:'📞', txt: 'Prenez contact avec la DDT 90 en amont (03 84 58 86 00). Un rendez-vous préalable évite de nombreux allers-retours.' },
    { ico:'✅', txt: 'Consultez la checklist administrative (onglet Enjeux) pour suivre les étapes obligatoires.' },
  ];

  if (alertesLoc.length > 0)
    recos.push({ ico:'⚠', txt: 'Votre localisation déclenche des contraintes spécifiques. Consultez les fiches enjeux correspondantes.' });
  if (typeId === 'energie')
    recos.push({ ico:'☀', txt: 'Vérifiez le cadastre solaire (Atlas C22) et le potentiel éolien (C24) pour votre commune.' });
  if (typeId === 'friche')
    recos.push({ ico:'🏗', txt: 'L\'EPF BFC peut assurer le portage foncier pendant la dépollution. Contactez-les tôt.' });
  if (impactPositif)
    recos.push({ ico:'🌱', txt: 'Projet à impact positif sur l\'environnement. Valorisez cet argument dans vos dossiers de demande de financement.' });
  if (taille >= 3)
    recos.push({ ico:'📅', txt: 'Planifiez un calendrier de projet réaliste avec 20% de marge sur les délais estimés. Les recours sont fréquents.' });

  return recos;
}

/* ── Affiche les résultats ── */
function afficherResultatSimulation(r) {
  document.getElementById('sim-empty').style.display  = 'none';
  var res = document.getElementById('sim-result');
  res.style.display = 'block';

  var typeInfo = TYPES.find(function(t){ return t.id === r.typeId; });
  var typeLabel = typeInfo ? typeInfo.label : r.typeId;

  /* Chips de contexte */
  var chips = [typeLabel, TAILLES[A.taille].nom];
  if (A.superficieHa) chips.push(A.superficieHa.toFixed(2) + ' ha');
  if (A.position) chips.push('Projet positionné');
  var chipsHtml = chips.map(function(c){ return '<span class="sim-chip">' + c + '</span>'; }).join('');

  /* Alertes localisation */
  var alertesLocHtml = '';
  if (r.alertesLoc.length > 0) {
    alertesLocHtml = r.alertesLoc.map(function(a){
      return '<div class="sim-alerte rouge"><span class="sim-alerte-ico">📍</span><span><strong>Zone sensible :</strong> ' + a + '</span></div>';
    }).join('');
  }

  /* Alertes générales */
  var alertesGenHtml = r.alertesGen.map(function(a){
    return '<div class="sim-alerte ' + a.cls + '"><span class="sim-alerte-ico">' + a.ico + '</span><span>' + a.txt + '</span></div>';
  }).join('');

  /* Recommandations */
  var recosHtml = r.recos.map(function(rec){
    return '<li class="sim-reco-item"><span class="r-ico">' + rec.ico + '</span><span>' + rec.txt + '</span></li>';
  }).join('');

  /* Fill couleur impact */
  var impactFill = r.impactPos ? 'fill-impact-pos' : 'fill-impact-neg';
  var impactColor = r.impactPos ? '#10b981' : '#ef4444';

  res.innerHTML =
    '<div class="sim-card">' +

      /* En-tête */
      '<div class="sim-card-hdr">' +
        '<div class="sim-card-ico">' + r.ico + '</div>' +
        '<div class="sim-card-meta">' +
          '<div class="sim-card-titre">Simulation — ' + typeLabel + '</div>' +
          '<div class="sim-chips">' + chipsHtml + '</div>' +
        '</div>' +
      '</div>' +

      /* Jauges */
      '<div class="sim-jauges">' +

        /* Durée */
        '<div class="sim-jauge">' +
          '<div class="sim-jauge-top">' +
            '<div class="sim-jauge-label"><span class="j-ico">⏱</span> Durée estimée</div>' +
            '<div class="sim-jauge-valeur">' + r.dureeStr + '</div>' +
          '</div>' +
          '<div class="sim-gauge-track"><div class="sim-gauge-fill fill-duree" style="width:' + Math.min(100, Math.round(r.duree/72*100)) + '%"></div></div>' +
          '<div class="sim-jauge-sous">De l\'étude préalable à la réception des travaux, instruction incluse.</div>' +
        '</div>' +

        /* Complexité */
        '<div class="sim-jauge">' +
          '<div class="sim-jauge-top">' +
            '<div class="sim-jauge-label"><span class="j-ico">⚙️</span> Complexité administrative</div>' +
            '<div class="sim-jauge-valeur">' + r.complexLabel + ' (' + r.complex + '/100)</div>' +
          '</div>' +
          '<div class="sim-gauge-track"><div class="sim-gauge-fill fill-complexite" style="width:' + r.complex + '%"></div></div>' +
          '<div class="sim-jauge-sous">Nombre de procédures, consultations et acteurs impliqués.</div>' +
        '</div>' +

        /* Impact environnemental */
        '<div class="sim-jauge">' +
          '<div class="sim-jauge-top">' +
            '<div class="sim-jauge-label"><span class="j-ico">🌿</span> Impact environnemental</div>' +
            '<div class="sim-jauge-valeur" style="color:' + impactColor + '">' + r.impactLabel + ' (' + r.impact + '/100)</div>' +
          '</div>' +
          '<div class="sim-gauge-track"><div class="sim-gauge-fill ' + impactFill + '" style="width:' + r.impact + '%"></div></div>' +
          '<div class="sim-jauge-sous">' + (r.impactPos ? '🌱 Ce projet a un bilan environnemental favorable (renaturation, ENR...).' : '⚠ Impact sur les sols, l\'eau et la biodiversité à anticiper.') + '</div>' +
        '</div>' +

      '</div>' + /* /sim-jauges */

      /* Facteurs contextuels */
      '<div class="sim-facteurs">' +
        '<div class="sim-section-titre">📊 Facteurs contextuels</div>' +
        '<div class="sim-facteur-grid">' +
          '<div class="sim-facteur-item">' +
            '<div class="sim-facteur-nom">Superficie</div>' +
            '<div class="sim-facteur-val">' + (A.superficieHa ? A.superficieHa.toFixed(2) + ' ha' : 'Non renseignée') + '</div>' +
            '<div class="sim-facteur-sub">' + TAILLES[A.taille].nom + '</div>' +
          '</div>' +
          '<div class="sim-facteur-item">' +
            '<div class="sim-facteur-nom">Localisation</div>' +
            '<div class="sim-facteur-val">' + (A.position ? 'Définie' : 'Non définie') + '</div>' +
            '<div class="sim-facteur-sub">' + (A.position ? 'Lat ' + A.position.lat.toFixed(3) : 'Placez le projet sur la carte') + '</div>' +
          '</div>' +
          '<div class="sim-facteur-item">' +
            '<div class="sim-facteur-nom">Zones détectées</div>' +
            '<div class="sim-facteur-val">' + r.alertesLoc.length + '</div>' +
            '<div class="sim-facteur-sub">' + (r.alertesLoc.length > 0 ? 'Contraintes locales' : 'Aucune contrainte locale') + '</div>' +
          '</div>' +
          '<div class="sim-facteur-item">' +
            '<div class="sim-facteur-nom">Procédures</div>' +
            '<div class="sim-facteur-val">' + (A.taille <= 1 ? '1-3' : A.taille === 2 ? '3-5' : A.taille === 3 ? '5-8' : '8-15') + '</div>' +
            '<div class="sim-facteur-sub">Autorisations estimées</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* Alertes */
      ((alertesLocHtml || alertesGenHtml) ?
        '<div class="sim-alertes">' +
          '<div class="sim-section-titre">🔔 Points d\'attention</div>' +
          alertesLocHtml + alertesGenHtml +
        '</div>' : '') +

      /* Recommandations */
      '<div class="sim-reco">' +
        '<div class="sim-section-titre">💡 Recommandations</div>' +
        '<ul class="sim-reco-list">' + recosHtml + '</ul>' +
      '</div>' +

      /* Actions */
      '<div class="sim-actions">' +
        '<button class="sim-btn-primary" onclick="lancerSimulation()">🔄 Relancer</button>' +
        '<button class="sim-btn-secondary" onclick="switchTab(\'enjeux\'); lancerAnalyse()">📋 Voir les enjeux</button>' +
      '</div>' +

    '</div>'; /* /sim-card */
}

/* ── PROJETS ALENTOURS — Overpass API (OSM)
   Requête dynamique par sous-type (OSM_TAGS). Rayon réglable 500–5000 m. */

/* ── Correspondance sous-type → tags OSM Overpass ────────────────
   Format : { key: 'amenity', value: 'school' }
   Plusieurs tags possibles (tableau = OR logique)
   ─────────────────────────────────────────────────────────────── */


/* ── État alentours ── */
var alentours = {
  ouvert:      false,
  rayon:       3000,        /* mètres */
  layer:       null,        /* L.LayerGroup sur la carte */
  resultats:   [],          /* features OSM */
  enCours:     false,
};

/* ── Toggle ouverture panneau ── */
function toggleAlentours() {
  alentours.ouvert = !alentours.ouvert;
  var panel   = document.getElementById('alentours-panel');
  var trigger = document.getElementById('alentours-trigger');
  if (alentours.ouvert) {
    panel.classList.remove('al-hidden');
    panel.classList.add('al-visible');
    trigger.classList.add('ouvert');
    /* Lancer la recherche si pas encore fait */
    if (alentours.resultats.length === 0 && !alentours.enCours) {
      rechercherAlentours();
    }
  } else {
    panel.classList.remove('al-visible');
    panel.classList.add('al-hidden');
    trigger.classList.remove('ouvert');
  }
}

/* ── Mise à jour du rayon ── */
function majRayonAlentours(val) {
  alentours.rayon = parseInt(val);
  var km = (alentours.rayon / 1000).toFixed(1);
  document.getElementById('al-rayon-txt').textContent = km.replace('.0', '') + ' km';
  /* Relancer la recherche */
  alentours.resultats = [];
  rechercherAlentours();
}

/* ── Construit la requête Overpass ── */
function buildOverpassQuery(lat, lng, rayon, sousType) {
  var tags = OSM_TAGS[sousType] || OSM_TAGS['_default'];
  var around = 'around:' + rayon + ',' + lat + ',' + lng;
  var queries = tags.map(function(tag) {
    var filter = tag.value === '*'
      ? '[' + tag.key + ']'
      : '[' + tag.key + '="' + tag.value + '"]';
    return (
      'node' + filter + '(' + around + ');' +
      'way'  + filter + '(' + around + ');' +
      'relation' + filter + '(' + around + ');'
    );
  }).join('');
  return '[out:json][timeout:15];(' + queries + ');out center 50;';
}

/* ── Calcule la distance entre deux points (formule haversine) ── */
function distanceKm(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── Lance la recherche via Overpass ── */
function rechercherAlentours() {
  if (!A.position) return;
  var sousType = A.sousType || '_default';

  alentours.enCours = true;
  var liste = document.getElementById('alentours-liste');
  liste.innerHTML =
    '<div class="al-loading"><div class="al-spinner"></div>Recherche en cours sur OpenStreetMap…</div>';

  var query = buildOverpassQuery(A.position.lat, A.position.lng, alentours.rayon, sousType);
  var url   = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

  fetch(url)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      alentours.enCours  = false;
      alentours.resultats = data.elements || [];
      afficherResultatsAlentours();
    })
    .catch(function(err) {
      alentours.enCours = false;
      console.warn('Overpass error:', err);
      liste.innerHTML =
        '<div class="al-empty">⚠ Impossible de joindre OpenStreetMap.<br/>Vérifiez votre connexion et réessayez.</div>';
    });
}

/* ── Affiche les résultats sur le panneau et la carte ── */
function afficherResultatsAlentours() {
  var liste    = document.getElementById('alentours-liste');
  var elements = alentours.resultats;
  var typeInfo = TYPES.find(function(t){ return t.id === A.typeProjet; });
  var stList   = SOUS_TYPES[A.typeProjet] || [];
  var stInfo   = stList.find(function(s){ return s.id === A.sousType; });
  var label    = stInfo ? stInfo.label : (typeInfo ? typeInfo.label : 'Projet');

  /* Supprimer l'ancienne couche carte */
  if (alentours.layer) { A.carte.removeLayer(alentours.layer); alentours.layer = null; }

  /* Si aucun résultat */
  if (elements.length === 0) {
    liste.innerHTML =
      '<div class="al-empty">🔍 Aucun établissement du type<br/><strong>' + label + '</strong><br/>trouvé dans un rayon de ' +
      (alentours.rayon / 1000).toFixed(1).replace('.0','') + ' km.</div>';
    return;
  }

  /* Trier par distance */
  var enrichis = elements.map(function(el) {
    var lat = el.lat || (el.center && el.center.lat) || 0;
    var lng = el.lon || (el.center && el.center.lon) || 0;
    var dist = distanceKm(A.position.lat, A.position.lng, lat, lng);
    var nom  = el.tags && (el.tags.name || el.tags['name:fr']) || null;
    return { el: el, lat: lat, lng: lng, dist: dist, nom: nom };
  }).filter(function(e) { return e.lat !== 0; })
    .sort(function(a, b) { return a.dist - b.dist; });

  /* Limiter à 30 résultats */
  var affiches = enrichis.slice(0, 30);

  /* Badge compteur */
  liste.innerHTML =
    '<div class="al-count-badge">📍 ' + affiches.length +
    (enrichis.length > 30 ? '+' : '') +
    ' ' + label + ' dans un rayon de ' +
    (alentours.rayon / 1000).toFixed(1).replace('.0','') + ' km</div>';

  /* Créer la couche Leaflet */
  var markerGroup = L.layerGroup();

  affiches.forEach(function(item, idx) {
    var nom   = item.nom || label + ' #' + (idx + 1);
    var distStr = item.dist < 1
      ? Math.round(item.dist * 1000) + ' m'
      : item.dist.toFixed(1) + ' km';
    var type_detail = '';
    if (item.el.tags) {
      var t = item.el.tags;
      type_detail = t.amenity || t.shop || t.landuse || t.leisure || t.building || t.office || '';
    }

    /* Item panneau */
    var div = document.createElement('div');
    div.className = 'al-item';
    div.innerHTML =
      '<div class="al-item-dot"></div>' +
      '<div class="al-item-body">' +
        '<div class="al-item-nom">' + nom + '</div>' +
        (type_detail ? '<div class="al-item-meta">' + type_detail + '</div>' : '') +
        '<div class="al-item-dist">📍 ' + distStr + '</div>' +
      '</div>';

    /* Clic → centrer la carte sur cet item */
    (function(lat, lng, n) {
      div.addEventListener('click', function() {
        A.carte.setView([lat, lng], 16, { animate: true });
      });
    })(item.lat, item.lng, nom);

    liste.appendChild(div);

    /* Marqueur sur la carte */
    if (item.lat && item.lng) {
      var icon = L.divIcon({
        className: 'al-marker-label',
        html:
          '<div style="' +
            'background:#0369a1;' +
            'border:2px solid #fff;' +
            'border-radius:50%;' +
            'width:12px;height:12px;' +
            'box-shadow:0 1px 4px rgba(0,0,0,.4);' +
          '"></div>',
        iconSize:   [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([item.lat, item.lng], { icon: icon })
        .bindTooltip(
          '<b>' + nom + '</b>' +
          '<br/><small>' + distStr + ' de votre projet</small>',
          { className: 'commune-tooltip', direction: 'top' }
        )
        .addTo(markerGroup);
    }
  });

  alentours.layer = markerGroup.addTo(A.carte);
}

/* ── Affiche la section alentours après analyse ── */
function afficherAlentours() {
  document.getElementById('section-alentours').style.display = 'block';
  /* Réinitialiser pour relancer la recherche si sousType ou position ont changé */
  alentours.resultats = [];
  alentours.enCours   = false;
  /* Si le panneau était déjà ouvert, relancer la recherche */
  if (alentours.ouvert) {
    rechercherAlentours();
  }
}

/* ── DÉTECTION SPATIALE — utilitaires géo
   Deux systèmes coexistent : pointInPolygon (ancien) + pointDansPolygone (nouveau) */


/* ── Point-in-polygon (algorithme ray casting) ── */
function pointInPolygon(lat, lng, polygonCoords) {
  /* polygonCoords = [[lng, lat], ...] (format GeoJSON) */
  var inside = false;
  var x = lng, y = lat;
  var n = polygonCoords.length;
  for (var i = 0, j = n - 1; i < n; j = i++) {
    var xi = polygonCoords[i][0], yi = polygonCoords[i][1];
    var xj = polygonCoords[j][0], yj = polygonCoords[j][1];
    var intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** @deprecated Utiliser distanceKm() */
function distLatLng(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
    Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── Teste si le projet est dans/proche d'une feature ── */
function projetDansFeature(lat, lng, feature, rayonM) {
  var geom = feature.geometry;
  if (!geom) return false;

  if (geom.type === 'Polygon') {
    /* Extérieur du polygone */
    var ring = geom.coordinates[0];
    return pointInPolygon(lat, lng, ring);
  }

  if (geom.type === 'Point') {
    if (!rayonM || rayonM <= 0) return false;
    var dist = distLatLng(lat, lng, geom.coordinates[1], geom.coordinates[0]);
    return dist * 1000 <= rayonM;
  }

  if (geom.type === 'LineString') {
    if (!rayonM || rayonM <= 0) return false;
    /* Distance point-à-segment pour chaque segment */
    var coords = geom.coordinates;
    for (var k = 0; k < coords.length - 1; k++) {
      var d = distPointSegment(lat, lng,
        coords[k][1], coords[k][0],
        coords[k+1][1], coords[k+1][0]);
      if (d * 1000 <= rayonM) return true;
    }
    return false;
  }
  return false;
}

/* Distance point-à-segment (résultat en km) */
function distPointSegment(px, py, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay;
  var lenSq = dx*dx + dy*dy;
  var t = lenSq > 0 ? ((px-ax)*dx + (py-ay)*dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  return distLatLng(px, py, ax + t*dx, ay + t*dy);
}

/* ══════════════════════════════════════════════════════════════════════════════
   AXES MAJEURS — Détection proximité autoroutes, nationales, ferroviaire
   Influence : enjeux, contacts, checklist, simulation, rapport
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── 1. DÉTECTION ─────────────────────────────────────────────────────────── */
function detecterAxesMajeurs(lat, lng) {
  var res = { aProximite: false, autoroutes: [], nationales: [], ferroviaire: [] };
  if (!COUCHES_DATA || !lat || !lng) return res;

  var seuils = { autoroute: 500, nationale: 300, ferroviaire: 500 };
  var typesAxes = {
    autoroute:   ['autoroute'],
    nationale:   ['nationale'],
    ferroviaire: ['TGV', 'TER'],
  };

  Object.keys(typesAxes).forEach(function(axe) {
    var types = typesAxes[axe];
    var seuil = seuils[axe];
    var sources = [COUCHES_DATA['organisation'], COUCHES_DATA['mobilite']];
    sources.forEach(function(couche) {
      if (!couche || !couche.features) return;
      couche.features.forEach(function(f) {
        var ftype = f.properties && f.properties.type;
        if (types.indexOf(ftype) === -1) return;
        if (featureContientPoint(f, lat, lng, seuil)) {
          var nom = f.properties.nom || ftype;
          var liste = res[axe === 'ferroviaire' ? 'ferroviaire' : axe + 's'];
          if (liste && !liste.some(function(x){ return x.nom === nom; })) {
            liste.push({ nom: nom, type: ftype, dist: seuil });
          }
        }
      });
    });
  });

  res.aProximite = res.autoroutes.length > 0 || res.nationales.length > 0 || res.ferroviaire.length > 0;
  return res;
}

/* ── 2. ENJEUX CONTEXTUELS ────────────────────────────────────────────────── */
function genererEnjeuxAxesMajeurs(axesMajeurs, taille, typeProjet) {
  var enjeux = [];
  if (!axesMajeurs || !axesMajeurs.aProximite) return enjeux;
  var typesLogement = ['logement', 'equipement', 'zae', 'friche'];

  /* Autoroute < 500m */
  if (axesMajeurs.autoroutes.length > 0 && typesLogement.indexOf(typeProjet) !== -1) {
    enjeux.push({
      id: 'axe-autoroute-bruit', nom: 'Autoroute à proximité — Bruit et pollution',
      ico: '🛣', niv: 'eleve', tmin: 1, _transport_ctx: true,
      axes: {
        environnement: {
          facteurs: [
            'Projet à moins de 500 m d\'une autoroute (' + axesMajeurs.autoroutes.map(function(a){return a.nom;}).join(', ') + ')',
            'Niveaux sonores Lden > 68 dB(A) en façade côté autoroute — catégorie 1 du classement sonore',
            'Concentrations en NO2, PM10, PM2.5 dépassant les valeurs guides OMS à moins de 300 m',
          ],
          consequences: [
            'Isolation acoustique DnT,A ≥ 40 dB(A) obligatoire (arrêté du 25/04/2003)',
            'Qualité de l\'air intérieur dégradée sans ventilation double flux avec filtration',
            'Dépréciation de 5 à 15 % de la valeur vénale des biens côté autoroute',
          ],
        },
        economique: {
          facteurs: [
            'Surcoût isolation acoustique renforcée : 8 000 à 25 000 € selon surface',
            'VMC double flux avec filtration HEPA recommandée : 4 000 à 9 000 €',
            'Étude acoustique obligatoire avant dépôt PC (logements et ERP)',
          ],
          consequences: [
            'Renchérissement global du projet de 3 à 10 %',
            'Attestation acoustique à joindre au PC — absence = refus',
            'Surprime assurance habitation en zone de bruit',
          ],
        },
        politique: {
          facteurs: [
            'Classement sonore opposable : arrêté préfectoral annexé au PLU',
            'Décret 2011-604 : attestation acoustique obligatoire pour les logements neufs',
            'Plan de Prévention du Bruit dans l\'Environnement (PPBE) applicable',
          ],
          consequences: [
            'PC refusé sans attestation acoustique conforme',
            'Consultation obligatoire de la DIR Est pour tout accès sur autoroute',
            'Obligation d\'information des futurs acquéreurs sur le classement sonore',
          ],
        },
        social: {
          facteurs: [
            'Exposition chronique au bruit autoroutier : risque cardiovasculaire + 20 % (OMS)',
            'Perturbation du sommeil et des apprentissages pour les enfants riverains',
          ],
          consequences: [
            'Obligation de conception bioclimatique : pièces de vie côté calme',
            'Qualité de vie dégradée si isolation insuffisante',
          ],
        },
      },
      actions: [
        'Commander une étude acoustique dès l\'avant-projet (bureau agréé)',
        'Orienter les pièces de vie côté opposé à l\'autoroute',
        'Installer une VMC double flux avec filtre HEPA',
        'Contacter la DIR Est : 03 88 13 60 00 pour tout projet d\'accès',
        'Vérifier le classement sonore dans l\'annexe bruit du PLU',
      ],
      refs: [{ n: 'C82', t: 'Flux véhicules' }, { n: 'C84', t: 'Carte bruit' }, { n: 'C85', t: 'Classement sonore' }],
    });
  }

  /* Nationale < 300m */
  if (axesMajeurs.nationales.length > 0 && typesLogement.indexOf(typeProjet) !== -1) {
    enjeux.push({
      id: 'axe-nationale-trafic', nom: 'Route nationale — Trafic et qualité de l\'air',
      ico: '🛤', niv: 'moyen', tmin: 1, _transport_ctx: true,
      axes: {
        environnement: {
          facteurs: [
            'Projet à moins de 300 m d\'une route nationale (' + axesMajeurs.nationales.map(function(a){return a.nom;}).join(', ') + ')',
            'Axe à fort trafic (>20 000 veh/j) — émissions NO2 et PM significatives',
            'Classement sonore catégorie 2 ou 3 selon le trafic',
          ],
          consequences: [
            'Isolation acoustique DnT,A ≥ 35 à 38 dB(A) selon la catégorie',
            'Ventilation double flux recommandée pour la qualité de l\'air intérieur',
          ],
        },
        economique: {
          facteurs: [
            'Surcoût isolation acoustique : 4 000 à 15 000 €',
            'Étude acoustique recommandée en phase esquisse',
          ],
          consequences: [
            'Impact modéré sur la valeur vénale côté nationale (2 à 8 %)',
          ],
        },
        politique: {
          facteurs: [
            'Classement sonore arrêté préfectoral opposable',
            'Consultation DDT 90 mobilités pour les accès sur voie nationale',
          ],
          consequences: [
            'Attestation acoustique requise pour les logements',
            'Accord du gestionnaire voirie requis pour tout accès direct',
          ],
        },
        social: {
          facteurs: [
            'Nuisances sonores diurnes et nocturnes pour les futurs occupants',
          ],
          consequences: [
            'Conception bioclimatique : baies vitrées et terrasses côté calme',
          ],
        },
      },
      actions: [
        'Vérifier le classement sonore de la voie (annexe PLU)',
        'Réaliser une étude acoustique avant le dépôt du PC',
        'Consulter DDT 90 — mobilités pour l\'accès sur voie nationale',
        'Prévoir une VMC double flux si trafic > 20 000 veh/j',
      ],
      refs: [{ n: 'C82', t: 'Flux véhicules' }, { n: 'C84', t: 'Carte bruit' }],
    });
  }

  /* Ferroviaire < 500m */
  if (axesMajeurs.ferroviaire.length > 0 && typesLogement.indexOf(typeProjet) !== -1) {
    enjeux.push({
      id: 'axe-ferroviaire-nuisances', nom: 'Axe ferroviaire — Nuisances et sécurité',
      ico: '🚆', niv: 'moyen', tmin: 1, _transport_ctx: true,
      axes: {
        environnement: {
          facteurs: [
            'Projet à moins de 500 m d\'une voie ferrée (' + axesMajeurs.ferroviaire.map(function(a){return a.nom;}).join(', ') + ')',
            'Vibrations et bruit de roulement transmis au bâtiment selon la nature des sols',
            'Classement sonore ferroviaire catégorie 1 si LGV, 2 ou 3 si ligne régionale',
          ],
          consequences: [
            'Isolation vibratoire et acoustique nécessaire selon la distance',
            'Risque de tassement différentiel des fondations si sols meubles',
          ],
        },
        economique: {
          facteurs: [
            'Surcoût isolation acoustique et vibratoire : 5 000 à 20 000 €',
            'Étude de sol recommandée si voie ferrée < 100 m (vibrations)',
          ],
          consequences: [
            'Dépréciation possible de 3 à 8 % selon intensité du trafic ferroviaire',
          ],
        },
        politique: {
          facteurs: [
            'Servitude ferroviaire I1 : inconstructibilité dans un périmètre variable',
            'Consultation SNCF Réseau obligatoire si projet dans la bande de sécurité',
            'Plan d\'Exposition au Bruit (PEB) ferroviaire si LGV présente',
          ],
          consequences: [
            'Accord préalable SNCF Réseau requis pour construire près des voies',
            'Délai d\'instruction majoré si servitude ferroviaire applicable',
          ],
        },
        social: {
          facteurs: [
            'Nuisances sonores variables selon les horaires de circulation',
            'Vibrations transmises ressenties jusqu\'à 100-200 m selon les sols',
          ],
          consequences: [
            'Gêne nocturne si circulation de trains de fret',
          ],
        },
      },
      actions: [
        'Vérifier l\'existence d\'une servitude ferroviaire I1 sur la parcelle',
        'Contacter SNCF Réseau pour les projets à moins de 100 m des voies',
        'Commander une étude de vibrations si distance < 50 m',
        'Vérifier le classement sonore ferroviaire dans l\'annexe PLU',
      ],
      refs: [{ n: 'C84', t: 'Carte bruit' }, { n: 'C85', t: 'Classement sonore' }],
    });
  }

  return enjeux;
}

/* ── 3. CONTACTS ──────────────────────────────────────────────────────────── */
function injecterContactsAxesMajeurs(axesMajeurs) {
  if (!axesMajeurs || !axesMajeurs.aProximite) return;
  var ctx = document.getElementById('contacts-ctx');
  if (!ctx) return;

  var html = '<div class="contact-groupe"><div class="contact-groupe-titre"><span class="groupe-ico">🛣</span><span>Axes de transport à proximité</span></div>';

  /* DIR Est — autoroutes et nationales */
  if (axesMajeurs.autoroutes.length > 0 || axesMajeurs.nationales.length > 0) {
    var axes = axesMajeurs.autoroutes.concat(axesMajeurs.nationales).map(function(a){return a.nom.split(' ')[0];}).join(', ');
    html +=
      '<div class="contact-card">' +
        '<div class="contact-nom">DIR Est — Voies rapides</div>' +
        '<div class="contact-role">Gestionnaire autoroutes et routes nationales (' + axes + '). Toute création d\'accès ou projet à < 500 m nécessite son accord.</div>' +
        '<div class="contact-coords">' +
          '<span>📞 03 88 13 60 00</span>' +
          '<span>🌐 <a href="https://www.dir.est.developpement-durable.gouv.fr" target="_blank">dir.est.developpement-durable.gouv.fr</a></span>' +
        '</div>' +
        '<div class="contact-priorite obligatoire">Consultation obligatoire</div>' +
      '</div>';
  }

  /* SNCF Réseau — ferroviaire */
  if (axesMajeurs.ferroviaire.length > 0) {
    var lignes = axesMajeurs.ferroviaire.map(function(a){return a.nom.split(' ')[0];}).join(', ');
    html +=
      '<div class="contact-card">' +
        '<div class="contact-nom">SNCF Réseau — Proximité voies ferrées</div>' +
        '<div class="contact-role">Gestionnaire infrastructure ferroviaire (' + lignes + '). Accord requis pour tout projet dans la bande de sécurité (servitude I1).</div>' +
        '<div class="contact-coords">' +
          '<span>📞 3635</span>' +
          '<span>🌐 <a href="https://www.sncf-reseau.com" target="_blank">sncf-reseau.com</a></span>' +
        '</div>' +
        '<div class="contact-priorite recommande">Recommandé si < 100 m</div>' +
      '</div>';
  }

  /* DDT 90 Mobilités */
  html +=
    '<div class="contact-card">' +
      '<div class="contact-nom">DDT 90 — Pôle Mobilités</div>' +
      '<div class="contact-role">Instruction des dossiers d\'accès sur voies nationales, coordination avec DIR Est, avis sur les projets générateurs de trafic dans le 90.</div>' +
      '<div class="contact-coords">' +
        '<span>📞 03 84 58 86 00</span>' +
        '<span>✉ ddt-90@territoire-de-belfort.gouv.fr</span>' +
      '</div>' +
      '<div class="contact-priorite recommande">Recommandé</div>' +
    '</div>';

  /* ATMO BFC — qualité de l'air */
  if (axesMajeurs.autoroutes.length > 0 || axesMajeurs.nationales.length > 0) {
    html +=
      '<div class="contact-card">' +
        '<div class="contact-nom">ATMO BFC — Qualité de l\'air</div>' +
        '<div class="contact-role">Carte stratégique de l\'air, mesures NO2/PM aux abords des axes routiers à fort trafic. Données essentielles pour les études d\'impact air.</div>' +
        '<div class="contact-coords">' +
          '<span>🌐 <a href="https://www.atmo-bfc.org" target="_blank">atmo-bfc.org</a></span>' +
        '</div>' +
        '<div class="contact-priorite optionnel">Optionnel</div>' +
      '</div>';
  }

  html += '</div>';

  /* Insérer AVANT les autres groupes de contacts */
  ctx.insertAdjacentHTML('afterbegin', html);
}

/* ── 4. CHECKLIST ─────────────────────────────────────────────────────────── */
function injecterChecklistAxesMajeurs(axesMajeurs, typeProjet) {
  if (!axesMajeurs || !axesMajeurs.aProximite) return;
  var body = document.getElementById('checklist-body');
  if (!body) return;

  var items = [];

  /* Étude acoustique — autoroute ou nationale */
  if (axesMajeurs.autoroutes.length > 0 || axesMajeurs.nationales.length > 0) {
    items.push({
      ico: '🔊', label: 'Étude acoustique préalable au PC',
      desc: 'Obligatoire pour tout logement ou ERP à proximité d\'un axe classé. Réalisée par un bureau d\'études agréé. Atteste le respect des objectifs d\'isolation (DnT,A). Doit être jointe au dossier PC.',
      delai: 'Avant dépôt PC', oblig: true,
    });
    items.push({
      ico: '📋', label: 'Attestation acoustique (Cerfa)',
      desc: 'Document attestant la prise en compte du classement sonore dans la conception du projet. Obligatoire pour les logements neufs (décret 2011-604). Signée par le maître d\'œuvre.',
      delai: 'Joint au PC', oblig: true,
    });
  }

  /* Consultation DIR Est — autoroute */
  if (axesMajeurs.autoroutes.length > 0) {
    items.push({
      ico: '🛣', label: 'Consultation DIR Est',
      desc: 'Obligatoire pour tout accès nouveau sur autoroute ou projet à moins de 500 m. La DIR Est vérifie la compatibilité avec les règles d\'accessibilité et de sécurité autoroutière.',
      delai: 'Avant PC', oblig: true,
    });
    items.push({
      ico: '🌬', label: 'Étude impact qualité de l\'air',
      desc: 'Recommandée pour les logements à moins de 300 m d\'une autoroute. Utilise les données ATMO BFC (carte stratégique air). Justifie le choix d\'une VMC double flux avec filtration.',
      delai: 'Phase APS', oblig: false,
    });
  }

  /* Consultation SNCF Réseau — ferroviaire */
  if (axesMajeurs.ferroviaire.length > 0) {
    items.push({
      ico: '🚆', label: 'Vérification servitude ferroviaire I1',
      desc: 'La servitude I1 interdit ou limite les constructions à proximité des voies SNCF. Vérifier au PLU (annexe servitudes) et consulter SNCF Réseau si projet dans la bande de sécurité.',
      delai: 'Avant PC', oblig: true,
    });
  }

  /* VMC double flux — si axe fort */
  if (axesMajeurs.autoroutes.length > 0) {
    items.push({
      ico: '🔄', label: 'VMC double flux avec filtration',
      desc: 'Recommandée pour tout logement ou ERP à moins de 300 m d\'une autoroute. Filtre les particules fines (PM2.5) et le NO2. Justifier dans la notice descriptive du PC.',
      delai: 'Phase DCE', oblig: false,
    });
  }

  if (items.length === 0) return;

  var section = document.createElement('div');
  section.className = 'chk-section';
  section.innerHTML =
    '<div class="chk-section-titre">🛣 Axes de transport à proximité</div>' +
    items.map(function(it) {
      return '<div class="chk-item' + (it.oblig ? ' chk-obligatoire' : '') + '">' +
        '<span class="chk-ico">' + it.ico + '</span>' +
        '<div class="chk-content">' +
          '<div class="chk-label">' + it.label + (it.oblig ? ' <span class="chk-badge-oblig">Obligatoire</span>' : '') + '</div>' +
          '<div class="chk-desc">' + it.desc + '</div>' +
          '<div class="chk-delai">⏱ ' + it.delai + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

  /* Insérer en tête de checklist */
  body.insertBefore(section, body.firstChild);
}

/* ── 5. MODIFICATEURS SIMULATION ─────────────────────────────────────────── */
function modificateursSimulationAxesMajeurs(axesMajeurs) {
  var mod = { dureeDelta: 0, complexDelta: 0, impactDelta: 0, alertes: [] };
  if (!axesMajeurs || !axesMajeurs.aProximite) return mod;

  if (axesMajeurs.autoroutes.length > 0) {
    mod.dureeDelta   += 2;   /* +2 mois : étude acoustique + consultation DIR */
    mod.complexDelta += 10;  /* complexité accrue : accès, bruit, air */
    mod.impactDelta  += 8;   /* impact environnemental : pollution, bruit */
    mod.alertes.push('Autoroute à proximité : étude acoustique et consultation DIR Est obligatoires (+2 mois)');
  }
  if (axesMajeurs.nationales.length > 0) {
    mod.dureeDelta   += 1;
    mod.complexDelta += 5;
    mod.impactDelta  += 4;
    mod.alertes.push('Route nationale à proximité : attestation acoustique requise (+1 mois)');
  }
  if (axesMajeurs.ferroviaire.length > 0) {
    mod.dureeDelta   += 1;
    mod.complexDelta += 6;
    mod.impactDelta  += 5;
    mod.alertes.push('Axe ferroviaire à proximité : vérification servitude I1 SNCF (+1 mois)');
  }
  return mod;
}


lancerAnalyse = function() {

  /* ── Vérifications préalables ── */
  if (!A.typeProjet) {
    alert("Selectionnez d'abord un type de projet.");
    return;
  }
  if (!A.position) {
    var msgP = document.getElementById('placement-requis');
    if (msgP) { msgP.classList.add('on'); msgP.scrollIntoView({ behavior:'smooth', block:'center' }); }
    var btnP = document.getElementById('btn-placer');
    if (btnP) { btnP.style.boxShadow = '0 0 0 4px rgba(234,88,12,.35)'; setTimeout(function(){ btnP.style.boxShadow=''; }, 2000); }
    return;
  }
  var msgR = document.getElementById('placement-requis');
  if (msgR) msgR.classList.remove('on');

  /* ÉTAPE 1 — Détection géographique des zones sensibles */
  var zonesResultats = detecterZones(A.position.lat, A.position.lng, A.typeProjet);

  /* Set des types de zones géographiques détectées pour le projet */
  var zonesActives = new Set();
  zonesResultats.forEach(function(res) {
    res.zones.forEach(function(z) { zonesActives.add(z.type); });
  });

  /* ÉTAPE 1b — Détection des zones agricoles (si projet agriculture) */
  /* Détection zones agricoles pour TOUS les types de projets :
     une ZAE, un logement ou une friche en zone nitrates/région agricole
     a des enjeux spécifiques (CDPENAF, plan de fumure, AOP...). */
  A._zonesAgri = null;
  if (A.position) {
    A._zonesAgri = detecterZonesAgricoles(A.position.lat, A.position.lng);
    A._zonesAgri.forEach(function(z) { zonesActives.add(z.type); });
  }

  A._axesMajeurs=detecterAxesMajeurs(A.position.lat,A.position.lng);
  /* ÉTAPE 2 — Filtrage des enjeux de base */
  var tous = ENJEUX[A.typeProjet] || [];
  var filtres = tous.filter(function(e) {
    /* Filtre envergure */
    if (e.tmin > A.taille) return false;
    /* Filtre zones : si zones_requises est null → toujours affiché */
    if (!e.zones_requises || e.zones_requises.length === 0) return true;
    /* Sinon : n'afficher que si le projet est dans une zone requise */
    return e.zones_requises.some(function(z) { return zonesActives.has(z); });
  });

  /* ÉTAPE 3 — Enjeux contextuels (ENJEUX_ZONES) */
  zonesResultats.forEach(function(res) {
    var ez = res.enjeu;
    if (ez.tmin > A.taille) return;
    var dejaPresent = filtres.some(function(e) { return e.id === ez.id; });
    if (!dejaPresent) filtres.push(ez);
  });

  /* ── Enjeux agricoles contextuels (zones nitrates, humides, région agri) ── */
  if (A._zonesAgri && A._zonesAgri.length > 0) {
    var enjeuxAgri = genererEnjeuxAgricoles(A._zonesAgri, A.taille, A.typeProjet);
    enjeuxAgri.forEach(function(e) {
      var dejaPresent = filtres.some(function(f) { return f.id === e.id; });
      if (!dejaPresent) filtres.push(e);
    });
  }

  if(A._axesMajeurs&&A._axesMajeurs.aProximite){var eA=genererEnjeuxAxesMajeurs(A._axesMajeurs,A.taille,A.typeProjet);eA.forEach(function(e){if(!filtres.some(function(f){return f.id===e.id;}))filtres.push(e);});}
  /* ── Tri : enjeux contextuels en tête, puis par niveau ── */
  var ord = { eleve: 0, moyen: 1, faible: 2 };
  filtres.sort(function(a, b) {
    var aZ = a.contexte_zone ? 0 : 1;
    var bZ = b.contexte_zone ? 0 : 1;
    if (aZ !== bZ) return aZ - bZ;
    return (ord[a.niv] || 2) - (ord[b.niv] || 2);
  });

  /* ── Mise à jour en-tête ── */
  var t = TYPES.find(function(x) { return x.id === A.typeProjet; });
  document.querySelector('#enjeux-hdr h2').textContent = 'Enjeux \u2014 ' + (t ? t.label : '');

  var nZones = zonesResultats.length;
  var infos  = [filtres.length + ' enjeu(x)', TAILLES[A.taille].nom];
  if (A.superficieHa) infos.push(A.superficieHa.toFixed(2) + ' ha');
  if (nZones > 0)     infos.push(nZones + ' zone(s) d\u00e9tect\u00e9e(s)');
  document.getElementById('enjeux-sous-titre').textContent = infos.join(' \u00B7 ');

  /* ── Affichage ── */
  document.getElementById('msg-accueil').style.display = 'none';
  var liste = document.getElementById('liste-enjeux');
  liste.style.display = 'flex';
  liste.innerHTML = '';

  if (filtres.length === 0) {
    liste.innerHTML =
      '<div style="text-align:center;padding:32px 20px;color:var(--ink-3);">' +
        '<div style="font-size:2.2rem;margin-bottom:12px;">\u2705</div>' +
        '<p style="font-size:.82rem;line-height:1.6;">Aucun enjeu d\u00e9tect\u00e9 pour ce type de projet \u00e0 cet emplacement.</p>' +
      '</div>';
    afficherContacts();
    afficherChecklist();
    afficherAlentours();
    return;
  }

  /* Accordéon rouge des contraintes géographiques (si zones détectées) */
  if (zonesResultats.length > 0) {
    rendreAccordeonZones(zonesResultats, liste);
  }

  /* 4 accordéons thématiques */
  rendreAccordeons(filtres, liste);

  /* Sections post-analyse */
  afficherContacts();
  afficherChecklist();
  afficherAlentours();
  if(A._axesMajeurs&&A._axesMajeurs.aProximite){injecterContactsAxesMajeurs(A._axesMajeurs);injecterChecklistAxesMajeurs(A._axesMajeurs,A.typeProjet);}
  /* Stocker les données pour le rapport (bouton header) */
  A._lastFiltres        = filtres;
  A._lastZonesResultats = zonesResultats;
  var btnRap = document.getElementById('btn-rapport');
  if (btnRap) { btnRap.disabled = false; btnRap.style.opacity = '1'; }

  /* ── Interrogation RPG IGN (asynchrone) ─────────────────────────────
     Requête WFS Géoplateforme : détecte si le projet est posé sur
     une parcelle agricole déclarée PAC (LANDUSE.AGRICULTURE2024).
     Injecte un bandeau, des contacts et des étapes checklist dédiés
     APRÈS le rendu synchrone de l'analyse, sans bloquer l'UI.          */
  A._rpgParcelle = null;
  var _rpgLat = A.position.lat, _rpgLng = A.position.lng;
  var rpgSpin = document.getElementById('rpg-spinner');
  if (rpgSpin) rpgSpin.style.display = 'inline-block';

  interrogerRPG(_rpgLat, _rpgLng)
    .then(function(props) {
      if (rpgSpin) rpgSpin.style.display = 'none';
      /* Ignorer si le projet a été déplacé entre-temps */
      if (A.position && A.position.lat === _rpgLat && A.position.lng === _rpgLng) {
        appliquerRPG(props);
      }
    })
    .catch(function() {
      if (rpgSpin) rpgSpin.style.display = 'none';
    });
};

/* ── DÉTECTION DE ZONES — moteur géodétection (ENJEUX_ZONES × COUCHES_DATA)
   detecterZones() → zonesResultats[] → injectés dans lancerAnalyse()    */

/* Base de données des enjeux conditionnels par zone
   Chargée depuis enjeux-zones.json puis embarquée ici */
/* ENJEUX_ZONES embarqués (compatibilité file:// et HTTP)
   Source canonique : enjeux-zones.json */


function loadEnjeuxZones() {
  return fetch('enjeux-zones.json')
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if (d && d.length > 0) ENJEUX_ZONES = d; })
    .catch(function(){});
}

/* ── Point-in-Polygon : rayon de Casteljau ──────────────────────
   Retourne true si le point (lat,lng) est à l'intérieur du polygon.
   Le polygon est au format GeoJSON [[[lng,lat],...]] */
function pointDansPolygone(lat, lng, polygonCoords) {
  var ring = polygonCoords[0];  /* anneau extérieur */
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var xi = ring[i][0], yi = ring[i][1];
    var xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/* ── Distance approximative (mètres) entre deux points ─────────
   Formule haversine simplifiée, précision suffisante pour < 50 km */
function distanceMetres(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
    Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── Distance d'un point à un segment (pour LineStrings) ────── */
function distancePointSegment(px, py, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return distanceMetres(py, px, ay, ax);
  var t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / (dx*dx+dy*dy)));
  return distanceMetres(py, px, ay+t*dy, ax+t*dx);
}

/* ── Teste si un point est dans ou à proximité d'une feature ───
   Gère Polygon, MultiPolygon, LineString, MultiLineString, Point */
function featureContientPoint(feature, lat, lng, rayon) {
  var geom = feature.geometry;
  if (!geom) return false;
  var type = geom.type;
  var coords = geom.coordinates;

  if (type === 'Polygon') {
    if (pointDansPolygone(lat, lng, coords)) return true;
    if (rayon > 0) {
      /* Vérifier aussi la distance aux bords */
      for (var i = 0; i < coords[0].length-1; i++) {
        var d = distancePointSegment(lng,lat, coords[0][i][0],coords[0][i][1], coords[0][i+1][0],coords[0][i+1][1]);
        if (d <= rayon) return true;
      }
    }
    return false;
  }

  if (type === 'MultiPolygon') {
    return coords.some(function(poly) {
      if (pointDansPolygone(lat, lng, poly)) return true;
      if (rayon > 0) {
        for (var i = 0; i < poly[0].length-1; i++) {
          var d = distancePointSegment(lng,lat, poly[0][i][0],poly[0][i][1], poly[0][i+1][0],poly[0][i+1][1]);
          if (d <= rayon) return true;
        }
      }
      return false;
    });
  }

  if (type === 'LineString') {
    var effectif = Math.max(rayon, 1);
    for (var i = 0; i < coords.length-1; i++) {
      if (distancePointSegment(lng,lat, coords[i][0],coords[i][1], coords[i+1][0],coords[i+1][1]) <= effectif)
        return true;
    }
    return false;
  }

  if (type === 'MultiLineString') {
    var effectif = Math.max(rayon, 1);
    return coords.some(function(line){
      for (var i = 0; i < line.length-1; i++) {
        if (distancePointSegment(lng,lat, line[i][0],line[i][1], line[i+1][0],line[i+1][1]) <= effectif)
          return true;
      }
      return false;
    });
  }

  if (type === 'Point') {
    var effectif = Math.max(rayon, 100);  /* 100m minimum pour les points */
    return distanceMetres(lat, lng, coords[1], coords[0]) <= effectif;
  }

  return false;
}

/* ── Détecte les zones actives pour une position donnée ─────────
   Retourne un tableau d'objets { enjeu, zonesDetectees } */

/* ── INTERROGATION RPG — WFS Géoplateforme IGN ────────────────────────────────
   Requête asynchrone : renvoie la feature RPG sous le point projet (ou null).
   Endpoint : data.geopf.fr/wfs/ows (accès libre, sans clé).
   TypeName  : LANDUSE.AGRICULTURE2024 (ou 2023 selon disponibilité).
   Résultat  : { code_cultu, libelle_groupe_culture, surf_ha } ou null.           */

/**
 * Interroge le WFS IGN Géoplateforme pour récupérer la parcelle RPG
 * sous le point (lat, lng). Requête CQL_FILTER=INTERSECTS sur le point.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<Object|null>} feature properties ou null
 */
function interrogerRPG(lat, lng) {
  /* Buffer ~10m en degrés pour éviter les ratés sur les bords de parcelle */
  var delta  = 0.0001;
  var minX   = (lng - delta).toFixed(6);
  var minY   = (lat - delta).toFixed(6);
  var maxX   = (lng + delta).toFixed(6);
  var maxY   = (lat + delta).toFixed(6);

  /* Essai sur AGRICULTURE2024, fallback AGRICULTURE2023 si indisponible */
  function fetchRPG(year) {
    var url = 'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0' +
      '&REQUEST=GetFeature' +
      '&TYPENAME=LANDUSE.AGRICULTURE' + year +
      '&OUTPUTFORMAT=application%2Fjson' +
      '&COUNT=1' +
      '&BBOX=' + minX + ',' + minY + ',' + maxX + ',' + maxY + ',EPSG:4326';

    return fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined })
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(data) {
        if (!data.features || data.features.length === 0) return null;
        return data.features[0].properties;
      });
  }

  return fetchRPG('2024').catch(function() {
    return fetchRPG('2023');
  }).catch(function(err) {
    console.warn('[DDT90] WFS RPG indisponible :', err.message);
    return null;
  });
}

/**
 * Enrichit A._rpgParcelle et déclenche l'injection RPG dans l'analyse.
 * Appelé depuis lancerAnalyse() après détection des zones atlas.
 * @param {Object|null} props — propriétés WFS de la parcelle RPG
 */
function appliquerRPG(props) {
  A._rpgParcelle = props;
  if (!props) return;

  /* Clés WFS IGN selon le millésime (2023 ou 2024) */
  var groupe  = props.libelle_groupe_culture || props.libel_group || '';
  var code    = props.code_cultu  || props.code_culture  || '';
  var surfHa  = parseFloat(props.surf_ha || props.contenance || 0);

  /* Stocker les infos normalisées pour le rapport et les enjeux */
  A._rpgParcelle._groupe  = groupe;
  A._rpgParcelle._code    = code;
  A._rpgParcelle._surfHa  = surfHa;

  /* ── Enrichissement du bandeau enjeux ── */
  var panel = document.getElementById('liste-enjeux');
  var old   = document.getElementById('rpg-bandeau');
  if (old) old.remove();

  if (!panel) return;

  var bandeau = document.createElement('div');
  bandeau.id  = 'rpg-bandeau';
  bandeau.className = 'rpg-bandeau';
  bandeau.innerHTML =
    '<span class="rpg-ico">🌾</span>' +
    '<span class="rpg-main">Parcelle RPG détectée : ' +
      '<strong>' + (groupe || code || 'Culture déclarée PAC') + '</strong>' +
      (surfHa > 0 ? ' — ' + surfHa.toFixed(1) + ' ha' : '') +
    '</span>' +
    '<span class="rpg-note">Source : IGN Géoplateforme — LANDUSE.AGRICULTURE' +
      (A._rpgAnnee || '2024') + '</span>';

  /* Insérer avant le premier accordéon */
  panel.insertBefore(bandeau, panel.firstChild);

  /* ── Contacts spécifiques RPG ── */
  injecterContactsRPG(groupe, code);

  /* ── Checklist RPG ── */
  injecterChecklistRPG(groupe, code);
}


/**
 * Injecte les contacts RPG dans le panneau contacts si le projet
 * est sur une parcelle agricole déclarée PAC.
 */
function injecterContactsRPG(groupe, code) {
  var liste = document.getElementById('contacts-liste');
  if (!liste) return;
  var old = document.getElementById('rpg-contacts');
  if (old) old.remove();

  var estSensible = RPG_GROUPES_SENSIBLES.some(function(g) {
    return groupe.toLowerCase().indexOf(g.toLowerCase()) >= 0;
  });
  if (!estSensible) return;

  var div = document.createElement('div');
  div.id  = 'rpg-contacts';

  /* Toujours : Chambre d\'Agriculture si parcelle PAC sensible */
  var contactsHtml = [
    creerCarteContactRPG(
      '🌾 Chambre d\'Agriculture du Territoire de Belfort',
      'Avis CDPENAF — déclaration de consommation de SAU',
      '03 84 57 83 83',
      'contact@haute-saone.chambagri.fr',
      'https://haute-saone.chambagri.fr',
      'Obligatoire'
    ),
    creerCarteContactRPG(
      '🏛 DDT 90 — Service Agriculture & Urbanisme',
      'Instruction CDPENAF, déclaration PAC, conditionnalité BCAE',
      '03 84 58 86 00',
      'ddt-agriculture@territoire-de-belfort.gouv.fr',
      'https://www.territoire-de-belfort.gouv.fr/DDT',
      'Obligatoire'
    ),
  ];

  contactsHtml.push(creerCarteContactRPG('&#x1F468;&#x200D;&#x1F33E; Agriculteur exploitant — '+(groupe||'Parcelle agricole'),'Exploitant RPG. Contacter pour négociation foncière. Coordonnées via Chambre d’Agriculture 90.','[À compléter]','[À compléter]','#','Obligatoire'));
  /* Si prairies permanentes : Agence de l\'eau */
  if (groupe.indexOf('Prair') >= 0 || groupe.indexOf('Estive') >= 0) {
    contactsHtml.push(creerCarteContactRPG(
      '💧 Agence de l\'eau Rhône Méditerranée Corse',
      'Préservation prairies permanentes — MAEC humides',
      '04 72 71 26 00',
      'communication@eaurmc.fr',
      'https://www.eaurmc.fr',
      'Recommandé'
    ));
  }

  div.innerHTML =
    '<div class="contacts-section-titre rpg-contact-hdr">🌾 Contacts — Parcelle agricole RPG détectée</div>' +
    contactsHtml.join('');

  liste.insertBefore(div, liste.firstChild);
}

function creerCarteContactRPG(nom, role, tel, email, url, prio) {
  var prioCls = prio === 'Obligatoire' ? 'prio-oblig' : 'prio-recom';
  return '<div class="contact-card">' +
    '<div class="cc-head"><span class="cc-nom">' + nom + '</span>' +
    '<span class="prio-badge ' + prioCls + '">' + prio + '</span></div>' +
    '<div class="cc-role">' + role + '</div>' +
    '<div class="cc-links">' +
      '<a href="tel:' + tel + '">' + tel + '</a>' +
      '<a href="mailto:' + email + '">' + email + '</a>' +
    '</div></div>';
}

/**
 * Injecte des étapes checklist spécifiques à la parcelle RPG détectée.
 */
function injecterChecklistRPG(groupe, code) {
  var body = document.getElementById('checklist-body');
  if (!body) return;
  var old = document.getElementById('rpg-checklist');
  if (old) old.remove();

  var estSensible = RPG_GROUPES_SENSIBLES.some(function(g) {
    return groupe.toLowerCase().indexOf(g.toLowerCase()) >= 0;
  });
  if (!estSensible) return;

  /* Étapes communes à toute consommation de parcelle PAC */
  var etapes = [
    { ico: '📋', label: 'Saisine CDPENAF obligatoire', desc: 'Avis de la Commission Départementale de Préservation des Espaces Naturels, Agricoles et Forestiers avant dépôt du permis.' },
    { ico: '🌾', label: 'Déclaration de consommation de SAU', desc: 'Surface agricole utile consommée à déclarer à la DDT 90 — suivi ZAN et objectifs SRADDET.' },
    { ico: '📊', label: 'Avis de la Chambre d\'Agriculture 90', desc: 'Consultation recommandée pour évaluer l\'impact sur l\'exploitation agricole concernée.' },
    { ico: '💰', label: 'Évaluation compensation agricole', desc: 'Si surface > 5 ha : étude préalable agricole (EPA) et mesures compensatoires (art. L112-1-3 code rural).' },
  ];

  /* Étapes spécifiques selon le groupe de culture */
  if (groupe.indexOf('Prair') >= 0) {
    etapes.push({ ico: '🌿', label: 'Vérification prairie permanente interdite', desc: 'Les prairies permanentes déclarées PAC sont protégées — retournement interdit sauf dérogation préfectorale.' });
  }
  if (groupe.indexOf('Maïs') >= 0 || groupe.indexOf('Mas') >= 0 || groupe.indexOf('céréales') >= 0) {
    etapes.push({ ico: '💧', label: 'Vérification zone nitrates', desc: 'Parcelle potentiellement en zone vulnérable nitrates — vérifier le programme d\'action applicable.' });
  }
  if (groupe.indexOf('Vignes') >= 0 || groupe.indexOf('AOP') >= 0) {
    etapes.push({ ico: '🍷', label: 'Consultation syndicat AOP/AOC', desc: 'Parcelle potentiellement dans un périmètre d\'appellation — consulter le syndicat viticole.' });
  }

  var html = '<div id="rpg-checklist" class="checklist-rpg-bloc">' +
    '<div class="chk-section-titre">🌾 Étapes spécifiques — Parcelle RPG (' + (groupe || code) + ')</div>' +
    etapes.map(function(e, i) {
      return '<div class="chk-item chk-item-rpg">' +
        '<span class="chk-ico">' + e.ico + '</span>' +
        '<div class="chk-content">' +
          '<div class="chk-label">' + e.label + '</div>' +
          '<div class="chk-desc">' + e.desc + '</div>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';

  body.insertAdjacentHTML('afterbegin', html);
}

/* ── ZONES AGRICOLES — détection contextuelle (nitrates, régions, bio, SIQO)
   Injecte enjeux, items checklist, contacts et modificateurs simulation.  */

/**
 * Détecte les zones agricoles contenant le point (lat, lng).
 * Retourne un tableau de { type, nom, niv } pour les zones touchées.
 */
/**
 * Détecte les zones agricoles contenant ou proches du point (lat, lng).
 * - Polygones (nitrates, region_agri) : point-in-polygon strict.
 * - Points (bio, siqo_aop, circuit_court, agroecologie) : proximité ≤ RAYON_KM km.
 * @param {number} lat
 * @param {number} lng
 * @returns {Array<{type, nom, cat}>}
 */
function detecterZonesAgricoles(lat, lng) {
  var zones   = [];
  var data    = COUCHES_DATA && COUCHES_DATA['agriculture'];
  if (!data || !data.features) return zones;

  /* Rayon de détection pour les features ponctuelles (km) */
  var RAYON_KM = 5;

  data.features.forEach(function(feature) {
    var geom  = feature.geometry;
    var props = feature.properties || {};
    var type  = props.type || '';
    var nom   = props.nom  || '';
    if (!type || !geom) return;

    var match = false;

    if (geom.type === 'Polygon') {
      var ring = geom.coordinates && geom.coordinates[0];
      if (ring && ring.length) match = pointInPolygon(lat, lng, ring);
    } else if (geom.type === 'MultiPolygon') {
      match = geom.coordinates.some(function(poly) {
        var ring = poly && poly[0];
        return ring && ring.length && pointInPolygon(lat, lng, ring);
      });
    } else if (geom.type === 'Point') {
      /* Détection par proximité pour les marqueurs ponctuels */
      var fLng = geom.coordinates[0];
      var fLat = geom.coordinates[1];
      var dist = distanceKm(lat, lng, fLat, fLng);
      match = dist <= RAYON_KM;
    }

    if (match) {
      /* Éviter les doublons de même type */
      var existe = zones.some(function(z) { return z.type === type; });
      if (!existe) {
        zones.push({ type: type, nom: nom, cat: props.cat || '' });
      }
    }
  });

  return zones;
}

/**
 * Génère des enjeux contextuels supplémentaires selon les zones agricoles détectées.
 * Filtrés par typeProjet : CDPENAF pour tous, nitrates pour agri/zae/logement, etc.
 * @param {Array} zonesAgri — résultat de detecterZonesAgricoles()
 * @param {number} taille   — envergure projet (1–4)
 * @param {string} typeProjet — type de projet courant
 */
function genererEnjeuxAgricoles(zonesAgri, taille, typeProjet) {
  var enjeux = [];
  var types  = zonesAgri.map(function(z) { return z.type; });

  var isAgri   = typeProjet === 'agriculture';
  var isZae    = typeProjet === 'zae';
  var isLog    = typeProjet === 'logement';
  var isFriche = typeProjet === 'friche';
  var isNature = typeProjet === 'nature';

  var inNitrates  = types.indexOf('nitrates')      >= 0;
  var inRegion    = types.indexOf('region_agri')   >= 0;
  var inBio       = types.indexOf('bio')           >= 0;
  var inSiqo      = types.indexOf('siqo_aop')      >= 0;
  var inCircuit   = types.indexOf('circuit_court') >= 0;
  var inAgroeco   = types.indexOf('agroecologie')  >= 0;

  /* Nitrates : pertinent pour agri (épandage), zae (industries agro-alimentaires), logement (eau potable) */
  if (inNitrates && (isAgri || isZae || isLog)) {
    enjeux.push({
      id:    'agri-ctx-nitrates',
      nom:   'Zone vuln\u00e9rable nitrates \u2014 Programme d\u2019action applicable',
      ico:   '\uD83E\uDDEA',
      niv:   'eleve',
      tmin:  1,
      contexte_zone: true,
      axes:  { environnement: { facteurs: ['Zone vuln\u00e9rable nitrates (bassin Allan ou Bourbeuse)'], consequences: ['Restrictions d\u2019\u00e9pandage et stockage d\u2019effluents 6 mois minimum'] } },
      actions: [
        '5e Programme d\u2019Actions Nitrates : p\u00e9riodes d\u2019\u00e9pandage et doses \u00e0 respecter',
        'Pr\u00e9voir un stockage d\u2019effluents de 6 mois minimum',
        'Contacter la Chambre d\u2019Agriculture 90 pour le plan de fumure',
        'Adh\u00e9rer \u00e0 l\u2019initiative L\u2019Eau d\u2019Ici (CCST)',
      ],
      refs: [{ n: 'C40', t: 'Zones vuln\u00e9rables nitrates' }],
      _agri_ctx: true,
    });
  }

  /* CDPENAF : s'applique à TOUS les projets consommant de la SAU */
  if (inRegion) {
    var nomRegion = (zonesAgri.find(function(z){ return z.type === 'region_agri'; }) || {}).nom || 'R\u00e9gion agricole';
    enjeux.push({
      id:    'agri-ctx-cdpenaf',
      nom:   'Consommation fonci\u00e8re agricole \u2014 CDPENAF obligatoire',
      ico:   '\uD83C\uDF3E',
      niv:   'eleve',
      tmin:  1,
      contexte_zone: true,
      axes:  { economique: { facteurs: ['Projet situ\u00e9 dans une r\u00e9gion agricole (' + nomRegion.split('(')[0].trim() + ')'], consequences: ['Avis de la CDPENAF obligatoire si le projet consomme de la SAU'] } },
      actions: [
        'Solliciter l\u2019avis de la CDPENAF aupr\u00e8s de la DDT 90 avant tout d\u00e9p\u00f4t',
        'Justifier l\u2019absence d\u2019alternative sur terrain non agricole (ZAN)',
        'Contacter la Chambre d\u2019Agriculture 90 pour un avis pr\u00e9alable',
        'Estimer la SAU consomm\u00e9e et pr\u00e9voir une compensation si n\u00e9cessaire',
      ],
      refs: [{ n: 'C28', t: 'R\u00e9gions agricoles' }, { n: 'C34', t: 'CDPENAF' }],
      _agri_ctx: true,
    });
  }

  /* Bio/agroécologie : pertinent seulement pour les projets agricoles */
  if ((inBio || inAgroeco) && isAgri) {
    enjeux.push({
      id:    'agri-ctx-bio',
      nom:   'Zone bio/agro\u00e9cologie \u2014 Compatibilit\u00e9 et valorisation',
      ico:   '\uD83C\uDF3F',
      niv:   'moyen',
      tmin:  1,
      contexte_zone: true,
      axes:  { environnement: { facteurs: ['Secteur \u00e0 enjeu agro-\u00e9cologique identifi\u00e9'], consequences: ['Pr\u00e9server la coh\u00e9rence avec les pratiques bio et agro\u00e9cologiques du secteur'] } },
      actions: [
        'V\u00e9rifier la compatibilit\u00e9 du projet avec les exploitations bio voisines',
        'Contacter le GAB Franche-Comt\u00e9 pour les projets en agriculture biologique',
        'D\u00e9poser une demande MAEC conversion AB avant le 15 mai (DDT 90)',
      ],
      refs: [{ n: 'C37', t: 'Agriculture biologique' }],
      _agri_ctx: true,
    });
  }

  /* SIQO/AOP : concerne la production (agri) et la transformation/commercialisation (zae) */
  if (inSiqo && (isAgri || isZae)) {
    enjeux.push({
      id:    'agri-ctx-siqo',
      nom:   'Zone SIQO / AOP \u2014 Respect du cahier des charges',
      ico:   '\uD83C\uDFF7',
      niv:   'moyen',
      tmin:  1,
      contexte_zone: true,
      axes:  { economique: { facteurs: ['Secteur couvert par un Signe d\u2019Identification de la Qualit\u00e9 et de l\u2019Origine (AOP, IGP...)'], consequences: ['Le projet ne doit pas compromettre les conditions de l\u2019appellation'] } },
      actions: [
        'V\u00e9rifier la compatibilit\u00e9 du projet avec le cahier des charges de l\u2019AOP/IGP',
        'Contacter l\u2019INAO (Institut National de l\u2019Origine et de la Qualit\u00e9)',
      ],
      refs: [{ n: 'C36', t: 'Labels et signes de qualit\u00e9' }],
      _agri_ctx: true,
    });
  }

  return enjeux;
}

/**
 * Génère des items de checklist supplémentaires selon les zones agricoles.
 * Appelé par afficherChecklist() si A.typeProjet === 'agriculture'.
 */
function checklistAgricoleContextuelle(zonesAgri) {
  var items = [];
  var types = zonesAgri.map(function(z) { return z.type; });

  if (types.indexOf('nitrates') >= 0) {
    items.push(
      { id:'agri-check-nitrates-1', ico:'\uD83E\uDDEA', label:'Plan de fumure pr\u00e9visionnel', oblig:true,  delai:'Avant d\u00e9marrage', desc:'Plan de fumure obligatoire en zone vuln\u00e9rable nitrates. Pr\u00e9parer avec la Chambre d\u2019Agriculture 90.' },
      { id:'agri-check-nitrates-2', ico:'\uD83D\uDDC3',  label:'Capacit\u00e9 de stockage effluents 6 mois', oblig:true, delai:'Avant mise en service', desc:'V\u00e9rifier que la capacit\u00e9 de stockage respecte les 6 mois r\u00e9glementaires en zone vuln\u00e9rable.' },
      { id:'agri-check-nitrates-3', ico:'\uD83D\uDCC5', label:'Calendrier d\u2019\u00e9pandage (p\u00e9riodes interdites)', oblig:true, delai:'En continu', desc:'Respecter les fen\u00eatres d\u2019\u00e9pandage de l\u2019arr\u00eat\u00e9 pr\u00e9fectoral du 90.' }
    );
  }

  if (types.indexOf('region_agri') >= 0) {
    items.push(
      { id:'agri-check-cdpenaf', ico:'\uD83C\uDF3E', label:'Saisine CDPENAF', oblig:true, delai:'Avant PC', desc:'Avis de la Commission D\u00e9partementale de Pr\u00e9servation des Espaces Naturels, Agricoles et Forestiers obligatoire si consommation de SAU.' },
      { id:'agri-check-chambre', ico:'\uD83D\uDCDE', label:'Avis Chambre d\u2019Agriculture 90', oblig:false, delai:'Avant d\u00e9p\u00f4t', desc:'Consulter la Chambre d\u2019Agriculture 90 avant tout projet impactant la SAU du d\u00e9partement.' }
    );
  }

  return items;
}

/**
 * Calcule les modificateurs de simulation agricole selon les zones détectées.
 * Retourne { dureeDelta, complexDelta, impactDelta, alertes }.
 */
function modificateursSimulationAgricole(zonesAgri) {
  var dureeDelta   = 0;
  var complexDelta = 0;
  var impactDelta  = 0;
  var alertes      = [];
  var types = zonesAgri.map(function(z) { return z.type; });

  if (types.indexOf('nitrates') >= 0) {
    dureeDelta   += 2;
    complexDelta += 12;
    impactDelta  += 8;
    alertes.push({ cls:'rouge', ico:'\uD83E\uDDEA', txt:'Zone vuln\u00e9rable nitrates : programme d\u2019action renforc\u00e9, plan de fumure obligatoire, stockage 6 mois minimum.' });
  }

  if (types.indexOf('region_agri') >= 0) {
    dureeDelta   += 3;
    complexDelta += 15;
    alertes.push({ cls:'orange', ico:'\uD83C\uDF3E', txt:'R\u00e9gion agricole identifi\u00e9e : saisine CDPENAF obligatoire, d\u00e9lai d\u2019instruction major\u00e9 de 2 \u00e0 4 mois.' });
  }

  if (types.indexOf('bio') >= 0 || types.indexOf('agroecologie') >= 0) {
    complexDelta += 8;
    impactDelta  -= 10;  /* impact positif si projet compatible bio */
    alertes.push({ cls:'bleu', ico:'\uD83C\uDF3F', txt:'Secteur agro\u00e9cologique : possibilit\u00e9 de MAEC, valorisation bio \u2014 impact environnemental r\u00e9duit.' });
  }

  if (types.indexOf('siqo_aop') >= 0) {
    dureeDelta   += 2;
    complexDelta += 10;
    alertes.push({ cls:'orange', ico:'\uD83C\uDFF7', txt:'Zone AOP/IGP : v\u00e9rifier la compatibilit\u00e9 du projet avec le cahier des charges de l\u2019appellation.' });
  }

  if (types.indexOf('circuit_court') >= 0) {
    impactDelta -= 5;   /* impact positif : projet de proximité */
    alertes.push({ cls:'bleu', ico:'\uD83E\uDD55', txt:'Secteur circuits courts : valorisation \u00e9conomique locale possible, impact positif sur la fili\u00e8re.' });
  }

  return { dureeDelta: dureeDelta, complexDelta: complexDelta, impactDelta: impactDelta, alertes: alertes };
}

function detecterZones(lat, lng, typeProjet) {
  if (!lat || !lng || !ENJEUX_ZONES || ENJEUX_ZONES.length === 0) return [];

  var resultats = [];

  ENJEUX_ZONES.forEach(function(enjeu) {
    /* Vérifier que ce type de projet est concerné */
    if (enjeu.types_projets.indexOf(typeProjet) === -1) return;

    var zonesDetectees = [];

    /* Pour chaque couche de l'Atlas concernée */
    enjeu.zone_layers.forEach(function(layerId) {
      var couche = COUCHES_DATA[layerId];
      if (!couche || !couche.features) return;

      couche.features.forEach(function(feature) {
        var fType = feature.properties && feature.properties.type;
        /* Vérifier si ce feature type est dans la liste zone_types de l'enjeu */
        if (enjeu.zone_types.indexOf(fType) === -1) return;

        if (featureContientPoint(feature, lat, lng, enjeu.zone_distance || 0)) {
          zonesDetectees.push({
            nom:     feature.properties.nom || fType,
            type:    fType,
            layer:   layerId,
            cat:     feature.properties.cat || '',
          });
        }
      });
    });

    if (zonesDetectees.length > 0) {
      resultats.push({ enjeu: enjeu, zones: zonesDetectees });
    }
  });

  return resultats;
}

/* ── Affiche les enjeux de zones dans un accordéon dédié ────────
   Appelé depuis rendreAccordeons() */
function rendreAccordeonZones(zonesDetectees, conteneur) {
  if (!zonesDetectees || zonesDetectees.length === 0) return;

  var accord = document.createElement('div');
  accord.className = 'accord-wrap accord-zones';
  accord.dataset.axe = 'zones';

  var niveaux = { eleve:'Elevé', moyen:'Moyen', faible:'Faible' };

  /* Header de l'accordéon zones */
  var btn = document.createElement('button');
  btn.className = 'accord-btn';
  btn.style.setProperty('--axe-color', '#b91c1c');
  btn.style.setProperty('--axe-border', '#fca5a5');
  btn.innerHTML =
    '<span class="accord-ico">📍</span>' +
    '<span class="accord-label">Contraintes de localisation détectées</span>' +
    '<span class="accord-count">' + zonesDetectees.length + ' zone' + (zonesDetectees.length > 1 ? 's' : '') + '</span>' +
    '<span class="accord-chev">&#x25BC;</span>';

  var body = document.createElement('div');
  body.className = 'accord-body';

  /* Badge d'alerte en haut */
  var alertDiv = document.createElement('div');
  alertDiv.className = 'zones-alerte-banner';
  alertDiv.innerHTML =
    '<span>⚠️</span>' +
    '<span>La position de votre projet a été analysée. ' + zonesDetectees.length +
    ' contrainte' + (zonesDetectees.length > 1 ? 's' : '') +
    ' géographique' + (zonesDetectees.length > 1 ? 's ont été détectées' : ' a été détectée') + ' :</span>';
  body.appendChild(alertDiv);

  /* Liste des zones avec chips */
  var chipWrap = document.createElement('div');
  chipWrap.className = 'zones-chips-wrap';
  zonesDetectees.forEach(function(zd) {
    var chip = document.createElement('div');
    chip.className = 'zone-chip';
    chip.innerHTML =
      '<span class="zone-chip-ico">📌</span>' +
      '<div>' +
        '<div class="zone-chip-nom">' + zd.enjeu.nom + '</div>' +
        '<div class="zone-chip-detail">' + zd.zones.map(function(z){ return z.nom; }).join(' · ') + '</div>' +
      '</div>' +
      '<span class="niv-badge n-' + zd.enjeu.niv + '">' + (niveaux[zd.enjeu.niv]||zd.enjeu.niv) + '</span>';
    chipWrap.appendChild(chip);
  });
  body.appendChild(chipWrap);

  /* Fiches détaillées pour chaque enjeu de zone */
  zonesDetectees.forEach(function(zd) {
    var enjeu = zd.enjeu;
    var axeIds = ['environnement','economique','politique','social'];
    var AXES = {
      environnement: { label:'Environnement', ico:'🌳', color:'#15803d', bg:'#f0fdf4', border:'#86efac' },
      economique:    { label:'Economique',    ico:'💰', color:'#7c3aed', bg:'#f5f3ff', border:'#c4b5fd' },
      politique:     { label:'Politique',     ico:'🏛', color:'#92400e', bg:'#fef9c3', border:'#fde68a' },
      social:        { label:'Social',        ico:'👥', color:'#be123c', bg:'#fff1f2', border:'#fda4af' },
    };

    var fiche = document.createElement('div');
    fiche.className = 'axe-fiche';

    var ficheHead = document.createElement('div');
    ficheHead.className = 'axe-fiche-head';
    ficheHead.innerHTML =
      '<span class="axe-fiche-ico">' + (enjeu.ico||'⚠️') + '</span>' +
      '<span class="axe-fiche-nom">' + enjeu.nom + '</span>' +
      '<span class="niv-badge n-' + enjeu.niv + '">' + (niveaux[enjeu.niv]||enjeu.niv) + '</span>' +
      '<span class="axe-fiche-chev">&#x25BA;</span>';

    var ficheBody = document.createElement('div');
    ficheBody.className = 'axe-fiche-body';

    /* Badge zones détectées */
    ficheBody.innerHTML =
      '<div class="zone-detected-badge">' +
        '📍 Zone détectée : ' + zd.zones.map(function(z){ return '<strong>' + z.nom + '</strong>'; }).join(', ') +
      '</div>';

    /* Les 4 axes */
    axeIds.forEach(function(axeId) {
      var meta = AXES[axeId];
      var axe  = enjeu.axes && enjeu.axes[axeId];
      if (!axe) return;

      var fHtml = (axe.facteurs||[]).map(function(f){
        return '<li><span class="axe-bullet">•</span>' + f + '</li>';
      }).join('');
      var cHtml = (axe.consequences||[]).map(function(c){
        return '<li><span class="axe-bullet axe-bullet-arrow">→</span>' + c + '</li>';
      }).join('');

      ficheBody.innerHTML +=
        '<div class="axe-section" style="border-left:3px solid ' + meta.border + ';background:' + meta.bg + ';margin-top:8px;">' +
          '<div class="axe-titre" style="color:' + meta.color + ';">' + meta.ico + '&nbsp;' + meta.label + '</div>' +
          '<div class="axe-cols">' +
            '<div class="axe-col"><div class="axe-col-titre">Facteurs</div><ul class="axe-list">' + fHtml + '</ul></div>' +
            '<div class="axe-col"><div class="axe-col-titre">Conséquences</div><ul class="axe-list">' + cHtml + '</ul></div>' +
          '</div>' +
        '</div>';
    });

    /* Actions */
    if (enjeu.actions && enjeu.actions.length) {
      var aHtml = enjeu.actions.map(function(a){
        return '<li><span class="axe-bullet action-bullet">✓</span>' + a + '</li>';
      }).join('');
      ficheBody.innerHTML +=
        '<div class="fiche-section actions" style="margin-top:8px;">' +
          '<div class="fiche-section-titre action">Actions recommandées</div>' +
          '<ul class="axe-list">' + aHtml + '</ul>' +
        '</div>';
    }

    /* Refs */
    if (enjeu.refs && enjeu.refs.length) {
      var refsHtml = enjeu.refs.map(function(r){
        return '<span class="enjeu-lien" data-id="' + enjeu.id + '">🗺 ' + r.n + ' — ' + r.t + '</span>';
      }).join('');
      ficheBody.innerHTML += '<div class="enjeu-liens" style="margin-top:8px;">' + refsHtml + '</div>';
    }

    ficheHead.addEventListener('click', function(){ fiche.classList.toggle('ouvert'); });
    fiche.appendChild(ficheHead);
    fiche.appendChild(ficheBody);
    body.appendChild(fiche);
  });

  btn.addEventListener('click', function(){ accord.classList.toggle('ouvert'); });
  accord.appendChild(btn);
  accord.appendChild(body);

  /* Insérer AVANT les autres accordéons */
  if (conteneur.firstChild) {
    conteneur.insertBefore(accord, conteneur.firstChild);
  } else {
    conteneur.appendChild(accord);
  }
}


/* ── RAPPORT PDF — fenêtre HTML imprimable (7 pages)
   Couverture · Enjeux · Alentours · Checklist · Simulation · Contacts · Radar
   Métriques : A._lastFiltres / A._lastZonesResultats / A._sim          */

function lancerRapport() {
  if (!A._lastFiltres) {
    alert("Lancez d'abord une analyse pour generer le rapport.");
    return;
  }
  genererRapportPDF(A._lastFiltres, A._lastZonesResultats);
}

function genererRapportPDF(filtres, zonesResultats) {
  var type     = TYPES.find(function(x){ return x.id === A.typeProjet; });
  var taille   = TAILLES[A.taille];
  var sousType = A.sousType || null;
  var stObj    = sousType && SOUS_TYPES[A.typeProjet]
                   ? SOUS_TYPES[A.typeProjet].find(function(s){ return s.id === sousType; })
                   : null;
  var commune  = detecterCommuneProjet();
  var dateStr  = new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});
  var epci     = commune && commune.codeEpci ? getEpciInfo(commune.codeEpci) : null;
  var contacts = genererContactsData();

  var alentourItems = [];
  if (typeof alentours !== 'undefined' && alentours.resultats && alentours.resultats.length) {
    alentourItems = alentours.resultats.slice(0, 10);
  }

  var checkItems = [];
  if (A.sousType && CHECKLISTS[A.sousType]) { checkItems = CHECKLISTS[A.sousType]; }
  else if (A.typeProjet && CHECKLISTS[A.typeProjet]) { checkItems = CHECKLISTS[A.typeProjet]; }

  /* ── Simulation : lire A._sim si disponible, sinon fallback DOM ── */
  var sim = A._sim || null;
  var simDureeStr   = sim ? sim.dureeStr     : '—';
  var simDuree      = sim ? sim.duree        : 0;
  var simComplex    = sim ? sim.complex      : 0;
  var simComplexLbl = sim ? sim.complexLabel : '—';
  var simImpact     = sim ? sim.impact       : 0;
  var simImpactPos  = sim ? sim.impactPos    : false;
  var simImpactLbl  = sim ? sim.impactLabel  : '—';

  /* Si pas de simulation lancee, fallback sur le DOM */
  if (!sim) {
    var simEl = document.getElementById('sim-result');
    if (simEl) {
      var dEl = simEl.querySelector('.sim-jauge-valeur');
      if (dEl) simDureeStr = dEl.textContent.trim().split(' ')[0] || '—';
    }
  }

  /* ── Calcul du score global et des 4 axes du radar ─────────────
     Tous les scores sont ramenés sur /5 :
     - Economique  : complexite / 100 * 5  (complexite elevee = score eleve)
     - Environnemental : impact / 100 * 5 (plus l\'impact est fort, plus le score est eleve)
     - Societal    : base sur le nb d'enjeux sociaux / eleves
     - Politique   : base sur nb de zones detectees + complexite procedure
     Score global  : moyenne des 4 axes, arrondie a 0.5 pres
  ─────────────────────────────────────────────────────────────── */
  var axeEco  = simComplex > 0 ? +(simComplex / 100 * 5).toFixed(2) : 2.5;
  var axeEnv  = simImpact  > 0 ? +(simImpact  / 100 * 5).toFixed(2) : 2.5;

  /* Societal : nb enjeux niv eleve / total filtres, ramene sur 5 */
  var nbEleve    = filtres.filter(function(e){ return e.niv === 'eleve'; }).length;
  var nbTotal    = filtres.length || 1;
  var axeSoc     = +(Math.min(5, 1 + (nbEleve / nbTotal) * 4)).toFixed(2);

  /* Politique : nb zones + taille projet, ramene sur 5 */
  var nbZones    = zonesResultats.length;
  var axePol     = +(Math.min(5, 1 + (nbZones * 0.4) + (A.taille * 0.5))).toFixed(2);

  /* Score global = moyenne ponderee arrondie a 0.5 */
  var scoreBrut  = (axeEco + axeEnv + axeSoc + axePol) / 4;
  var scoreGlobal = Math.round(scoreBrut * 2) / 2;  /* arrondi a 0.5 */
  var scoreStr   = scoreGlobal.toFixed(1) + '/5';

  /* Couleur du score global */
  var scoreCouleur = scoreGlobal <= 2 ? '#16a34a' : scoreGlobal <= 3.5 ? '#d97706' : '#dc2626';

  /* ── Radar SVG inline avec vraies valeurs ─────────────────────── */
  function radarSVG(vals, labels) {
    var cx = 160, cy = 160, r = 110, n = labels.length, MAX = 5;
    var angle = function(i) { return (i * 2 * Math.PI / n) - Math.PI / 2; };
    var pt    = function(v, i) {
      return [(cx + (v/MAX)*r*Math.cos(angle(i))).toFixed(1),
              (cy + (v/MAX)*r*Math.sin(angle(i))).toFixed(1)];
    };
    var rings = '';
    [1,2,3,4,5].forEach(function(g) {
      var gpts = labels.map(function(_,i){ return pt(g,i).join(','); }).join(' ');
      rings += '<polygon points="'+gpts+'" fill="none" stroke="#cbd5e1" stroke-width="0.8"/>';
    });
    var axes = labels.map(function(_,i) {
      return '<line x1="'+cx+'" y1="'+cy+'" x2="'+pt(5,i)[0]+'" y2="'+pt(5,i)[1]+'" stroke="#e2e8f0" stroke-width="1"/>';
    }).join('');
    var datapts = vals.map(function(v,i){ return pt(v,i); });
    var poly = '<polygon points="'+datapts.map(function(p){return p.join(',');}).join(' ')+'" fill="#93c5fd" fill-opacity="0.45" stroke="#3b82f6" stroke-width="2.5"/>';
    var dots = datapts.map(function(p){
      return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="5" fill="#2563eb" stroke="#fff" stroke-width="1.5"/>';
    }).join('');
    /* Valeur numerique sur chaque point */
    var valLabels = vals.map(function(v,i) {
      var p = pt(v + 0.55, i);
      return '<text x="'+p[0]+'" y="'+(+p[1]+4).toFixed(1)+'" text-anchor="middle" font-size="9" font-weight="700" fill="#2563eb">'+v.toFixed(1)+'</text>';
    }).join('');
    var axeLabels = labels.map(function(lbl,i) {
      var lx = cx + (r+26)*Math.cos(angle(i));
      var ly = cy + (r+26)*Math.sin(angle(i));
      var anc = Math.cos(angle(i)) > 0.2 ? 'start' : Math.cos(angle(i)) < -0.2 ? 'end' : 'middle';
      return '<text x="'+lx.toFixed(1)+'" y="'+(ly+4).toFixed(1)+'" text-anchor="'+anc+'" font-size="11" font-weight="600" fill="#334155">'+lbl+'</text>';
    }).join('');
    return '<svg width="480" height="320" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">'+rings+axes+poly+dots+valLabels+axeLabels+'</svg>';
  }

  var radarVals   = [axeEco, axeEnv, axeSoc, axePol];
  var radarLabels = ['Economique','Environnemental','Societal','Politique'];
  var radarHtml   = radarSVG(radarVals, radarLabels);

  /* Barres de progression pour le radar (legende) */
  function barreAxe(label, val, color) {
    var pct = (val/5*100).toFixed(0);
    return '<div style="margin-bottom:7px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px;">' +
        '<span style="font-weight:600;color:#1e293b;">'+label+'</span>' +
        '<span style="font-weight:700;color:'+color+';">'+val.toFixed(1)+'/5</span>' +
      '</div>' +
      '<div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">' +
        '<div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:3px;transition:width .3s;"></div>' +
      '</div>' +
    '</div>';
  }

  var axeColors = { Economique:'#7c3aed', Environnemental:'#15803d', Societal:'#be123c', Politique:'#92400e' };

  /* ── Helpers HTML partagés ───────────────────────────────────── */
  function nivBadge(niv) {
    var m = {eleve:{l:'ELEVE',c:'#dc2626'},moyen:{l:'MOYEN',c:'#d97706'},faible:{l:'FAIBLE',c:'#16a34a'}};
    var n = m[niv]||{l:niv,c:'#64748b'};
    return '<span style="background:'+n.c+';color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;letter-spacing:.04em;">'+n.l+'</span>';
  }
  function nivBg(niv)   { return {eleve:'#fef2f2',moyen:'#fffbeb',faible:'#f0fdf4'}[niv]||'#f8fafc'; }
  function nivBord(niv) { return {eleve:'#fca5a5',moyen:'#fde68a',faible:'#86efac'}[niv]||'#e2e8f0'; }

  function zoneRow(z) {
    var nom=z.nom||(z.enjeu&&z.enjeu.nom)||'', ref=z.ref||(z.enjeu&&z.enjeu.id)||'', ico=z.ico||(z.enjeu&&z.enjeu.ico)||'!';
    return '<tr style="background:'+nivBg(z.niv)+';border-bottom:1px solid #f1f5f9;">'+
      '<td style="padding:7px 10px;font-size:15px;width:30px;">'+ico+'</td>'+
      '<td style="padding:7px 10px 7px 0;"><div style="font-weight:600;font-size:11px;color:#1e293b;">'+nom+'</div><div style="font-size:10px;color:#64748b;margin-top:2px;">'+ref+'</div></td>'+
      '<td style="padding:7px 10px;text-align:right;width:70px;">'+nivBadge(z.niv)+'</td></tr>';
  }

  function enjeuRow(e) {
    return '<tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">'+
      '<td style="padding:7px 10px;font-size:15px;width:30px;">'+(e.ico||'!')+'</td>'+
      '<td style="padding:7px 10px 7px 0;"><div style="font-weight:600;font-size:11px;color:#1e293b;">'+e.nom+'</div><div style="font-size:10px;color:#64748b;margin-top:2px;">'+(e.actions&&e.actions[0]?'-> '+e.actions[0]:'')+'</div></td>'+
      '<td style="padding:7px 10px;text-align:right;width:90px;">'+nivBadge(e.niv)+'</td></tr>';
  }

  function checkRow(item) {
    return '<tr style="border-bottom:1px solid #f1f5f9;">'+
      '<td style="padding:6px 8px;width:24px;text-align:center;"><span style="display:inline-block;width:16px;height:16px;border:1.5px solid #cbd5e1;border-radius:3px;"></span></td>'+
      '<td style="padding:6px 8px 6px 0;"><span style="font-size:13px;margin-right:4px;">'+(item.ico||'o')+'</span><span style="font-weight:600;font-size:11px;color:#1e293b;">'+item.label+'</span>'+(item.desc?'<div style="font-size:10px;color:#64748b;margin-top:2px;">'+item.desc+'</div>':'')+'</td>'+
      '<td style="padding:6px 8px;text-align:right;font-size:10px;color:#94a3b8;width:90px;">'+(item.delai||'')+'</td>'+
      '<td style="padding:6px 8px;width:80px;">'+(item.oblig?'<span style="font-size:9px;font-weight:700;color:#dc2626;">OBLIGATOIRE</span>':'')+'</td></tr>';
  }

  function contactCard(c) {
    var isOblig=((c.priorite||'').toLowerCase().indexOf('oblig')!==-1);
    var isRecomm=((c.priorite||'').toLowerCase().indexOf('recom')!==-1);
    var badgeBg=isOblig?'#fef2f2':(isRecomm?'#eff6ff':'#f8fafc');
    var badgeFg=isOblig?'#dc2626':(isRecomm?'#003395':'#64748b');
    var bordCol=isOblig?'#fca5a5':(isRecomm?'#bfdbfe':'#e2e8f0');
    var hasTel=(c.tel&&c.tel!==''&&!c.tel.startsWith('['));
    var hasEmail=(c.email&&c.email!==''&&!c.email.startsWith('['));
    var telHtml=hasTel?
      '<div style="display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:7px 10px;">'+
        '<span style="font-size:16px;flex-shrink:0;">&#x1F4DE;</span>'+
        '<div><div style="font-size:8px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1px;">Telephone</div>'+
        '<div style="font-size:11px;font-weight:700;color:#1e293b;">'+c.tel+'</div></div></div>':'';
    var emailHtml=hasEmail?
      '<div style="display:flex;align-items:center;gap:8px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:7px 10px;">'+
        '<span style="font-size:16px;flex-shrink:0;">&#x2709;</span>'+
        '<div><div style="font-size:8px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1px;">Email</div>'+
        '<div style="font-size:10px;font-weight:600;color:#1e293b;word-break:break-all;">'+c.email+'</div></div></div>':'';
    var coordGrid=(telHtml||emailHtml)?
      '<div style="display:grid;grid-template-columns:'+(hasTel&&hasEmail?'1fr 1fr':'1fr')+';gap:6px;margin-top:8px;">'+telHtml+emailHtml+'</div>':
      '<div style="font-size:10px;color:#94a3b8;margin-top:6px;font-style:italic;">Coordonnees non disponibles</div>';
    return '<div style="background:#fff;border:1.5px solid '+bordCol+';border-radius:10px;padding:14px 16px;page-break-inside:avoid;box-shadow:0 1px 4px rgba(0,0,0,.06);">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">'+
        '<div style="font-weight:700;font-size:11.5px;color:#003395;line-height:1.35;flex:1;">'+c.nom+'</div>'+
        (c.priorite?'<span style="flex-shrink:0;font-size:9px;font-weight:700;color:'+badgeFg+';background:'+badgeBg+';border:1px solid '+bordCol+';border-radius:5px;padding:2px 7px;white-space:nowrap;">'+c.priorite+'</span>':'')+
      '</div>'+
      '<div style="font-size:10px;color:#475569;line-height:1.45;">'+(c.role||'')+'</div>'+
      coordGrid+
      (c.note?'<div style="margin-top:8px;font-size:9.5px;color:#64748b;background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:0 4px 4px 0;padding:5px 8px;line-height:1.45;">i '+c.note+'</div>':'')+
    '</div>';
  }

  /* Regrouper enjeux */
  var enjeuxEleve  = filtres.filter(function(e){ return e.niv==='eleve'; });
  var enjeuxMoyen  = filtres.filter(function(e){ return e.niv==='moyen'; });
  var enjeuxFaible = filtres.filter(function(e){ return e.niv==='faible'; });

  /* Raccourcis */
  var typeLabel =type?type.label:'';
  var typeIco   =type?type.ico:'';
  var stLabel   =stObj?stObj.label:'';
  var tailleNom =taille?taille.nom:'';
  var supHa     =A.superficieHa?A.superficieHa.toFixed(2)+' ha':'';
  var communeNom=commune?commune.nom:'';
  var communeCp =commune?(commune.cp||'90'):'';
  var posLat    =A.position?'Lat '+A.position.lat.toFixed(3):'';
  var posLng    =A.position?', Lng '+A.position.lng.toFixed(3):'';
  var epciAcro  =epci?epci.acronyme:'';
  var epciNom   =epci?epci.nom:'';

  /* Couleur barres simulation */
  var complexColor = simComplex < 50 ? '#16a34a' : simComplex < 70 ? '#d97706' : '#dc2626';
  var impactColor  = simImpactPos ? '#16a34a' : (simImpact < 55 ? '#d97706' : '#dc2626');
  var dureeColor   = simDuree < 12 ? '#16a34a' : simDuree < 36 ? '#d97706' : '#dc2626';

  /* ────────────────── HTML DU RAPPORT ─────────────────────────── */
  var html =
    '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>'+
    '<title>Rapport DDT 90 -- '+typeLabel+' -- '+dateStr+'</title>'+
    '<style>'+
      '* { box-sizing:border-box; margin:0; padding:0; }'+
      'body { font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#1e293b; background:#fff; }'+
      '@page { size:A4; margin:18mm 16mm 14mm; }'+
      '@media print { .no-print{display:none!important;} .page-break{page-break-before:always;break-before:page;} .avoid-break{page-break-inside:avoid;break-inside:avoid;} }'+
      '.hdr{background:#003395;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;}'+
      '.tricolore{display:flex;height:3px;margin-bottom:8px;}'+
      '.tricolore span:nth-child(1){flex:1;background:#002266;}'+
      '.tricolore span:nth-child(2){flex:1;background:#fff;}'+
      '.tricolore span:nth-child(3){flex:1;background:#dc2626;}'+
      '.sec{font-size:14px;font-weight:700;color:#003395;border-bottom:2px solid #003395;padding-bottom:5px;margin:16px 0 10px;}'+
      '.ssec{font-size:11px;font-weight:700;color:#1e293b;margin:10px 0 6px;}'+
      'table{width:100%;border-collapse:collapse;}'+
      '.panel{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;}'+
      '.ptitle{font-weight:700;font-size:10px;color:#003395;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;}'+
      '.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;}'+
      '.prog{height:7px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin:4px 0 5px;}'+
      '.prog-fill{height:100%;border-radius:4px;}'+
      '.btn-print{background:#003395;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:16px;}'+
      '.footer{margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;text-align:center;}'+
      '.jauge-val{font-size:15px;font-weight:900;text-align:right;}'+
      '.jauge-sous{font-size:9px;color:#64748b;margin-top:3px;}'+
    '</style></head><body>'+

    '<div class="no-print" style="text-align:center;padding:16px 0 8px;">'+
      '<button class="btn-print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>'+
      '<div style="font-size:10px;color:#64748b;margin-top:4px;">Choisir "Enregistrer en PDF" dans la boite de dialogue</div>'+
    '</div>'+

    /* ═══ PAGE 1 — COUVERTURE ═══ */
    '<div class="tricolore"><span></span><span></span><span></span></div>'+
    '<div class="hdr"><div><div style="font-weight:700;font-size:13px;">DDT 90 -- Compte Rendu d\'analyse de projet</div><div style="font-size:9px;opacity:.8;">Direction Departementale des Territoires -- Territoire de Belfort</div></div><div style="font-size:9px;opacity:.7;">'+dateStr+'</div></div>'+

    '<div style="padding:12px 0 0;">'+
      '<div style="text-align:center;margin-bottom:14px;">'+
        '<div style="font-size:22px;font-weight:900;color:#1e293b;margin-bottom:4px;">Compte Rendu</div>'+
        '<div style="font-size:13px;color:#003395;font-weight:600;">'+typeIco+' '+typeLabel+(stLabel?' > '+stLabel:'')+'</div>'+
        (communeNom?'<div style="font-size:11px;color:#64748b;margin-top:2px;">Commune de '+communeNom+' ('+communeCp+')</div>':'')+
      '</div>'+

      /* Tableau 3 colonnes */
      '<div style="display:grid;grid-template-columns:2fr 1.2fr 1fr;gap:0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:14px;">'+
        '<div style="background:#d1fae5;padding:10px 12px;"><div style="font-size:9px;font-weight:700;color:#064e3b;text-transform:uppercase;margin-bottom:4px;">Objectif du projet</div><div style="font-size:10px;color:#1e293b;">Construction / implantation de '+typeLabel.toLowerCase()+(communeNom?' dans la commune de '+communeNom:'')+'</div></div>'+
        '<div style="background:#fef9c3;padding:10px 12px;border-left:1px solid #e2e8f0;"><div style="font-size:9px;font-weight:700;color:#713f12;text-transform:uppercase;margin-bottom:4px;">Initiateur</div><div style="font-size:10px;color:#1e293b;">'+(communeNom?'Commune de '+communeNom:'Porteur de projet')+'</div><div style="font-size:9px;color:#64748b;">'+epciAcro+'</div></div>'+
        '<div style="background:#fecaca;padding:10px 12px;border-left:1px solid #e2e8f0;text-align:center;"><div style="font-size:9px;font-weight:700;color:#7f1d1d;text-transform:uppercase;margin-bottom:4px;">Note globale</div>'+
          '<div style="font-size:26px;font-weight:900;color:'+scoreCouleur+';line-height:1;">'+scoreGlobal.toFixed(1)+'<span style="font-size:16px;">/5</span></div>'+
        '</div>'+
      '</div>'+

      /* Grille meta */
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:14px;">'+
        '<div style="background:#fff;border-radius:6px;padding:8px 10px;border:1px solid #e2e8f0;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:3px;">Type</div><div style="font-weight:700;font-size:11px;">'+typeIco+' '+typeLabel+'</div><div style="font-size:9px;color:#94a3b8;">'+stLabel+'</div></div>'+
        '<div style="background:#fff;border-radius:6px;padding:8px 10px;border:1px solid #e2e8f0;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:3px;">Envergure</div><div style="font-weight:700;font-size:11px;">'+tailleNom+'</div></div>'+
        '<div style="background:#fff;border-radius:6px;padding:8px 10px;border:1px solid #e2e8f0;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:3px;">Superficie</div><div style="font-weight:700;font-size:11px;">'+supHa+'</div></div>'+
        '<div style="background:#fff;border-radius:6px;padding:8px 10px;border:1px solid #e2e8f0;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:3px;">Localisation</div><div style="font-weight:700;font-size:11px;">'+(communeNom||'Definie')+'</div><div style="font-size:9px;color:#94a3b8;">'+posLat+'</div></div>'+
        (epciNom?'<div style="background:#fff;border-radius:6px;padding:8px 10px;border:1px solid #e2e8f0;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:3px;">EPCI</div><div style="font-weight:700;font-size:11px;">'+epciAcro+'</div></div>':'')+
        '<div style="background:#fff;border-radius:6px;padding:8px 10px;border:1px solid #e2e8f0;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:3px;">Enjeux</div><div style="font-weight:700;font-size:11px;color:#dc2626;">'+filtres.length+'</div></div>'+
        '<div style="background:#fff;border-radius:6px;padding:8px 10px;border:1px solid #e2e8f0;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:3px;">Zones sensibles</div><div style="font-weight:700;font-size:11px;color:#d97706;">'+zonesResultats.length+'</div></div>'+
      '</div>'+
    '</div>'+

    /* ═══ PAGE 2 — ENJEUX ═══ */
    '<div class="page-break"></div>'+
    '<div class="sec">Quels sont les principaux enjeux de votre projet ?</div>'+
    (zonesResultats.length>0?
      '<div class="avoid-break"><div class="panel"><div class="ptitle"><span>Contraintes de localisation -- '+zonesResultats.length+' zones detectees</span></div>'+
      '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:10px;color:#7f1d1d;">La position de votre projet a ete analysee. '+zonesResultats.length+' contrainte(s) detectees.</div>'+
      '<table><tbody>'+zonesResultats.map(zoneRow).join('')+'</tbody></table></div></div>':'')+
    '<div class="ssec">Enjeux -- '+typeLabel+' : '+filtres.length+' enjeu(x)</div>'+
    (enjeuxEleve.length?'<div class="avoid-break"><div style="font-size:10px;font-weight:700;color:#dc2626;margin:8px 0 4px;">ELEVE ('+enjeuxEleve.length+')</div><table><tbody>'+enjeuxEleve.map(enjeuRow).join('')+'</tbody></table></div>':'')+
    (enjeuxMoyen.length?'<div class="avoid-break"><div style="font-size:10px;font-weight:700;color:#d97706;margin:8px 0 4px;">MOYEN ('+enjeuxMoyen.length+')</div><table><tbody>'+enjeuxMoyen.map(enjeuRow).join('')+'</tbody></table></div>':'')+
    (enjeuxFaible.length?'<div class="avoid-break"><div style="font-size:10px;font-weight:700;color:#16a34a;margin:8px 0 4px;">FAIBLE ('+enjeuxFaible.length+')</div><table><tbody>'+enjeuxFaible.map(enjeuRow).join('')+'</tbody></table></div>':'')+

    /* ═══ PAGE 3 — ALENTOURS ═══ */
    (alentourItems.length>0?
      '<div class="page-break"></div>'+
      '<div class="sec">Quels sont les projets similaires aux alentours ?</div>'+
      '<div class="panel avoid-break"><div class="ptitle"><span>Projets similaires alentours</span><span>'+alentourItems.length+' resultat(s)</span></div>'+
      '<table><tbody>'+alentourItems.map(function(a){
        return '<tr style="border-bottom:1px solid #f1f5f9;">'+
          '<td style="padding:5px 8px;font-size:13px;width:28px;">&#x1F3EB;</td>'+
          '<td style="padding:5px 8px 5px 0;font-weight:600;font-size:11px;">'+(a.nom||a.tags&&(a.tags.name||a.tags.amenity)||'Etablissement')+'</td>'+
          '<td style="padding:5px 8px;text-align:right;font-size:10px;color:#64748b;">'+(a.type||'')+'</td>'+
          '<td style="padding:5px 8px;text-align:right;font-size:10px;color:#003395;font-weight:600;">'+(a.dist?(a.dist<1000?a.dist+' m':(a.dist/1000).toFixed(1)+' km'):'')+'</td>'+
        '</tr>';
      }).join('')+'</tbody></table></div>':'')+

    /* ═══ PAGE 4 — CHECKLIST ═══ */
    (checkItems.length>0?
      '<div class="page-break"></div>'+
      '<div class="sec">Que faire ensuite ?</div>'+
      '<div class="panel avoid-break">'+
        '<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:6px;padding:8px 10px;margin-bottom:8px;display:flex;justify-content:space-between;"><span style="font-size:12px;font-weight:700;color:#1e293b;">Checklist administrative</span><span style="font-size:10px;color:#64748b;">'+checkItems.length+' etape(s)</span></div>'+
        '<div class="prog"><div class="prog-fill" style="width:0%;background:#003395;"></div></div>'+
        '<table><tbody>'+checkItems.map(checkRow).join('')+'</tbody></table>'+
      '</div>':'')+

    /* ═══ PAGE 5 — SIMULATION ═══ */
    '<div class="page-break"></div>'+
    '<div class="sec">Simulation du projet</div>'+
    '<div class="two-col">'+

      /* Colonne gauche : jauges */
      '<div class="panel avoid-break">'+
        '<div class="ptitle">Simulation -- '+typeLabel+'</div>'+
        '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;">'+
          (tailleNom?'<span style="background:#e0e7ff;color:#3730a3;font-size:9px;padding:2px 7px;border-radius:4px;">'+tailleNom+'</span>':'')+
          (supHa?'<span style="background:#e0e7ff;color:#3730a3;font-size:9px;padding:2px 7px;border-radius:4px;">'+supHa+'</span>':'')+
          (A.position?'<span style="background:#e0e7ff;color:#3730a3;font-size:9px;padding:2px 7px;border-radius:4px;">Projet positionne</span>':'')+
        '</div>'+

        /* Durée */
        '<div style="margin-bottom:12px;">'+
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">'+
            '<div style="font-size:10px;font-weight:700;">Duree estimee</div>'+
            '<div class="jauge-val" style="color:'+dureeColor+';">'+simDureeStr+'</div>'+
          '</div>'+
          '<div class="prog"><div class="prog-fill" style="width:'+Math.min(100,Math.round(simDuree/72*100))+'%;background:'+dureeColor+';"></div></div>'+
          '<div class="jauge-sous">De l\'etude prealable a la reception des travaux.</div>'+
        '</div>'+

        /* Complexité */
        '<div style="margin-bottom:12px;">'+
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">'+
            '<div style="font-size:10px;font-weight:700;">Complexite administrative</div>'+
            '<div class="jauge-val" style="color:'+complexColor+';">'+simComplexLbl+' ('+simComplex+'/100)</div>'+
          '</div>'+
          '<div class="prog"><div class="prog-fill" style="width:'+simComplex+'%;background:'+complexColor+';"></div></div>'+
          '<div class="jauge-sous">Nombre de procedures, consultations et acteurs impliques.</div>'+
        '</div>'+

        /* Impact environnemental */
        '<div>'+
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">'+
            '<div style="font-size:10px;font-weight:700;">Impact environnemental</div>'+
            '<div class="jauge-val" style="color:'+impactColor+';">'+simImpactLbl+' ('+simImpact+'/100)</div>'+
          '</div>'+
          '<div class="prog"><div class="prog-fill" style="width:'+simImpact+'%;background:'+impactColor+';"></div></div>'+
          '<div class="jauge-sous">'+(simImpactPos?'Ce projet a un bilan environnemental favorable.':'Impact sur les sols, l\'eau et la biodiversite.')+'</div>'+
        '</div>'+
      '</div>'+

      /* Colonne droite : contexte + note globale */
      '<div>'+
        /* Note globale */
        '<div class="panel" style="text-align:center;margin-bottom:10px;">'+
          '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Note globale du projet</div>'+
          '<div style="font-size:38px;font-weight:900;color:'+scoreCouleur+';line-height:1;">'+scoreGlobal.toFixed(1)+'<span style="font-size:20px;color:#94a3b8;">/5</span></div>'+
          '<div style="font-size:9px;color:#94a3b8;margin-top:4px;">Score calcule sur les 4 axes ci-dessous</div>'+
          '<div style="margin-top:10px;">'+
            barreAxe('Economique',    axeEco,  axeColors.Economique)+
            barreAxe('Environnemental',axeEnv, axeColors.Environnemental)+
            barreAxe('Societal',      axeSoc,  axeColors.Societal)+
            barreAxe('Politique',     axePol,  axeColors.Politique)+
          '</div>'+
        '</div>'+
        /* Facteurs */
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">'+
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:2px;">Zones detectees</div><div style="font-weight:700;font-size:11px;color:#d97706;">'+zonesResultats.length+'</div></div>'+
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:2px;">Enjeux eleves</div><div style="font-weight:700;font-size:11px;color:#dc2626;">'+nbEleve+'</div></div>'+
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:2px;">Superficie</div><div style="font-weight:700;font-size:11px;">'+supHa+'</div></div>'+
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:2px;">Procedures</div><div style="font-weight:700;font-size:11px;">'+(A.taille<=1?'1-3':A.taille===2?'3-5':A.taille===3?'5-8':'8-15')+'</div></div>'+
        '</div>'+
      '</div>'+
    '</div>'+

    /* ═══ PAGE 6 — CONTACTS ═══ */
    '<div class="page-break"></div>'+
    '<div class="sec">Qui contacter si vous souhaitez echanger avec un expert ?</div>'+
    '<div class="panel" style="margin-bottom:12px;">'+
      '<div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:4px;">Contacter les acteurs du territoire</div>'+
      '<div style="font-size:10px;color:#64748b;margin-bottom:6px;">Experts, services de l\'Etat et partenaires locaux</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
        (typeLabel?'<span style="background:#003395;color:#fff;font-size:9px;padding:2px 8px;border-radius:4px;">'+typeLabel+'</span>':'')+
        (tailleNom?'<span style="background:#e2e8f0;color:#1e293b;font-size:9px;padding:2px 8px;border-radius:4px;">'+tailleNom+'</span>':'')+
        (posLat?'<span style="background:#e2e8f0;color:#1e293b;font-size:9px;padding:2px 8px;border-radius:4px;">'+posLat+posLng+'</span>':'')+
      '</div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'+contacts.map(contactCard).join('')+'</div>'+

    /* ═══ PAGE 7 — EVALUATION GLOBALE ═══ */
    '<div class="page-break"></div>'+
    '<div class="sec">Evaluation globale de votre projet : <span style="color:'+scoreCouleur+';">'+scoreStr+'</span></div>'+

    '<div class="two-col" style="align-items:start;">'+
      /* Radar */
      '<div>'+
        '<div style="margin-bottom:10px;">'+radarHtml+'</div>'+
      '</div>'+

      /* Scores + explication */
      '<div>'+
        '<div class="panel">'+
          '<div style="text-align:center;margin-bottom:14px;">'+
            '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Note globale</div>'+
            '<div style="font-size:42px;font-weight:900;color:'+scoreCouleur+';line-height:1;">'+scoreGlobal.toFixed(1)+'<span style="font-size:22px;color:#94a3b8;">/5</span></div>'+
            '<div style="font-size:9px;color:#94a3b8;margin-top:4px;">Moyenne ponderee des 4 axes</div>'+
          '</div>'+
          barreAxe('Economique (complexite proc.)',axeEco,axeColors.Economique)+
          barreAxe('Environnemental (impact)',    axeEnv,axeColors.Environnemental)+
          barreAxe('Societal (nb enjeux eleves)', axeSoc,axeColors.Societal)+
          barreAxe('Politique (zones + envergure)',axePol,axeColors.Politique)+
        '</div>'+

        '<div class="panel" style="margin-top:10px;">'+
          '<div class="ptitle">Methode de calcul</div>'+
          '<div style="font-size:9.5px;color:#475569;line-height:1.5;">'+
            '<div style="margin-bottom:4px;"><strong>Economique :</strong> complexite administrative / 100 × 5</div>'+
            '<div style="margin-bottom:4px;"><strong>Environnemental :</strong> impact environnemental / 100 × 5</div>'+
            '<div style="margin-bottom:4px;"><strong>Societal :</strong> proportion d\'enjeux de niveau eleve sur le total</div>'+
            '<div><strong>Politique :</strong> nombre de zones sensibles + envergure du projet</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>'+

    '<div class="footer">DDT 90 -- Outil d\'aide a la decision -- '+dateStr+' -- Document non contractuel'+(communeNom?' -- Commune de '+communeNom:'')+'</div>'+
  '</body></html>';

  var win = window.open('','_blank','width=900,height=700');
  if (!win) { alert("Veuillez autoriser les pop-ups pour generer le rapport PDF."); return; }
  win.document.write(html);
  win.document.close();
}

function genererContactsData() {
  var result = [];
  var cOld=document.getElementById('contact-cadastre');if(cOld)cOld.remove();var lC=document.getElementById('contacts-liste');if(lC){var cD=document.createElement('div');cD.id='contact-cadastre';cD.className='contact-groupe';cD.innerHTML='<div class="contact-groupe-titre"><span class="groupe-ico">??</span><span>Foncier &amp; Cadastre</span></div>'+creerCarteContactRPG('?? SPF Belfort','Cadastre, état hypothécaire, propriétaires.','0809 101 030','','https://www.cadastre.gouv.fr','Recommandé')+creerCarteContactRPG('?? Géoportail Urbanisme','PLU, servitudes, zonage avant PC.','','','https://www.geoportail-urbanisme.gouv.fr','Recommandé');lC.appendChild(cD);}
  document.querySelectorAll('#contacts-liste .contact-card').forEach(function(card) {
    var nomEl  = card.querySelector('.contact-nom');
    var roleEl = card.querySelector('.contact-role');
    var prioEl = card.querySelector('.contact-priorite');
    var tel = '', email = '';
    card.querySelectorAll('a').forEach(function(a) {
      if (a.href && a.href.indexOf('tel:')    === 0) tel   = a.textContent.trim();
      if (a.href && a.href.indexOf('mailto:') === 0) email = a.textContent.trim();
    });
    var noteEl = card.querySelector('[style*="border-left"]');
    result.push({
      nom:      nomEl  ? nomEl.textContent.trim()  : '',
      role:     roleEl ? roleEl.textContent.trim() : '',
      tel:      tel,
      email:    email,
      note:     noteEl ? noteEl.textContent.replace(/^[i\s]+/, '').trim() : '',
      priorite: prioEl ? prioEl.textContent.trim() : '',
    });
  });
  if (result.length === 0) {
    result.push({nom:'DDT 90 -- Direction Departementale des Territoires',role:'Service instructeur : urbanisme, agriculture, environnement, risques.',tel:'03 84 58 86 00',email:'ddt@territoire-de-belfort.gouv.fr',note:'Interlocuteur principal pour tout projet sur le Territoire de Belfort.',priorite:'Obligatoire'});
  }
  return result;
}

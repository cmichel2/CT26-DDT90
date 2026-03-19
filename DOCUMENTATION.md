# DDT 90 — Logiciel Interactif d'Aide à la Décision
## Documentation technique — Guide du repreneur

---

## 1. Vue d'ensemble

Application web **mono-page, sans build, sans dépendance NPM**. Il suffit de servir les 4 fichiers avec un serveur HTTP.

**Objectif** : aider les porteurs de projet et agents DDT à identifier les enjeux réglementaires, environnementaux et sociaux d'un projet d'aménagement sur le **Territoire de Belfort (90)**, en s'appuyant sur l'Atlas cartographique DDT 90 2025-2026.

**Stack** : HTML + CSS + JavaScript vanilla + Leaflet.js

---

## 2. Les 4 fichiers

| Fichier | Taille | Rôle |
|---|---|---|
| `index.html` | ~16 KB | Structure HTML, ordre de chargement des scripts |
| `style.css` | ~85 KB | Design system complet (variables CSS, dark mode, tous les composants) |
| `enjeux-db.js` | ~447 KB | **Base de données principale** : GeoJSON 101 communes, TYPES, TAILLES, THEMES, ENJEUX |
| `app.js` | ~378 KB | **Toute la logique applicative** : carte, analyse, UI, contacts, simulation... |

> **Ordre de chargement strict** dans `index.html` : `enjeux-db.js` doit être chargé **avant** `app.js`.

---

## 3. Architecture interne de `app.js`

Le fichier est structuré en sections séparées par des bandeaux `/* ═══ */`. Plan par numéro de ligne approximatif :

| Lignes | Section | Contenu |
|---|---|---|
| 1–86 | **COUCHE\_STYLES** | Styles des 11 couches thématiques Atlas (couleurs, tooltips) |
| 87–381 | **SOUS\_TYPES + CHECKLISTS** | Sous-types des 8 types de projets + étapes administratives |
| 382–767 | **COUCHES\_DATA** | GeoJSON embarqué des 11 couches Atlas DDT 90 |
| 768–803 | **État global `A{}`** | Objet central de l'application + `DOMContentLoaded` |
| 804–896 | **Carte Leaflet** | `initCarte`, communes, marqueurs, listeners |
| 897–923 | **Clics carte** | `gererClicCarte`, `gererDblClicCarte` |
| 924–1039 | **Placement projet** | `placerProjet`, `supprimerProjet`, modes placement/déplacement |
| 1040–1178 | **Couches thématiques** | `genControleCouches`, `toggleCouche`, `chargerCouche`, légende |
| 1179–1208 | **Superficie** | `majSuperficie` (calcul ha, cercle sur la carte) |
| 1209–1265 | **UI panneau gauche** | `genBoutons`, `selType`, `majTaille`, `genBadgesThemes` |
| 1266–1510 | **Enjeux + Modale** | `AXES_META`, `rendreAccordeons`, `ouvrirModale`, `fermerModale` |
| 1511–1922 | **CONTACTS\_DB** | Base de données des contacts (8 groupes, ~24 contacts) |
| 1923–2268 | **Logique contacts** | `afficherContacts`, `detecterCommuneProjet`, `genererContacts` |
| 2269–2335 | **Sous-types UI** | `afficherSousTypes`, `selSousType` |
| 2336–2556 | **Checklist** | `afficherChecklist`, `genererChecklist`, items, progression |
| 2557–2955 | **Recherche Nominatim** | Géocodage OSM, suggestions autocomplete |
| 2956–3460 | **Tutoriel + Serious Game** | `TUTO_SLIDES`, `SG_QUESTIONS`, navigation, scoring |
| 3461–3495 | **Dark mode + Onglets** | `toggleDarkMode`, `initTheme`, `switchTab` |
| 3496–3802 | **Simulation** | `SIM_BASE`, `ZONES_RISQUE`, `lancerSimulation`, rendu |
| 3803–4098 | **Projets alentours OSM** | `OSM_TAGS`, `rechercherAlentours` via Overpass API |
| 4099–4280 | **Utilitaires géo (anciens)** | `pointInPolygon`, `projetDansFeature`, `distPointSegment` |
| 4281–fin | **Analyse centrale** | `lancerAnalyse`, `ENJEUX_ZONES`, `detecterZones`, `rendreAccordeonZones` |

---

## 4. État global — objet `A`

Tout l'état en mémoire de la session est dans l'objet `A` (ligne ~768) :

```javascript
var A = {
  // Projet courant
  typeProjet:    null,        // 'logement' | 'zae' | 'equipement' | ...
  sousType:      null,        // sous-type sélectionné
  taille:        1,           // envergure réglementaire 1 (petit) à 4 (majeur)
  themesActifs:  Set,         // Set<string> des thèmes filtrés dans l'UI
  superficieHa:  null,        // superficie calculée en hectares

  // Carte Leaflet
  modePlacement: false,       // true = prochain clic pose le marqueur
  modeDeplace:   false,       // true = prochain double-clic déplace
  carte:         L.map,       // instance Leaflet
  layerCommunes: L.geoJSON,   // couche GeoJSON des 101 communes
  layerProjet:   L.circleMarker,
  layerCercle:   L.circle,    // cercle de superficie
  position:      { lat, lng },// null si pas encore placé

  // Couches thématiques
  couches:        {},          // { themeId: L.GeoJSON }
  couchesActives: Set,         // Set<themeId> actuellement visibles
};
```

---

## 5. Flux d'analyse (`lancerAnalyse`)

Point d'entrée du bouton "Analyser les enjeux", défini à la fin de `app.js` :

```
Clic "Analyser les enjeux"
  │
  ├─ 1. Vérifications : typeProjet + position obligatoires
  │
  ├─ 2. detecterZones(lat, lng, typeProjet)
  │      Parcourt COUCHES_DATA × ENJEUX_ZONES
  │      → point-in-polygon + distance pour chaque feature GeoJSON
  │      → construit zonesResultats[] et zonesActives (Set des types détectés)
  │
  ├─ 3. Filtrer ENJEUX[typeProjet]
  │      Condition 1 : enjeu.tmin ≤ A.taille
  │      Condition 2 : enjeu.zones_requises ⊆ zonesActives (ou null = toujours)
  │
  ├─ 4. Ajouter enjeux contextuels depuis zonesResultats (sans doublons)
  │
  ├─ 5. Tri : enjeux de zone en tête, puis par niveau (élevé→moyen→faible)
  │
  ├─ 6. Rendu :
  │      rendreAccordeonZones(zonesResultats, conteneur)  ← accordéon rouge
  │      rendreAccordeons(enjeux, conteneur)              ← 4 accordéons thématiques
  │      ⚠️  rendreAccordeons() AJOUTE au conteneur, ne le réinitialise pas
  │
  └─ 7. Sections post-analyse :
         afficherContacts()   → détection commune + filtrage contacts
         afficherChecklist()  → checklist spécifique au sous-type
         afficherAlentours()  → lancement Overpass API
```

---

## 6. Détection géographique

Deux systèmes coexistent dans `app.js` — **les deux sont actifs, ne pas supprimer l'un ou l'autre**.

**Système actuel** (utilisé par `lancerAnalyse`) :
- Fonctions : `detecterZones`, `pointDansPolygone`, `distanceMetres`, `featureContientPoint`
- Données : `ENJEUX_ZONES` (JSON embarqué, ~29 enjeux contextuels de zone)

**Ancien système** (utilisé par certaines branches, toujours nécessaire) :
- Fonctions : `pointInPolygon`, `distLatLng`, `projetDansFeature`, `distPointSegment`
- Données : `ENJEUX_CONTEXTUELS` (JSON embarqué, ligne ~4106)

---

## 7. Contacts dynamiques

`detecterCommuneProjet()` fait un point-in-polygon sur `GEOJSON_TB` (101 communes de `enjeux-db.js`).

`getEpciInfo(codeEpci)` mappe les 3 EPCI du Territoire de Belfort :

| Code EPCI | Acronyme | Nom |
|---|---|---|
| `200069052` | **GBCA** | Grand Belfort Communauté d'Agglomération |
| `200069060` | **CCVS** | CC de la Vallée de la Savoureuse |
| `249000241` | **CCST** | CC du Sud Territoire |

---

## 8. Règles critiques — ne jamais casser

### `rendreAccordeons()` ajoute, n'écrase pas

```javascript
// ✅ CORRECT
function rendreAccordeons(filtres, conteneur) {
  /* NE PAS réinitialiser conteneur.innerHTML — l'accordéon zones
     est déjà inséré par rendreAccordeonZones, on ajoute après lui. */
  axeIds.forEach(function(axeId) {
    var section = document.createElement('div');
    // ...
    conteneur.appendChild(section); // ← append, pas reset
  });
}
```

Si on remet `conteneur.innerHTML = ''` en début de fonction, l'accordéon rouge des contraintes géographiques (inséré juste avant par `rendreAccordeonZones`) disparaît.

### IDs HTML critiques

Ne pas renommer ces IDs sans grep global dans `app.js` :

| ID | Module concerné | Rôle |
|---|---|---|
| `liste-enjeux` | `lancerAnalyse` | Conteneur de tous les accordéons |
| `msg-accueil` | `lancerAnalyse` | Message initial (masqué après analyse) |
| `enjeux-sous-titre` | `lancerAnalyse` | Résumé de l'analyse |
| `section-contacts` | `afficherContacts`, `supprimerProjet` | Section contacts |
| `contacts-panel` | `toggleContacts` | Accordéon contacts |
| `contacts-ctx` | `genererContacts` | Bannière commune + EPCI |
| `contacts-liste` | `genererContacts` | Cartes des contacts |
| `section-checklist` | `afficherChecklist`, `supprimerProjet` | Section checklist |
| `checklist-panel` | `toggleChecklist` | Accordéon checklist |
| `checklist-ctx` | `genererChecklist` | Contexte (type + localisation) |
| `checklist-body` | `genererChecklist` | Items |
| `section-alentours` | `afficherAlentours`, `supprimerProjet` | Section alentours |
| `alentours-panel` | `toggleAlentours` | Accordéon alentours |
| `al-rayon-txt` | `majRayonAlentours` | Valeur du rayon affiché |
| `alentours-liste` | `afficherResultatsAlentours` | Résultats OSM |
| `layer-grid` | `genControleCouches` | Grille des boutons de couches |
| `legende-couches` | `majLegende` | Légende des couches actives |
| `layer-tooltip-global` | `genControleCouches` | Bulle info couche (créée dynamiquement dans `<body>`) |
| `grille-types` | `genBoutons` | 8 boutons types de projets |
| `grille-themes` | `genBadgesThemes` | Badges filtres thématiques |
| `grille-sous-types` | `afficherSousTypes` | Boutons sous-types |
| `stype-desc` | `selSousType`, `selType` | Description du sous-type |
| `btn-placer` | `activerPlacement`, `desactiverPlacement` | Bouton placer/annuler |
| `modale-bg` | `ouvrirModale`, `fermerModale` | Fond de la modale |
| `modale-titre` | `ouvrirModale` | Titre de la fiche |
| `modale-corps` | `ouvrirModale` | Corps de la fiche détaillée |
| `tuto-overlay` | `afficherTutoriel`, `fermerTutoriel` | Overlay tutoriel |
| `sim-result` | `afficherResultatSimulation` | Résultats simulation |

### Clé localStorage

```javascript
localStorage.getItem('ddt90_tuto_v3')  // tutoriel "déjà vu"
localStorage.getItem('ddt90_dark')     // thème sombre
```

Bumper `ddt90_tuto_v3` → `ddt90_tuto_v4` si le contenu du tutoriel change, pour forcer le réaffichage.

---

## 9. Structure des données

### Un enjeu (dans `ENJEUX` de `enjeux-db.js`)

```javascript
{
  id:   'log-001',
  nom:  'Sobriété foncière et ZAN',
  ico:  '🏗',
  niv:  'eleve',          // 'eleve' | 'moyen' | 'faible'
  tmin: 1,                // taille min déclenchante (1–4)
  zones_requises: null,   // null = toujours affiché
  // ou: ['ppri', 'azi'] → affiché seulement si ces zones sont détectées

  axes: {
    environnement: { facteurs: [...], consequences: [...] },
    economique:    { facteurs: [...], consequences: [...] },
    politique:     { facteurs: [...], consequences: [...] },
    social:        { facteurs: [...], consequences: [...] },
  },
  actions: ['Action 1', 'Action 2'],
  refs: [{ n: 'C57', t: 'Risque inondation' }],
}
```

### Un enjeu de zone (dans `ENJEUX_ZONES` de `app.js`)

```javascript
{
  id:            'zone-ppri-inondation',
  zone_types:    ['ppri', 'azi'],        // types de features déclencheurs
  zone_layers:   ['risques'],            // couche source dans COUCHES_DATA
  zone_distance: 0,                      // rayon en mètres (0 = PiP strict)
  types_projets: ['logement', 'zae'],   // null = tous les types
  nom:    'Zone inondable — PPRi/AZI détecté',
  ico:    '🌊',
  niv:    'eleve',
  tmin:   1,
  axes:   { ... },
  actions: [...],
  refs:    [...],
}
```

### Un contact (dans `CONTACTS_DB` de `app.js`)

```javascript
{
  id:       'ddt90-risques',
  nom:      'DDT 90 — Service Risques',
  role:     'PPRi, risques naturels, DDRM',
  tel:      '03 84 58 86 00',
  email:    'ddt-risques@territoire-de-belfort.gouv.fr',
  url:      'https://www.territoire-de-belfort.gouv.fr/DDT',
  types:    null,                            // null = tous les types
  zones:    ['ppri', 'azi', 'mvt_terrain'],  // null = toujours affiché
  priorite: 'Obligatoire',                  // | 'Recommandé' | 'Optionnel'
}
```

---

## 10. Modifier les données

### Ajouter un enjeu

Dans `enjeux-db.js`, tableau `ENJEUX['typeProjet']` :

```javascript
{
  id:   'log-005',       // unique dans tout ENJEUX
  nom:  'Mon enjeu',
  ico:  '🏗',
  niv:  'moyen',
  tmin: 2,
  zones_requises: null,
  axes: {
    environnement: { facteurs: ['...'], consequences: ['...'] },
    economique:    { facteurs: ['...'], consequences: ['...'] },
    politique:     { facteurs: ['...'], consequences: ['...'] },
    social:        { facteurs: ['...'], consequences: ['...'] },
  },
  actions: ['Action 1'],
  refs: [{ n: 'C57', t: 'Référence Atlas' }],
}
```

### Ajouter un contact

Dans `CONTACTS_DB` de `app.js`, groupe approprié :

```javascript
{
  id:       'mon-organisme',
  nom:      'Nom de l\'organisme',
  role:     'Compétences',
  tel:      '03 XX XX XX XX',
  email:    'contact@organisme.fr',
  url:      'https://...',
  types:    ['logement'],  // null = tous
  zones:    null,          // null = toujours visible
  priorite: 'Recommandé',
}
```

### Ajouter une étape checklist

Dans `CHECKLISTS['sousTypeId']` de `app.js` :

```javascript
{
  id:    'step-x',
  label: 'Déposer le Cerfa 13406',
  desc:  'Description...',
  info:  'Précision ou lien',
  docs:  ['Cerfa 13406*03'],
}
```

---

## 11. Lancer l'application

```bash
# Python (le plus simple)
python3 -m http.server 8080
# → http://localhost:8080
```

```bash
# Node.js
npx serve .
```

> ⚠️ Ne pas ouvrir `index.html` directement (`file://`) : le géocodage (Nominatim) et les projets alentours (Overpass) nécessitent HTTP. Les données embarquées et la carte fonctionnent hors ligne.

---

## 12. Dépendances externes

| Service | Usage | Connexion requise |
|---|---|---|
| **Leaflet 1.9.4** (unpkg) | Carte interactive | Oui (CDN) |
| **Nominatim OSM** | Géocodage barre de recherche | Oui |
| **Overpass API** | Projets similaires alentours | Oui |
| **Google Fonts** | Source Serif 4 + Inter | Oui (dégradation gracieuse) |

---

## 13. Historique du nettoyage (mars 2026)

| Supprimé / consolidé | Raison |
|---|---|
| `function lancerAnalyse()` stub | Jamais appelé — remplacé par le wrapper en fin de fichier |
| Bandeaux de section vides consécutifs | Dead code laissé par une refacto précédente |
| `detecterZonesProjet()` | Jamais appelée — supersédée par `detecterZones()` |
| `afficherBandeauZones()` | Jamais appelée |
| `creerCardEnjeu()` stub vide | Jamais appelée |
| `var _selTypeOrig` + wrapper | Fusionné dans `selType()` |
| `var _supprimerProjetOrig` + wrapper | Fusionné dans `supprimerProjet()` |
| Commentaires `/* hooks consolidated */` | Orphelins |
| Bloc `PLACEMENT OBLIGATOIRE` (commentaires morts) | Dead code |
| Lignes vides multiples (≥ 3) | Normalisées à 2 |
| 26 fonctions sans commentaire | JSDoc ajouté |

---

## 14. Améliorations futures suggérées

| Priorité | Action |
|---|---|
| 🔴 Haute | Remplacer les GeoJSON de `COUCHES_DATA` par des flux WFS IGN en temps réel |
| 🔴 Haute | Vérifier `CONTACTS_DB` annuellement (tél, emails) |
| 🟠 Moyenne | Externaliser `enjeux-db.js` vers un endpoint API |
| 🟠 Moyenne | Ajouter le support des PLU communaux (WFS Grand Belfort) |
| 🟡 Basse | Export PDF de la fiche d'analyse |
| 🟡 Basse | Mode hors-ligne via Service Worker |

---

*Version 1.4 — Mars 2026*

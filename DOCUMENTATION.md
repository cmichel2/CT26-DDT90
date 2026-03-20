# DDT 90 — Logiciel Interactif d'Aide à la Décision
## Documentation technique · Version 4.0 · Mars 2026

---

## ⚠️ Architecture réelle : application MONOLITHIQUE

> La documentation v3.0 décrivait une architecture modulaire (modules/, config/, data/) qui **n'existe pas**.  
> L'application est un fichier unique `app.js` (~6 900 lignes) qui contient **à la fois les données et la logique**.  
> `enjeux-db.js` est le seul fichier externe de données (chargé en `<script>` dans `index.html`).

```
ddt90/
├── index.html       ← Structure HTML, ordre de chargement des scripts
├── style.css        ← Design system complet (variables CSS, dark mode, composants)
├── app.js           ← TOUT : données inline + toutes les fonctions (~6 900 lignes)
└── enjeux-db.js     ← Données enjeux standards (TYPES, TAILLES, THEMES, ENJEUX, SOUS_TYPES)
```

---

## 1. Lancer l'application

```bash
# Depuis la racine du projet
python3 -m http.server 8080   # → http://localhost:8080
```

> ⚠️ Ne jamais ouvrir `index.html` directement (`file://`) : les appels API externes  
> (Nominatim, Overpass, Géoplateforme IGN WFS) nécessitent HTTP.

---

## 2. Ordre de chargement (index.html)

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="enjeux-db.js"></script>   <!-- TYPES, TAILLES, THEMES, ENJEUX, SOUS_TYPES -->
<script src="app.js"></script>          <!-- Tout le reste -->
```

**Dépendances externes au chargement :**

| Service | Usage | Offline possible ? |
|---------|-------|-------------------|
| Leaflet 1.9.4 (unpkg) | Carte interactive | Non |
| data.geopf.fr/wmts | Couches IGN WMTS | Non |
| data.geopf.fr/wms-r | Couches WMS (MH, archéo) | Non |
| data.geopf.fr/wfs | Détection parcelles RPG (PAC) | Non — silencieux si indisponible |
| Nominatim OSM | Géocodage barre de recherche | Non |
| Overpass API | Projets alentours | Non |

Les données GeoJSON des couches Atlas (`COUCHES_DATA` dans `app.js`) fonctionnent **hors ligne**.

---

## 3. Variables globales — ce qui vient de `enjeux-db.js`

```javascript
// Définis dans enjeux-db.js, utilisés dans app.js
var TYPES       // [{id, label, ico}, …]  — 8 types de projets
var TAILLES     // {1:{nom,…}, 2:…, 3:…, 4:…}  — envergures 1-4
var THEMES      // [{id, label, ico, color}, …]  — catégories de filtrage
var ENJEUX      // {logement:[…], zae:[…], …}  — enjeux standards par type
var SOUS_TYPES  // {logement:[…], …}  — sous-types par type de projet
```

> ⚠️ `TAILLES` est un **objet** indexé par entier (1-4), **pas un tableau**.  
> `A.taille` est un entier 1-4, jamais une chaîne 'XS'/'S'/'M'/'L'.

---

## 4. Variables globales — ce qui est dans `app.js`

```javascript
// Couches cartographiques
var COUCHES_IGN      // Définition des couches Géoplateforme
var GPF_WMTS         // URL template WMTS
var COUCHE_STYLES    // Styles visuels + groupes des couches
var COUCHES_DATA     // GeoJSON de toutes les couches Atlas (données embarquées)

// Enjeux contextuels (déclenchés géographiquement)
var ENJEUX_CONTEXTUELS   // Enjeux par zone nommée (PPRi, MH, radon…)
var ENJEUX_ZONES         // Enjeux déclenchés par zone détectée dans COUCHES_DATA
var ENJEUX_MINDMAP       // Enjeux 5 catégories mindmap par type de projet

// Simulation
var SIM_BASE         // Paramètres durée/complexité/impact par type et envergure
var ZONES_RISQUE     // Zones géo influençant la simulation (PPRi, Natura 2000…)

// Contacts
var CONTACTS_DB      // Tous les contacts filtrés selon type+zones détectées

// Checklist
var CHECKLISTS       // Étapes administratives par sous-type de projet

// Tutoriel + Serious Game
var TUTO_SLIDES      // Contenu des 6 slides du tutoriel
var SG_CAS           // Cas du serious game
var SG_QUESTIONS     // Questions du serious game

// Système enjeux mindmap
var AXES_META        // Définition des 6 catégories (couleurs, icônes…)

// RPG (Registre Parcellaire Graphique)
var RPG_GROUPES_SENSIBLES  // Types de cultures déclenchant les contacts agricoles

// Divers
var OSM_TAGS         // Tags OSM pour la recherche Overpass
var SUGG_ICONS       // Icônes pour la barre de recherche
```

---

## 5. État global — objet `A`

Tout l'état en mémoire est dans `var A` (défini vers la ligne 782 de `app.js`) :

```javascript
var A = {
  // Projet
  typeProjet:    null,   // 'logement' | 'zae' | 'equipement' | 'energie' |
                         // 'transport' | 'agriculture' | 'nature' | 'friche'
  sousType:      null,   // ex. 'maison_indiv', 'pv_sol'
  taille:        1,      // entier 1-4 (JAMAIS une chaîne)
  themesActifs:  null,   // Set des IDs de thèmes actifs (init dans DOMContentLoaded)
  superficieHa:  null,

  // Carte
  modePlacement: false,
  modeDeplace:   false,
  carte:         null,   // instance L.map Leaflet
  layerCommunes: null,   // GeoJSON 101 communes
  layerProjet:   null,   // CircleMarker position projet
  layerCercle:   null,   // Circle superficie
  position:      null,   // { lat, lng }

  // Couches
  couches:        {},          // { themeId: L.GeoJSON | L.TileLayer }
  couchesActives: new Set(),   // Set des IDs de couches affichées

  // Résultats analyse (stockés pour le rapport PDF)
  _lastFiltres:        null,   // filtres[] après lancerAnalyse()
  _lastZonesResultats: null,   // zonesResultats[] après lancerAnalyse()
  _sim:                null,   // résultat simulation pour rapport
  _zonesAgri:          null,   // zones agricoles détectées
  _axesMajeurs:        null,   // axes de transport détectés
  _rpgParcelle:        null,   // données parcelle IGN RPG/PAC
  _rpgAnnee:           null,   // millésime RPG utilisé (2024 ou 2023)
};
```

---

## 6. Flux d'analyse complet (`lancerAnalyse`)

```
Clic "Analyser les enjeux"
  │
  ├─ 1. Validation : typeProjet + position obligatoires
  │
  ├─ 2. detecterZones(lat, lng, typeProjet)
  │       Parcourt COUCHES_DATA × ENJEUX_ZONES
  │       point-in-polygon + rayon pour chaque feature GeoJSON
  │       → zonesResultats[] + zonesActives (Set des types détectés)
  │
  ├─ 3. detecterAxesMajeurs(lat, lng)          ← NOUVEAU
  │       Autoroutes < 500m, nationales < 300m, ferroviaire < 500m
  │       → A._axesMajeurs = { aProximite, autoroutes[], nationales[], ferroviaire[] }
  │
  ├─ 4. detecterZonesAgricoles(lat, lng)
  │       → A._zonesAgri (nitrates, bio, AOP, région agricole…)
  │
  ├─ 5. Filtrage ENJEUX[typeProjet]
  │       Condition 1 : enjeu.tmin ≤ A.taille
  │       Condition 2 : enjeu.zones_requises ⊆ zonesActives (ou null)
  │
  ├─ 6. Injection enjeux contextuels
  │       • ENJEUX_ZONES → selon zonesResultats
  │       • genererEnjeuxAgricoles() → _agri_ctx
  │       • genererEnjeuxAxesMajeurs() → _transport_ctx   ← NOUVEAU
  │
  ├─ 7. Tri : contextuels (zones) élevé→faible, puis thématiques élevé→faible
  │       ⚠️ ordNiv[x] !== undefined ? ordNiv[x] : 2  (PAS ordNiv[x] || 2 — falsy bug)
  │
  ├─ 8. Rendu
  │       rendreAccordeonZones(zonesResultats, conteneur)   ← accordéon rouge
  │       rendreAccordeons(filtres, conteneur)              ← 5 catégories mindmap
  │       ⚠️ rendreAccordeons() AJOUTE (append), NE PAS faire conteneur.innerHTML = ''
  │
  ├─ 9. Post-analyse synchrone
  │       afficherContacts()  → filtrage CONTACTS_DB + contact cadastre systématique
  │       afficherChecklist() → genererChecklist() + étapes contextuelles
  │       afficherAlentours() → Overpass API (async)
  │       injecterContactsAxesMajeurs()   ← NOUVEAU
  │       injecterChecklistAxesMajeurs()  ← NOUVEAU
  │
  ├─ 10. Post-analyse asynchrone (RPG IGN)
  │        interrogerRPG(lat, lng) → WFS Géoplateforme LANDUSE.AGRICULTURE{annee}
  │        Si parcelle PAC détectée :
  │          appliquerRPG(props) → bandeau 🌾 + injecterContactsRPG() + injecterChecklistRPG()
  │        ⚠️ BBOX WFS : ordre minX,minY,maxX,maxY (lng,lat) — pas lat,lng
  │        ⚠️ Paramètre : TYPENAME (pas TYPENAMES) sans namespace ':parcelles'
  │
  └─ 11. Activation bouton rapport PDF
          A._lastFiltres / A._lastZonesResultats → stockés pour genererRapportPDF()
```

---

## 7. Système d'enjeux mindmap (NOUVEAU en v4.0)

L'analyse affiche **5 catégories** issues de la mindmap DDT 90, au lieu de 4 axes génériques.

### Catégories (`AXES_META`)

| ID | Label | Couleur | Description |
|----|-------|---------|-------------|
| `economique` | Facteurs économiques | `#6d28d9` | Coûts, personnel, énergie, valeur foncière |
| `cartographie` | Cartographie & Territoire | `#0f766e` | PLU, accessibilité, réseaux, zones, topographie |
| `social` | Facteurs sociaux | `#c2410c` | Démographie, mobilité, nuisances, niveau de vie |
| `environnemental` | Facteurs environnementaux | `#be185d` | Risques, ressources, pollution, biodiversité |
| `politique` | Facteurs politiques | `#92400e` | Conformité PLU, intercommunalité, acceptabilité |

Une 6ᵉ catégorie `prevention` existe dans `AXES_META` mais n'est pas encore activée dans `rendreAccordeons`.

### Structure d'un enjeu mindmap (`ENJEUX_MINDMAP`)

```javascript
// Clé = type de projet, valeur = tableau d'enjeux
ENJEUX_MINDMAP = {
  logement: [
    {
      id:   'log-eco-construction',
      nom:  'Coûts de construction et financement',
      ico:  '💶',
      niv:  'eleve',   // 'eleve' | 'moyen' | 'faible'
      tmin: 1,         // envergure minimum déclenchante (1-4)
      axes: {
        economique: {
          elements:     ['Main-d\'œuvre et construction', …],  // Éléments clés mindmap ◆
          facteurs:     ['Coût de construction au m²…', …],
          consequences: ['Budget à calibrer…', …],
          actions:      ['Étude de faisabilité…', …],
        },
        cartographie: { elements, facteurs, consequences, actions },
        // … autres catégories
      },
    },
  ],
  zae: […], equipement: […], // etc.
};
```

### `rendreAccordeons(filtres, conteneur)`

Fusionne **deux sources** par catégorie :
1. `ENJEUX_MINDMAP[A.typeProjet]` — enjeux propres au type, filtrés par `tmin ≤ A.taille`
2. `filtres[]` — enjeux standards de `enjeux-db.js` + enjeux contextuels, mappés vers les nouvelles catégories

Mapping de compatibilité ancien→nouveau pour les enjeux standards :
- `environnement` → catégorie `environnemental`
- `economique` → `economique`, `social` → `social`, `politique` → `politique`

---

## 8. Détection axes majeurs (NOUVEAU en v4.0)

Déclenchée automatiquement dans `lancerAnalyse()`, injecte des enjeux/contacts/checklist supplémentaires si le projet est à proximité d'axes de transport.

```javascript
// A._axesMajeurs après détection :
{
  aProximite:   true,
  autoroutes:   [{ nom: 'A36 Belfort-Montbeliard', type: 'autoroute', dist: 500 }],
  nationales:   [{ nom: 'RN19 accès Belfort', type: 'nationale', dist: 300 }],
  ferroviaire:  [{ nom: 'TGV Belfort-Montbeliard', type: 'TGV', dist: 500 }],
}
```

**Seuils de détection :**

| Type | Rayon | Source dans COUCHES_DATA |
|------|-------|--------------------------|
| Autoroute | 500 m | `organisation`, `mobilite` (type='autoroute') |
| Route nationale | 300 m | `organisation`, `mobilite` (type='nationale') |
| TGV / TER | 500 m | `organisation`, `mobilite` (type='TGV' ou 'TER') |

**Impact sur la simulation :**
- Autoroute : +2 mois, +10 complexité, +8 impact
- Nationale : +1 mois, +5 complexité, +4 impact
- Ferroviaire : +1 mois, +6 complexité, +5 impact

---

## 9. Couches Géoplateforme IGN

Définies dans `COUCHES_IGN` et `COUCHE_STYLES` dans `app.js`.

| Clé | Couche IGN | Zoom | Protocole |
|-----|-----------|------|-----------|
| `cadastre` | `CADASTRALPARCELS.PARCELLAIRE_EXPRESS` | ≥ 13 | WMTS |
| `agriculture` | `LANDUSE.AGRICULTURE2024` | ≥ 10 | WMTS |
| `monuments_historiques` | `MONUMENTS_HISTORIQUES` | ≥ 12 | **WMS** |
| `archeologie_preventive` | `ARCHEOLOGIE.PREVENTIVE` | ≥ 10 | **WMS** |
| `transport_routier` | `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2` | ≥ 6 | WMTS |
| `transport_ferroviaire` | `TRANSPORTNETWORK.COMMONTRANSPORTELEMENTS.MARKERPOST` | ≥ 14 | WMTS |

Les couches `monuments_historiques`, `archeologie_preventive`, `transport_routier` et `transport_ferroviaire` sont des **sous-couches de groupe** (pas directement dans `COUCHE_STYLES`). Elles héritent du style parent via `chargerCouche()`.

### Groupes de couches

```javascript
// Dans COUCHE_STYLES :
mobilite:   { groupe: ['transport_routier', 'transport_ferroviaire'] }
patrimoine: { groupe: ['monuments_historiques', 'archeologie_preventive'] }
```

`toggleCoucheGroupe(groupeId, membres, btn)` active/désactive toutes les sous-couches en une fois.

### Ajouter une couche IGN

1. `COUCHES_IGN` dans `app.js` : `{ layer:'NOM_COUCHE', format:'image/png', opacity:0.75, minZoom:10, wms?:true }`
2. `COUCHE_STYLES` dans `app.js` : `{ color, fill, swatch, label, tooltip }`
3. Si groupe : `groupe: ['id1', 'id2']` dans `COUCHE_STYLES`
4. Ajouter l'ID à `noFallback` dans `chargerCouche()` si pas de fallback GeoJSON

---

## 10. Contacts automatiques (NOUVEAU en v4.0)

| Contact | Condition de déclenchement | Priorité |
|---------|---------------------------|----------|
| 📐 SPF Belfort (cadastre) | **Toujours** — systématique | Recommandé |
| 🗺 Géoportail Urbanisme | **Toujours** — systématique | Recommandé |
| 👨‍🌾 Agriculteur exploitant | Parcelle RPG/PAC détectée | Obligatoire |
| 🌾 Chambre Agriculture 90 | Parcelle RPG sensible (CDPENAF) | Obligatoire |
| 🛣 DIR Est | Autoroute ou nationale < seuil | Consultation obligatoire |
| 🚆 SNCF Réseau | Voie ferrée < 500m | Recommandé si < 100m |
| 🌬 ATMO BFC | Autoroute détectée | Optionnel |

Le contact agriculteur exploitant est généré avec des **placeholders** `[À compléter]`. Les coordonnées réelles sont à obtenir via la Chambre d'Agriculture 90 (03 84 57 83 83) ou la DDT 90.

---

## 11. Rapport PDF — 7 pages

Généré par `genererRapportPDF()` dans `app.js` via `window.open()` + `document.write()`.

| Page | Contenu |
|------|---------|
| 1 | Couverture : type, commune, note globale, grille méta |
| 2 | Enjeux : zones sensibles + tableau enjeux par niveau |
| 3 | Checklist administrative |
| 4 | Projets similaires alentours |
| 5 | Simulation : jauges + note globale + barres 5 axes |
| 6 | Contacts |
| 7 | Évaluation globale : radar SVG 5 axes + méthode de calcul |

### Calcul de la note globale (score complexité dossier)

| Axe | Formule | Pondération |
|-----|---------|-------------|
| Économique | `min(4, complexité/100 × 4.5)` | × 1 |
| Cartographie | `min(4, 0.8 + nbZones × 0.45)` | × 0.8 |
| Social | `min(3.5, 0.8 + (nbEnjeuxElevé/total) × 3)` | × 0.8 |
| Environnemental | impact > 0 : `min(4, impact/100×4)` ; impact ≤ 0 : `max(0.5, 1.5+impact/100)` | × 1 |
| Politique | `min(4, 0.8 + nbZones×0.3 + taille×0.4 + nbAxes×0.5)` | × 0.8 |

Score global = moyenne pondérée arrondie à 0.5. **1 = simple, 5 = très complexe.** Les projets bénéfiques (nature, ENR) obtiennent naturellement un score bas = bonne note.

---

## 12. Simulation

`lancerSimulation()` calcule durée, complexité et impact à partir de `SIM_BASE` puis applique des modificateurs en cascade.

```javascript
// Ordre d'application des modificateurs :
1. SIM_BASE[typeProjet].{dureeBase, complexBase, impactBase}[taille-1]
2. bonusSuperficie (si superficieHa > seuil selon taille)
3. ZONES_RISQUE (PPRi, Natura 2000, MH, nitrates, sismique)
4. modificateursSimulationAgricole(A._zonesAgri)  — si agriculture
5. modificateursSimulationAxesMajeurs(A._axesMajeurs)  — NOUVEAU
```

Les alertes de toutes les sources sont concaténées : `alertesGen.concat(alertesAgri).concat(alertesAxes)`.

---

## 13. Structure d'un enjeu standard (enjeux-db.js)

```javascript
{
  id:              'log-001',
  nom:             'Sobriété foncière et ZAN',
  ico:             '🏗',
  niv:             'eleve',        // 'eleve' | 'moyen' | 'faible'
  tmin:            1,              // envergure minimum (1-4)
  zones_requises:  null,           // null = toujours ; ['ppri'] = si zone détectée
  axes: {
    environnement: { facteurs: […], consequences: […] },
    economique:    { facteurs: […], consequences: […] },
    politique:     { facteurs: […], consequences: […] },
    social:        { facteurs: […], consequences: […] },
  },
  actions: ['Action 1', …],
  refs:    [{ n: 'C57', t: 'Risque inondation' }],
}
```

### Enjeu de zone (`ENJEUX_ZONES` dans app.js)

```javascript
{
  id:            'zone-ppri-inondation',
  zone_types:    ['ppri', 'azi'],
  zone_layers:   ['risques'],
  zone_distance: 0,           // 0 = point-in-polygon strict ; > 0 = rayon en mètres
  types_projets: ['logement', 'zae', …],
  nom, ico, niv, tmin, axes, actions, refs,
  contexte_zone: true,        // affiché dans l'accordéon rouge
}
```

---

## 14. IDs HTML critiques

| ID | Utilisé par |
|----|------------|
| `liste-enjeux` | `lancerAnalyse`, `rendreAccordeons`, `rendreAccordeonZones` |
| `msg-accueil` | `lancerAnalyse` |
| `enjeux-hdr h2`, `enjeux-sous-titre` | `lancerAnalyse` |
| `contacts-ctx`, `contacts-liste` | `afficherContacts`, RPG, axes majeurs |
| `checklist-body`, `checklist-ctx` | `afficherChecklist`, RPG, axes majeurs |
| `section-alentours`, `alentours-liste` | `afficherAlentours` |
| `layer-grid`, `legende-couches` | contrôles couches |
| `grille-types`, `grille-themes`, `grille-sous-types` | panneau gauche |
| `btn-placer`, `btn-suppr`, `btn-rapport` | placement, suppression, rapport |
| `modale-bg`, `modale-titre`, `modale-corps` | modale fiche enjeu |
| `tuto-overlay` | tutoriel |
| `sim-result`, `sim-empty` | simulation |
| `rpg-spinner`, `rpg-bandeau` | détection parcelle RPG (asynchrone) |
| `contact-cadastre` | contact SPF systématique |
| `rpg-contacts`, `rpg-checklist` | contacts/checklist RPG |

---

## 15. Règles critiques (pièges connus)

### `rendreAccordeons()` ne réinitialise pas le conteneur

```javascript
// ✅ CORRECT
function rendreAccordeons(filtres, conteneur) {
  // ❌ NE JAMAIS FAIRE : conteneur.innerHTML = ''
  // L'accordéon zones (rouge) est déjà inséré — on ajoute après
  axeIds.forEach(function(axeId) {
    conteneur.appendChild(accord);  // append uniquement
  });
}
```

### Tri `ordNiv` — falsy 0

```javascript
// ✅ CORRECT — 'eleve' = 0, donc tester !== undefined
var ordNiv = { eleve: 0, moyen: 1, faible: 2 };
items.sort(function(a, b) {
  var oa = ordNiv[a.enjeu.niv] !== undefined ? ordNiv[a.enjeu.niv] : 2;
  // ❌ FAUX : ordNiv[a.enjeu.niv] || 2  (donne 2 pour 'eleve' car 0 est falsy)
});
```

### `A.taille` est un entier, pas une chaîne

```javascript
A.taille = 1;          // ✅ Entier 1-4
A.taille = parseInt(val);  // Toujours parser avec parseInt()
TAILLES[A.taille]      // Accès par clé entière
// ❌ NE PAS comparer avec 'XS', 'S', 'M', 'L'
```

### WFS RPG — BBOX et TYPENAME

```javascript
// ✅ CORRECT
'&TYPENAME=LANDUSE.AGRICULTURE' + year +
'&BBOX=' + minX + ',' + minY + ',' + maxX + ',' + maxY + ',EPSG:4326'
// minX=lng, minY=lat (ordre lng,lat pour EPSG:4326 en WFS 2.0)

// ❌ FAUX (cause HTTP 400)
'&TYPENAMES=LANDUSE.AGRICULTURE' + year + ':parcelles'
'&BBOX=' + minY + ',' + minX + ',' + maxY + ',' + maxX  // lat,lng inversé
```

### Contacts axes majeurs — HTML sans `position:absolute`

Le badge `.contact-priorite` utilise `display:inline-block` + `flex-shrink:0` (plus de `position:absolute`). Le conteneur parent doit avoir la classe `.contact-card-header` avec `display:flex`.

---

## 16. localStorage

| Clé | Contenu |
|-----|---------|
| `theme` | `'dark'` ou absent |
| `ddt90_tuto_v3` | `'1'` si tutoriel déjà vu |

> 🔁 Bumper `ddt90_tuto_v3` → `ddt90_tuto_v4` si le contenu du tutoriel change (pour forcer le ré-affichage).

---

## 17. Modifier les données

| Action | Où modifier |
|--------|-------------|
| Ajouter/modifier un enjeu standard | `enjeux-db.js` → `ENJEUX` |
| Ajouter un type de projet | `enjeux-db.js` → `TYPES` + `ENJEUX` + `SOUS_TYPES` |
| Ajouter un enjeu mindmap | `app.js` → `ENJEUX_MINDMAP[typeProjet]` |
| Ajouter un enjeu de zone | `app.js` → `ENJEUX_ZONES` |
| Ajouter un enjeu contextuel | `app.js` → `ENJEUX_CONTEXTUELS` |
| Ajouter un contact | `app.js` → `CONTACTS_DB` |
| Modifier la checklist | `app.js` → `CHECKLISTS` |
| Ajouter une couche IGN | `app.js` → `COUCHES_IGN` + `COUCHE_STYLES` |
| Modifier les communes | GeoJSON embarqué dans `COUCHES_DATA['communes']` |
| Modifier la simulation | `app.js` → `SIM_BASE` + `ZONES_RISQUE` |
| Modifier le rapport PDF | `app.js` → `genererRapportPDF()` (blocs HTML inline) |
| Modifier le tutoriel | `app.js` → `TUTO_SLIDES` |

---

## 18. Historique des versions

| Version | Date | Modifications majeures |
|---------|------|------------------------|
| v1.0 | Mars 2026 | Application initiale (4 axes, 11 couches) |
| v2.0 | Mars 2026 | Couches IGN Géoplateforme WMTS, légende enrichie |
| v3.0 | Mars 2026 | Zones agricoles RPG, contacts/checklist contextuels |
| v3.5 | Mars 2026 | Couches groupées WMS (Patrimoine + Mobilités IGN) |
| v4.0 | Mars 2026 | **Système enjeux mindmap 5 catégories**, détection axes de transport, contacts automatiques (cadastre, agriculteur), rapport PDF redesigné, score plus généreux, tutoriel mis à jour |

---

## 19. Améliorations futures

| Priorité | Action |
|----------|--------|
| 🔴 Haute | Séparer `app.js` en modules (couches, enjeux, simulation, rapport, contacts) |
| 🔴 Haute | Externaliser les données dans des fichiers JSON (ENJEUX_MINDMAP, ENJEUX_ZONES…) |
| 🔴 Haute | Vérifier `CONTACTS_DB` annuellement (téléphones, emails, noms) |
| 🟠 Moyenne | Activer la catégorie `prevention` dans `rendreAccordeons` |
| 🟠 Moyenne | Ajouter les PLU communaux (WFS GPU Géoplateforme) |
| 🟠 Moyenne | Remplacer `COUCHES_DATA` GeoJSON embarqué par des flux WFS IGN temps réel |
| 🟡 Basse | Mode hors-ligne via Service Worker (cache tiles IGN) |
| 🟡 Basse | Export rapport PDF natif (Puppeteer côté serveur) |
